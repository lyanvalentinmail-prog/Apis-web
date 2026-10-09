import type { ApiKey, Provider, Store, UsageDay, User } from '../lib/store-types.js';

type Cmd = (string | number)[];

/**
 * Driver para Vercel KV / Upstash Redis vía REST (sin dependencias nativas).
 * Variables: KV_REST_API_URL y KV_REST_API_TOKEN.
 */
export class KvStore implements Store {
  readonly driver = 'kv';
  private ready: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string
  ) {}

  private async cmd<T = unknown>(args: Cmd): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      throw new Error(`KV ${args[0]} falló (${res.status}): ${await res.text()}`);
    }
    const json = (await res.json()) as { result?: T; error?: string };
    if (json.error) throw new Error(`KV ${args[0]}: ${json.error}`);
    return json.result as T;
  }

  private async pipeline<T = unknown>(commands: Cmd[]): Promise<T[]> {
    if (commands.length === 0) return [];
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`KV pipeline falló (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as ({ result?: T; error?: string } | { error: string })[];
    return json.map((item) => ('result' in item ? (item.result as T) : null)) as T[];
  }

  async init(): Promise<void> {
    if (!this.ready) {
      if (!this.url || !this.token) throw new Error('Faltan KV_REST_API_URL / KV_REST_API_TOKEN');
      this.ready = this.cmd(['PING']).then(() => undefined);
    }
    return this.ready;
  }

  private key = {
    user: (id: string) => `u:id:${id}`,
    userEmail: (email: string) => `u:email:${email.trim().toLowerCase()}`,
    userProvider: (p: Provider, id: string) => `u:prov:${p}:${id}`,
    apiKey: (id: string) => `k:id:${id}`,
    keyHash: (hash: string) => `k:hash:${hash}`,
    userKeys: (userId: string) => `uk:${userId}`,
    usage: (userId: string, day: string) => `us:${userId}:${day}`,
  };

  private async readUser(id: string | null): Promise<User | null> {
    if (!id) return null;
    const raw = await this.cmd<string | null>(['GET', this.key.user(String(id))]);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  async createUser(user: User): Promise<User> {
    await this.init();
    await this.pipeline([
      ['SET', this.key.user(user.id), JSON.stringify(user)],
      ['SET', this.key.userEmail(user.email), user.id],
      ...(user.providerId ? [['SET', this.key.userProvider(user.provider, user.providerId), user.id]] : []),
    ]);
    return user;
  }

  async getUserById(id: string) {
    await this.init();
    return this.readUser(id);
  }

  async getUserByEmail(email: string) {
    await this.init();
    return this.readUser(await this.cmd<string | null>(['GET', this.key.userEmail(email)]));
  }

  async getUserByProvider(provider: Provider, providerId: string) {
    await this.init();
    return this.readUser(await this.cmd<string | null>(['GET', this.key.userProvider(provider, providerId)]));
  }

  async updateUser(id: string, patch: Partial<User>) {
    await this.init();
    const current = await this.readUser(id);
    if (!current) return null;
    const next: User = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    await this.cmd(['SET', this.key.user(id), JSON.stringify(next)]);
    if (patch.email && patch.email !== current.email) {
      await this.pipeline([
        ['DEL', this.key.userEmail(current.email)],
        ['SET', this.key.userEmail(next.email), id],
      ]);
    }
    return next;
  }

  async createApiKey(key: ApiKey) {
    await this.init();
    await this.pipeline([
      ['SET', this.key.apiKey(key.id), JSON.stringify(key)],
      ['SET', this.key.keyHash(key.hash), key.id],
      ['SADD', this.key.userKeys(key.userId), key.id],
    ]);
    return key;
  }

  async listApiKeys(userId: string) {
    await this.init();
    const ids = (await this.cmd<string[]>(['SMEMBERS', this.key.userKeys(userId)])) ?? [];
    if (ids.length === 0) return [];
    const raws = await this.pipeline<string | null>(ids.map((id) => ['GET', this.key.apiKey(id)]));
    return raws
      .filter((r): r is string => Boolean(r))
      .map((r) => JSON.parse(r) as ApiKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getApiKeyById(userId: string, id: string) {
    await this.init();
    const raw = await this.cmd<string | null>(['GET', this.key.apiKey(id)]);
    const key = raw ? (JSON.parse(raw) as ApiKey) : null;
    return key && key.userId === userId ? key : null;
  }

  async getApiKeyByHash(hash: string) {
    await this.init();
    const id = await this.cmd<string | null>(['GET', this.key.keyHash(hash)]);
    if (!id) return null;
    const raw = await this.cmd<string | null>(['GET', this.key.apiKey(id)]);
    const key = raw ? (JSON.parse(raw) as ApiKey) : null;
    return key && !key.revokedAt ? key : null;
  }

  async updateApiKey(id: string, patch: Partial<ApiKey>) {
    await this.init();
    const raw = await this.cmd<string | null>(['GET', this.key.apiKey(id)]);
    if (!raw) return null;
    const next: ApiKey = { ...(JSON.parse(raw) as ApiKey), ...patch, id };
    await this.cmd(['SET', this.key.apiKey(id), JSON.stringify(next)]);
    return next;
  }

  async deleteApiKey(userId: string, id: string) {
    await this.init();
    const key = await this.getApiKeyById(userId, id);
    if (!key) return false;
    await this.pipeline([
      ['DEL', this.key.apiKey(id)],
      ['DEL', this.key.keyHash(key.hash)],
      ['SREM', this.key.userKeys(userId), id],
    ]);
    return true;
  }

  async trackUsage(userId: string, endpoint: string) {
    await this.init();
    const day = new Date().toISOString().slice(0, 10);
    const k = this.key.usage(userId, day);
    await this.pipeline([
      ['HINCRBY', k, endpoint, 1],
      ['EXPIRE', k, 60 * 60 * 24 * 90],
    ]);
  }

  async getUsage(userId: string, days: number): Promise<UsageDay[]> {
    await this.init();
    const keys: { day: string; key: string }[] = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      keys.push({ day, key: this.key.usage(userId, day) });
    }
    const results = await this.pipeline<(string | number)[] | null>(keys.map((k) => ['HGETALL', k.key]));
    return keys.map((k, i) => {
      const flat = results[i] ?? [];
      const byEndpoint: Record<string, number> = {};
      for (let j = 0; j < flat.length; j += 2) {
        byEndpoint[String(flat[j])] = Number(flat[j + 1] ?? 0);
      }
      return { day: k.day, byEndpoint, total: Object.values(byEndpoint).reduce((a, b) => a + b, 0) };
    });
  }
}
