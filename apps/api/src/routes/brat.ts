import { createHash } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { bratFilename, parseBratInput, toBratOptions } from '../brat/schema.js';
import { renderBrat } from '../brat/render.js';
import { ok, wrap } from '../lib/http.js';
import { optionalAuth } from '../lib/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import type { Store } from '../lib/store-types.js';

export function createBratRoutes(store: Store) {
  const router = Router();

  const handler = wrap(async (req, res) => {
    const query = { ...(req.query as Record<string, unknown>) };
    const body = req.method === 'POST' && req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const pathFormat = (req.params as { format?: string }).format;

    const input = parseBratInput({ ...query, ...body, ...(pathFormat ? { format: pathFormat } : {}) });
    const options = toBratOptions(input);
    const rendered = await renderBrat(options);

    // La imagen es determinista: ETag estable + caché larga.
    const etag = `"${createHash('sha1').update(JSON.stringify(options)).digest('base64url')}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', `public, max-age=${config.imageCacheMaxAge}, immutable`);
    res.setHeader('Content-Type', rendered.contentType);
    res.setHeader('X-Image-Width', String(rendered.width));
    res.setHeader('X-Image-Height', String(rendered.height));
    res.setHeader('X-Image-Font-Size', String(Math.round(rendered.fontSize)));
    if (input.download) {
      res.setHeader('Content-Disposition', `attachment; filename="${bratFilename(input)}"`);
    }

    if (req.auth) {
      void store.trackUsage(req.auth.userId, `${req.method} /v1/brat`);
    }

    res.status(200).send(rendered.buffer);
  });

  const pipeline = [optionalAuth(store), rateLimit(), handler];

  router.get('/brat', ...pipeline);
  router.post('/brat', ...pipeline);
  router.get('/brat.:format', ...pipeline);
  router.post('/brat.:format', ...pipeline);

  /** Info rápida de presets y límites para la UI. */
  router.get(
    '/brat/presets',
    wrap(async (_req, res) => {
      const { BACKGROUND_PRESETS, BRAT_GREEN } = await import('../brat/render.js');
      return ok(res, {
        presets: BACKGROUND_PRESETS,
        defaults: {
          background: BRAT_GREEN,
          color: '#0A2A00',
          size: 1080,
          blur: 28,
          bold: true,
          padding: 9,
          transform: 'lower',
          align: 'center',
          lineHeight: 1.02,
          format: 'png',
          quality: 90,
        },
        limits: { size: [16, 4096], blur: [0, 100], padding: [0, 40], textLength: 240 },
      });
    })
  );

  return router;
}
