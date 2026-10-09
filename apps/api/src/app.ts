import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFoundHandler, ok } from './lib/http.js';
import type { Store } from './lib/store-types.js';
import { initStore } from './store.js';
import { createMetaRoutes } from './routes/meta.js';
import { createAccountRoutes, createAuthRoutes } from './routes/auth.js';
import { createKeyRoutes } from './routes/keys.js';
import { createBratRoutes } from './routes/brat.js';
import { createOAuthRoutes } from './routes/oauth.js';

const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
  'ETag',
  'X-Image-Width',
  'X-Image-Height',
  'X-Image-Font-Size',
];

export function createApp(store: Store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // CORS: en desarrollo se acepta cualquier origen; en producción usa CORS_ORIGINS.
  const allowAll = config.corsOrigins.length === 0 || config.corsOrigins.includes('*');
  app.use(
    cors({
      origin: allowAll ? true : config.corsOrigins,
      credentials: true,
      exposedHeaders: EXPOSED_HEADERS,
      maxAge: 86_400,
    })
  );
  // cors() ya responde los preflight OPTIONS.
  app.use(express.json({ limit: '128kb' }));
  app.use(express.urlencoded({ extended: false, limit: '128kb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/', (_req, res) =>
    res.json({
      name: 'Brat Sticker API',
      version: '1.0.0',
      docs: `${config.baseUrl}/v1/endpoints`,
      health: `${config.baseUrl}/v1/health`,
      message: 'Plantilla de API + web lista para Vercel.',
    })
  );

  app.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  /** La inicialización del store es perezosa e idempotente (importante en serverless). */
  app.use((req, res, next) => {
    initStore().then(() => next()).catch(next);
  });

  const v1 = express.Router();
  v1.use(createMetaRoutes(store)); // /health, /endpoints, /openapi.json
  v1.use(createAccountRoutes(store)); // /me, /me/usage
  v1.use('/auth', createAuthRoutes(store));
  v1.use('/auth/oauth', createOAuthRoutes(store));
  v1.use('/keys', createKeyRoutes(store));
  v1.use(createBratRoutes(store)); // /brat
  app.use('/v1', v1);

  app.use((req, res) => {
    if (req.path === '/' || req.path === '') {
      return ok(res, { name: 'Brat Sticker API', docs: `${config.baseUrl}/v1/endpoints` });
    }
    return notFoundHandler(req, res);
  });

  app.use(errorHandler);
  return app;
}
