import type { ApiKey, Plan, Provider, Store, UsageDay, User } from '../lib/store-types.js';

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  provider TEXT NOT NULL DEFAULT 'password',
  provider_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_idx ON users (provider, provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last4 TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  requests BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  endpoint TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, endpoint)
);
`;

/**
 * Driver Postgres (Neon, Supabase, Vercel Postgres...).
 * Requiere `pg` instalado (dependencia opcional) y DATABASE_URL.
 */
export class PostgresStore implements Store {
  readonly driver = 'postgres';
  private pool: PgPool | null = null;
  private ready: Promise<void> | null = null;

  constructor(private readonly connectionString: string) {}

  private async pg(): Promise<PgPool> {
    if (this.pool) return this.pool;
    if (!this.connectionString) throw new Error('Falta DATABASE_URL para el driver postgres');
    const mod = (await import('pg')) as unknown as { default?: { Pool: new (o: object) => PgPool }; Pool: new (o: object) => PgPool };
    const Pool = mod.default?.Pool ?? mod.Pool;
    this.pool = new Pool({
      connectionString: this.connectionString,
      ssl: this.connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    return this.pool;
  }

  async init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const db = await this.pg();
        await db.query(SCHEMA);
      })();
    }
    return this.ready;
  }

  private static toUser(row: Record<string, unknown>): User {
    return {
      id: String(row.id),
      email: String(row.email),
      name: row.name ? String(row.name) : null,
      passwordHash: row.password_hash ? String(row.password_hash) : null,
      provider: String(row.provider ?? 'password') as Provider,
      providerId: row.provider_id ? String(row.provider_id) : null,
      plan: String(row.plan ?? 'free') as Plan,
      emailVerified: Boolean(row.email_verified),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    };
  }

  private static toKey(row: Record<string, unknown>): ApiKey {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      prefix: String(row.prefix),
      last4: String(row.last4),
      hash: String(row.hash),
      createdAt: new Date(row.created_at as string).toISOString(),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : null,
      requests: Number(row.requests ?? 0),
    };
  }

  async createUser(user: User): Promise<User> {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query(
      `INSERT INTO users (id, email, name, password_hash, provider, provider_id, plan, email_verified, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
        user.provider,
        user.providerId,
        user.plan,
        user.emailVerified,
        user.createdAt,
        user.updatedAt,
      ]
    );
    return PostgresStore.toUser(rows[0]!);
  }

  async getUserById(id: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? PostgresStore.toUser(rows[0]) : null;
  }

  async getUserByEmail(email: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
    return rows[0] ? PostgresStore.toUser(rows[0]) : null;
  }

  async getUserByProvider(provider: Provider, providerId: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM users WHERE provider = $1 AND provider_id = $2', [provider, providerId]);
    return rows[0] ? PostgresStore.toUser(rows[0]) : null;
  }

  async updateUser(id: string, patch: Partial<User>) {
    await this.init();
    const db = await this.pg();
    const map: Record<string, string> = {
      email: 'email',
      name: 'name',
      passwordHash: 'password_hash',
      provider: 'provider',
      providerId: 'provider_id',
      plan: 'plan',
      emailVerified: 'email_verified',
    };
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [];
    let i = 1;
    for (const [field, column] of Object.entries(map)) {
      const value = (patch as Record<string, unknown>)[field];
      if (value !== undefined) {
        sets.push(`${column} = $${i++}`);
        values.push(value);
      }
    }
    values.push(id);
    const { rows } = await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? PostgresStore.toUser(rows[0]) : null;
  }

  async createApiKey(key: ApiKey) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query(
      `INSERT INTO api_keys (id, user_id, name, prefix, last4, hash, created_at, last_used_at, revoked_at, requests)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [key.id, key.userId, key.name, key.prefix, key.last4, key.hash, key.createdAt, key.lastUsedAt, key.revokedAt, key.requests]
    );
    return PostgresStore.toKey(rows[0]!);
  }

  async listApiKeys(userId: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return rows.map(PostgresStore.toKey);
  }

  async getApiKeyById(userId: string, id: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM api_keys WHERE id = $1 AND user_id = $2', [id, userId]);
    return rows[0] ? PostgresStore.toKey(rows[0]) : null;
  }

  async getApiKeyByHash(hash: string) {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query('SELECT * FROM api_keys WHERE hash = $1 AND revoked_at IS NULL', [hash]);
    return rows[0] ? PostgresStore.toKey(rows[0]) : null;
  }

  async updateApiKey(id: string, patch: Partial<ApiKey>) {
    await this.init();
    const db = await this.pg();
    const map: Record<string, string> = { name: 'name', lastUsedAt: 'last_used_at', revokedAt: 'revoked_at', requests: 'requests' };
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [field, column] of Object.entries(map)) {
      const value = (patch as Record<string, unknown>)[field];
      if (value !== undefined) {
        sets.push(`${column} = $${i++}`);
        values.push(value);
      }
    }
    if (sets.length === 0) return this.getApiKeyById('', id).then((k) => k ?? null);
    values.push(id);
    const { rows } = await db.query(`UPDATE api_keys SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? PostgresStore.toKey(rows[0]) : null;
  }

  async deleteApiKey(userId: string, id: string) {
    await this.init();
    const db = await this.pg();
    const result = (await db.query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [id, userId])) as unknown as {
      rowCount?: number | null;
    };
    return (result.rowCount ?? 0) > 0;
  }

  async trackUsage(userId: string, endpoint: string) {
    await this.init();
    const db = await this.pg();
    await db.query(
      `INSERT INTO usage_daily (user_id, day, endpoint, count) VALUES ($1, CURRENT_DATE, $2, 1)
       ON CONFLICT (user_id, day, endpoint) DO UPDATE SET count = usage_daily.count + 1`,
      [userId, endpoint]
    );
  }

  async getUsage(userId: string, days: number): Promise<UsageDay[]> {
    await this.init();
    const db = await this.pg();
    const { rows } = await db.query(
      `SELECT day, endpoint, count FROM usage_daily
       WHERE user_id = $1 AND day >= CURRENT_DATE - ($2::int - 1)
       ORDER BY day ASC`,
      [userId, days]
    );
    const byDay = new Map<string, UsageDay>();
    for (const row of rows) {
      const day = new Date(row.day as string).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { day, total: 0, byEndpoint: {} };
      const count = Number(row.count ?? 0);
      entry.byEndpoint[String(row.endpoint)] = count;
      entry.total += count;
      byDay.set(day, entry);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }
}
