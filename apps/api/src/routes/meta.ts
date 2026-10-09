import { Router } from 'express';
import { config } from '../config.js';
import { ENDPOINTS } from '../catalog.js';
import { ok, wrap } from '../lib/http.js';
import type { Store } from '../lib/store-types.js';
import { openApiDoc } from '../openapi.js';

const startedAt = Date.now();

export function createMetaRoutes(store: Store) {
  const router = Router();

  router.get(
    '/health',
    wrap(async (_req, res) => {
      const checks: Record<string, string> = { store: 'ok' };
      try {
        await store.init();
      } catch (err) {
        checks.store = `error: ${(err as Error).message}`;
      }
      return ok(res, {
        status: checks.store === 'ok' ? 'ok' : 'degraded',
        version: '1.0.0',
        env: config.env,
        driver: store.driver,
        uptime: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        timestamp: new Date().toISOString(),
        checks,
      });
    })
  );

  router.get(
    '/',
    wrap(async (_req, res) =>
      ok(res, {
        name: 'Brat Sticker API',
        version: '1.0.0',
        description: 'API para generar stickers estilo Brat (SVG/PNG/JPEG/WebP).',
        docs: `${config.baseUrl}/v1/endpoints`,
        endpoints: {
          health: 'GET /v1/health',
          catalog: 'GET /v1/endpoints',
          openapi: 'GET /v1/openapi.json',
          register: 'POST /v1/auth/register',
          login: 'POST /v1/auth/login',
          me: 'GET /v1/me',
          keys: 'GET|POST /v1/keys',
          brat: 'GET|POST /v1/brat',
        },
      })
    )
  );

  router.get(
    '/endpoints',
    wrap(async (_req, res) => ok(res, ENDPOINTS))
  );

  router.get(
    '/openapi.json',
    wrap(async (req, res) => {
      const base = `${req.protocol}://${req.get('host') ?? config.baseUrl}`;
      return res.json(openApiDoc(base));
    })
  );

  return router;
}
