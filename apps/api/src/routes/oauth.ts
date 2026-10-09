import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { wrap } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { publicUser, setSessionCookie, signSession } from '../lib/auth.js';
import type { Provider, Store } from '../lib/store-types.js';

/* ---------------------------------------------------------------- */
/* Estado firmado (anti-CSRF)                                        */
/* ---------------------------------------------------------------- */

function signState(payload: object, ttlSeconds = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  const sig = createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyState<T>(token: string): T | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', config.authSecret).update(body).digest('base64url');
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- */
/* Proveedores                                                       */
/* ---------------------------------------------------------------- */

interface ProviderConfig {
  key: Provider;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

function providers(): ProviderConfig[] {
  return [
    {
      key: 'github',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'read:user user:email',
      clientId: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      enabled: config.oauth.github.enabled,
    },
    {
      key: 'google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      clientId: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      enabled: config.oauth.google.enabled,
    },
  ];
}

interface ExternalProfile {
  id: string;
  email: string;
  name: string | null;
}

async function fetchProfile(provider: ProviderConfig, code: string, redirectUri: string): Promise<ExternalProfile> {
  const tokenRes = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw ApiError.unauthorized(`El proveedor rechazó el código (${tokenRes.status})`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) throw ApiError.unauthorized(tokenJson.error ?? 'No se obtuvo access_token');

  if (provider.key === 'github') {
    const [user, emails] = await Promise.all([
      fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': 'apis-web' } }).then((r) => r.json()),
      fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': 'apis-web' } }).then((r) => r.json()),
    ]);
    const primary = Array.isArray(emails) ? emails.find((e: { primary?: boolean }) => e.primary) : undefined;
    const email = (primary as { email?: string } | undefined)?.email ?? (user as { email?: string }).email;
    if (!email) throw ApiError.badRequest('La cuenta de GitHub no tiene email público; hazlo público o usa email/contraseña');
    return { id: String((user as { id: number }).id), email, name: ((user as { name?: string }).name ?? (user as { login?: string }).login) ?? null };
  }

  const info = (await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  }).then((r) => r.json())) as { sub?: string; email?: string; name?: string };
  if (!info.email || !info.sub) throw ApiError.badRequest('Google no devolvió email');
  return { id: info.sub, email: info.email, name: info.name ?? null };
}

/**
 * OAuth opcional: si no hay client id/secret configurados, las rutas
 * responden 501 en lugar de fallar en silencio.
 */
export function createOAuthRoutes(store: Store) {
  const router = Router();

  router.get(
    '/:provider',
    wrap(async (req, res) => {
      const provider = providers().find((p) => p.key === req.params.provider);
      if (!provider) throw ApiError.notFound('Proveedor no soportado');
      if (!provider.enabled) {
        throw ApiError.notImplemented(
          `OAuth de ${provider.key} no configurado. Define ${provider.key === 'github' ? 'GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET' : 'GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET'}.`
        );
      }

      const redirectUri = `${config.baseUrl.replace(/\/$/, '')}/v1/auth/oauth/${provider.key}/callback`;
      const state = signState({
        redirect: typeof req.query.redirect === 'string' ? req.query.redirect : '/panel',
        nonce: randomBytes(8).toString('hex'),
      });
      const url = new URL(provider.authorizeUrl);
      url.searchParams.set('client_id', provider.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', provider.scope);
      url.searchParams.set('state', state);
      if (provider.key === 'google') url.searchParams.set('response_type', 'code');
      return res.redirect(url.toString());
    })
  );

  router.get(
    '/:provider/callback',
    wrap(async (req, res) => {
      const provider = providers().find((p) => p.key === req.params.provider);
      if (!provider) throw ApiError.notFound('Proveedor no soportado');
      if (!provider.enabled) throw ApiError.notImplemented(`OAuth de ${provider.key} no configurado`);

      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) throw ApiError.badRequest('Faltan code o state');
      const payload = verifyState<{ redirect: string }>(state);
      if (!payload) throw ApiError.badRequest('State inválido o caducado');

      const redirectUri = `${config.baseUrl.replace(/\/$/, '')}/v1/auth/oauth/${provider.key}/callback`;
      const profile = await fetchProfile(provider, code, redirectUri);

      let user = await store.getUserByProvider(provider.key, profile.id);
      if (!user) {
        user = await store.getUserByEmail(profile.email);
        if (user) {
          user = await store.updateUser(user.id, { provider: provider.key, providerId: profile.id });
        } else {
          const now = new Date().toISOString();
          user = await store.createUser({
            id: newId('usr'),
            email: profile.email.toLowerCase(),
            name: profile.name,
            passwordHash: null,
            provider: provider.key,
            providerId: profile.id,
            plan: 'free',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      if (!user) throw ApiError.internal('No se pudo crear el usuario');

      const token = signSession(user);
      setSessionCookie(res, token);
      const target = new URL('/auth/callback', config.webUrl.replace(/\/$/, ''));
      target.searchParams.set('token', token);
      target.searchParams.set('user', encodeURIComponent(JSON.stringify(publicUser(user))));
      target.searchParams.set('redirect', payload.redirect || '/panel');
      return res.redirect(target.toString());
    })
  );

  return router;
}
