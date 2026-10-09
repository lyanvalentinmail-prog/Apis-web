import { config } from './config.js';
import type { ApiKey, Store, UsageDay, User } from './lib/store-types.js';
import { MemoryStore } from './stores/memory.js';
import { FileStore } from './stores/file.js';
import { KvStore } from './stores/kv.js';
import { PostgresStore } from './stores/postgres.js';

export type { ApiKey, Store, UsageDay, User };

/**
 * Elige el driver automáticamente:
 *  1. STORE_DRIVER explícito
 *  2. Postgres  -> DATABASE_URL / POSTGRES_URL
 *  3. Vercel KV -> KV_REST_API_URL + KV_REST_API_TOKEN
 *  4. Archivo JSON en local (o /tmp en Vercel)
 *  5. Memoria si no se puede escribir en disco
 */
export function createStore(): Store {
  const wanted = config.storeDriver;

  if (wanted === 'memory') return new MemoryStore();
  if (wanted === 'file') return new FileStore(config.dataDir);
  if (wanted === 'kv') return new KvStore(config.kv.url, config.kv.token);
  if (wanted === 'postgres') return new PostgresStore(config.databaseUrl);

  if (config.databaseUrl) return new PostgresStore(config.databaseUrl);
  if (config.kv.url && config.kv.token) return new KvStore(config.kv.url, config.kv.token);
  return new FileStore(config.dataDir);
}

export const store: Store = createStore();

let ready: Promise<Store> | null = null;

/** init() idempotente: en serverless se reutiliza entre invocaciones del mismo contenedor. */
export function initStore(): Promise<Store> {
  if (!ready) {
    ready = store.init().then(() => store);
  }
  return ready;
}
