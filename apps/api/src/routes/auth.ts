import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { created, ok, wrap } from '../lib/http.js';
import { hashPassword, passwordIssues, publicUser, requireAuth, setSessionCookie, clearSessionCookie, signSession, verifyPassword } from '../lib/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import { newId } from '../lib/ids.js';
import type { Store } from '../lib/store-types.js';
import type { User } from '../lib/store-types.js';

const credentialsSchema = z.object({
  email: z.string().trim().email('Email inválido').max(200),
  password: z.string().min(1, 'Falta la contraseña').max(200),
  name: z.string().trim().max(80).optional(),
});

function readBody(req: unknown) {
  const raw = (req as { body?: unknown }).body;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** Emite token + cookie de sesión a partir de un usuario. */
function issueSession(user: User) {
  return { token: signSession(user), user: publicUser(user) };
}

export function createAuthRoutes(store: Store) {
  const router = Router();

  router.post(
    '/register',
    rateLimit({ perMinute: 10, keyOf: (req) => `register:${(req.ip ?? 'ip') as string}` }),
    wrap(async (req, res) => {
      const parsed = credentialsSchema.safeParse(readBody(req));
      if (!parsed.success) {
        throw ApiError.badRequest('Datos de registro inválidos', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
      }
      const { email, password, name } = parsed.data;
      const issue = passwordIssues(password);
      if (issue) throw ApiError.badRequest(issue);

      if (await store.getUserByEmail(email)) {
        throw ApiError.conflict('Ya existe una cuenta con ese email');
      }

      const now = new Date().toISOString();
      const user = await store.createUser({
        id: newId('usr'),
        email: email.toLowerCase(),
        name: name ?? null,
        passwordHash: await hashPassword(password),
        provider: 'password',
        providerId: null,
        plan: 'free',
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      const session = issueSession(user);
      setSessionCookie(res, session.token);
      return created(res, session);
    })
  );

  router.post(
    '/login',
    rateLimit({ perMinute: 20, keyOf: (req) => `login:${(req.ip ?? 'ip') as string}` }),
    wrap(async (req, res) => {
      const parsed = credentialsSchema.safeParse(readBody(req));
      if (!parsed.success) throw ApiError.badRequest('Email y contraseña son obligatorios');

      const user = await store.getUserByEmail(parsed.data.email);
      if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
        throw ApiError.unauthorized('Email o contraseña incorrectos');
      }

      const session = issueSession(user);
      setSessionCookie(res, session.token);
      return ok(res, session);
    })
  );

  router.post(
    '/logout',
    wrap(async (_req, res) => {
      clearSessionCookie(res);
      return ok(res, { ok: true });
    })
  );

  /** OAuth disponibles (para que la web solo muestre los configurados). */
  router.get(
    '/providers',
    wrap(async (_req, res) =>
      ok(res, {
        password: true,
        github: config.oauth.github.enabled,
        google: config.oauth.google.enabled,
      })
    )
  );

  return router;
}

/** Rutas de cuenta: funcionan igual con API key o con token de sesión. */
export function createAccountRoutes(store: Store) {
  const router = Router();

  router.get('/me', requireAuth(store), (req, res) => {
    const auth = req.auth!;
    return ok(res, {
      user: publicUser(auth.user),
      via: auth.via,
      plan: auth.plan,
      limits: config.rateLimit[auth.plan],
      ...(auth.apiKey ? { apiKey: { id: auth.apiKey.id, name: auth.apiKey.name, prefix: auth.apiKey.prefix } } : {}),
    });
  });

  router.get(
    '/me/usage',
    requireAuth(store),
    wrap(async (req, res) => {
      const auth = req.auth!;
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
      const usage = await store.getUsage(auth.userId, days);
      const total = usage.reduce((acc, day) => acc + day.total, 0);
      return ok(res, { days: usage, total, limit: config.rateLimit[auth.plan] });
    })
  );

  return router;
}
