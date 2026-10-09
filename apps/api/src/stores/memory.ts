import type { ApiKey, Provider, Store, UsageDay, User } from '../lib/store-types.js';

/** Driver en memoria: útil para tests y como red de seguridad cuando no hay disco escribible. */
export class MemoryStore implements Store {
  readonly driver = 'memory';
  private users = new Map<string, User>();
  private keys = new Map<string, ApiKey>();
  private usage = new Map<string, Record<string, number>>();

  async init(): Promise<void> {}

  async createUser(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return user;
  }

  async getUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string) {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) return user;
    }
    return null;
  }

  async getUserByProvider(provider: Provider, providerId: string) {
    for (const user of this.users.values()) {
      if (user.provider === provider && user.providerId === providerId) return user;
    }
    return null;
  }

  async updateUser(id: string, patch: Partial<User>) {
    const current = this.users.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() };
    this.users.set(id, next);
    return next;
  }

  async createApiKey(key: ApiKey) {
    this.keys.set(key.id, { ...key });
    return key;
  }

  async listApiKeys(userId: string) {
    return [...this.keys.values()]
      .filter((k) => k.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getApiKeyById(userId: string, id: string) {
    const key = this.keys.get(id);
    return key && key.userId === userId ? key : null;
  }

  async getApiKeyByHash(hash: string) {
    for (const key of this.keys.values()) {
      if (key.hash === hash) return key;
    }
    return null;
  }

  async updateApiKey(id: string, patch: Partial<ApiKey>) {
    const current = this.keys.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id };
    this.keys.set(id, next);
    return next;
  }

  async deleteApiKey(userId: string, id: string) {
    const key = this.keys.get(id);
    if (!key || key.userId !== userId) return false;
    this.keys.delete(id);
    return true;
  }

  async trackUsage(userId: string, endpoint: string) {
    const day = new Date().toISOString().slice(0, 10);
    const id = `${userId}:${day}`;
    const current = this.usage.get(id) ?? {};
    current[endpoint] = (current[endpoint] ?? 0) + 1;
    this.usage.set(id, current);
  }

  async getUsage(userId: string, days: number): Promise<UsageDay[]> {
    const out: UsageDay[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const byEndpoint = this.usage.get(`${userId}:${d}`) ?? {};
      const total = Object.values(byEndpoint).reduce((a, b) => a + b, 0);
      out.push({ day: d, total, byEndpoint });
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }
}
