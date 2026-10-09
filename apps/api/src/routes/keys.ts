import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { created, noContent, ok, wrap } from '../lib/http.js';
import { generateApiKey, newId } from '../lib/ids.js';
import { maskedKey, publicApiKey, requireSession } from '../lib/auth.js';
import type { Store } from '../lib/store-types.js';

const MAX_KEYS_PER_USER = 25;

const createSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
});

export function createKeyRoutes(store: Store) {
  const router = Router();
  router.use(requireSession(store));

  router.get(
    '/',
    wrap(async (req, res) => {
      const keys = await store.listApiKeys(req.auth!.userId);
      return ok(
        res,
        keys.map((key) => ({ ...publicApiKey(key), masked: maskedKey(key) }))
      );
    })
  );

  router.post(
    '/',
    wrap(async (req, res) => {
      const parsed = createSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw ApiError.badRequest('Nombre inválido');

      const existing = await store.listApiKeys(req.auth!.userId);
      if (existing.length >= MAX_KEYS_PER_USER) {
        throw ApiError.badRequest(`Máximo ${MAX_KEYS_PER_USER} API keys por cuenta. Revoca alguna antes de crear otra.`);
      }

      const { key, prefix, last4, hash } = generateApiKey();
      const record = await store.createApiKey({
        id: newId('key'),
        userId: req.auth!.userId,
        name: parsed.data.name ?? `Key ${existing.length + 1}`,
        prefix,
        last4,
        hash,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        revokedAt: null,
        requests: 0,
      });

      // Ojo: el valor en claro solo viaja en esta respuesta.
      return created(res, { ...publicApiKey(record), key });
    })
  );

  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const userId = req.auth!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const key = await store.getApiKeyById(userId, String(id ?? ''));
      if (!key) throw ApiError.notFound('API key no encontrada');
      await store.updateApiKey(key.id, { revokedAt: new Date().toISOString() });
      await store.deleteApiKey(userId, key.id);
      return noContent(res);
    })
  );

  return router;
}
