import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import type { Store } from './store-types.js';
import type { ApiKey, Plan, User } from './store-types.js';
import { ApiError } from './errors.js';
import { hashApiKey, looksLikeApiKey } from './ids.js';

const scrypt = promisify(nodeScrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number }
) => Promise<Buffer>;

const SESSION_COOKIE = 'apis_web_session';

/* ------------------------------------------------------------------ */
/* Contraseñas (scrypt, sin dependencias nativas)                       */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64url');
    const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function passwordIssues(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 200) return 'La contraseña es demasiado larga';
  return null;
}

/* ------------------------------------------------------------------ */
/* JWT (HS256) para la sesión de la web                                 */
/* ------------------------------------------------------------------ */

interface SessionClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

export function signSession(user: User, ttlSeconds = config.sessionTtl): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = { sub: user.id, email: user.email, iat: now, exp: now + ttlSeconds };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const expected = createHmac('sha256', config.authSecret).update(`${h}.${p}`).digest('base64url');
    if (expected.length !== s.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as SessionClaims;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

type CookieWriter = {
  setHeader: (name: string, value: string | string[]) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
};

export function setSessionCookie(res: CookieWriter, token: string): void {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.sessionTtl}`,
    config.isProd ? 'Secure' : '',
  ].filter(Boolean);
  const existing = res.getHeader?.('Set-Cookie');
  const value = parts.join('; ');
  if (Array.isArray(existing)) res.setHeader('Set-Cookie', [...existing, value]);
  else if (typeof existing === 'string') res.setHeader('Set-Cookie', [existing, value]);
  else res.setHeader('Set-Cookie', value);
}

export function clearSessionCookie(res: { setHeader: (n: string, v: string | string[]) => void }): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.isProd ? '; Secure' : ''}`);
}

export function readCookie(req: { headers: Record<string, string | string[] | undefined> }, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const cookies = Array.isArray(raw) ? raw.join('; ') : raw;
  for (const part of cookies.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Contexto de autenticación                                           */
/* ------------------------------------------------------------------ */

export interface AuthContext {
  userId: string;
  user: User;
  plan: Plan;
  via: 'session' | 'api_key';
  apiKey?: ApiKey;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function bearerToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const [scheme, value] = raw.split(' ');
  if (!value || !/^bearer$/i.test(scheme ?? '')) return null;
  return value.trim();
}

/** Resuelve la identidad desde API key (Bearer bsk_...), JWT Bearer o cookie de sesión. */
export function createAuthResolver(store: Store) {
  return async function resolve(req: Parameters<RequestHandler>[0]): Promise<AuthContext | null> {
    const token = bearerToken(req);

    if (token && looksLikeApiKey(token)) {
      const key = await store.getApiKeyByHash(hashApiKey(token));
      if (!key) throw ApiError.unauthorized('API key inválida o revocada');
      const user = await store.getUserById(key.userId);
      if (!user) throw ApiError.unauthorized('El usuario de la API key ya no existe');
      void store.updateApiKey(key.id, { lastUsedAt: new Date().toISOString(), requests: key.requests + 1 });
      return { userId: user.id, user, plan: user.plan, via: 'api_key', apiKey: key };
    }

    const jwt = token ?? readCookie(req, SESSION_COOKIE);
    if (!jwt) return null;

    const claims = verifySession(jwt);
    if (!claims) {
      if (token) throw ApiError.unauthorized('Token de sesión inválido o caducado');
      return null;
    }
    const user = await store.getUserById(claims.sub);
    if (!user) return null;
    return { userId: user.id, user, plan: user.plan, via: 'session' };
  };
}

/** Autentica si hay credenciales; si no, continúa como invitado. */
export function optionalAuth(store: Store): RequestHandler {
  const resolve = createAuthResolver(store);
  return (req, _res, next) => {
    resolve(req)
      .then((auth) => {
        if (auth) req.auth = auth;
        next();
      })
      .catch(next);
  };
}

/** Exige autenticación (API key o sesión). */
export function requireAuth(store: Store): RequestHandler {
  const resolve = createAuthResolver(store);
  return (req, _res, next) => {
    resolve(req)
      .then((auth) => {
        if (!auth) return next(ApiError.unauthorized('Se requiere API key (Authorization: Bearer bsk_...) o sesión activa'));
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}

/** Exige sesión de la web (cookie): protege el panel y la gestión de keys. */
export function requireSession(store: Store): RequestHandler {
  const resolve = createAuthResolver(store);
  return (req, _res, next) => {
    resolve(req)
      .then((auth) => {
        if (!auth || auth.via !== 'session') {
          return next(ApiError.unauthorized('Inicia sesión en la web para gestionar tus API keys'));
        }
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

export function publicApiKey(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    last4: key.last4,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    requests: key.requests,
  };
}

/** Enmascara la key para mostrarla en el panel (solo se ve completa al crearla). */
export function maskedKey(key: ApiKey): string {
  return `${key.prefix}${'•'.repeat(20)}${key.last4}`;
}
