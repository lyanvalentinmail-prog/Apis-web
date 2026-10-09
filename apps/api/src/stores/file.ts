import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ApiKey, Provider, Store, UsageDay, User } from '../lib/store-types.js';

interface DbShape {
  users: User[];
  keys: ApiKey[];
  usage: Record<string, Record<string, number>>;
}

const EMPTY: DbShape = { users: [], keys: [], usage: {} };

/**
 * Driver de archivo JSON. En local guarda en apps/api/.data/db.json.
 * En Vercel (sistema de archivos efímero) usa /tmp: funciona, pero los datos
 * no persisten entre despliegues ni entre regiones. Para producción real usa
 * los drivers "kv" o "postgres".
 */
export class FileStore implements Store {
  readonly driver = 'file';
  private db: DbShape = { ...EMPTY };
  private loaded = false;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, 'db.json');
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      await mkdir(this.dir, { recursive: true });
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DbShape>;
      this.db = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        keys: Array.isArray(parsed.keys) ? parsed.keys : [],
        usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code && code !== 'ENOENT') {
        console.warn(`[store:file] no se pudo leer ${this.file} (${code}); se empieza vacío`);
      }
      this.db = { users: [], keys: [], usage: {} };
    }
  }

  /** Escrituras serializadas + atómicas (tmp + rename). */
  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.db);
    this.writing = this.writing
      .then(async () => {
        await mkdir(this.dir, { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        await writeFile(tmp, snapshot, 'utf8');
        await rename(tmp, this.file);
      })
      .catch((err) => {
        console.warn('[store:file] no se pudo persistir:', (err as Error).message);
      });
    return this.writing;
  }

  async createUser(user: User): Promise<User> {
    await this.init();
    this.db.users.push({ ...user });
    await this.persist();
    return user;
  }

  async getUserById(id: string) {
    await this.init();
    return this.db.users.find((u) => u.id === id) ?? null;
  }

  async getUserByEmail(email: string) {
    await this.init();
    const target = email.trim().toLowerCase();
    return this.db.users.find((u) => u.email.toLowerCase() === target) ?? null;
  }

  async getUserByProvider(provider: Provider, providerId: string) {
    await this.init();
    return this.db.users.find((u) => u.provider === provider && u.providerId === providerId) ?? null;
  }

  async updateUser(id: string, patch: Partial<User>) {
    await this.init();
    const index = this.db.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    const next: User = { ...this.db.users[index], ...patch, id, updatedAt: new Date().toISOString() };
    this.db.users[index] = next;
    await this.persist();
    return next;
  }

  async createApiKey(key: ApiKey) {
    await this.init();
    this.db.keys.push({ ...key });
    await this.persist();
    return key;
  }

  async listApiKeys(userId: string) {
    await this.init();
    return this.db.keys
      .filter((k) => k.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((k) => ({ ...k }));
  }

  async getApiKeyById(userId: string, id: string) {
    await this.init();
    return this.db.keys.find((k) => k.id === id && k.userId === userId) ?? null;
  }

  async getApiKeyByHash(hash: string) {
    await this.init();
    return this.db.keys.find((k) => k.hash === hash && !k.revokedAt) ?? null;
  }

  async updateApiKey(id: string, patch: Partial<ApiKey>) {
    await this.init();
    const index = this.db.keys.findIndex((k) => k.id === id);
    if (index === -1) return null;
    const next: ApiKey = { ...this.db.keys[index], ...patch, id };
    this.db.keys[index] = next;
    await this.persist();
    return next;
  }

  async deleteApiKey(userId: string, id: string) {
    await this.init();
    const index = this.db.keys.findIndex((k) => k.id === id && k.userId === userId);
    if (index === -1) return false;
    this.db.keys.splice(index, 1);
    await this.persist();
    return true;
  }

  async trackUsage(userId: string, endpoint: string) {
    await this.init();
    const day = new Date().toISOString().slice(0, 10);
    const id = `${userId}:${day}`;
    this.db.usage[id] = this.db.usage[id] ?? {};
    this.db.usage[id][endpoint] = (this.db.usage[id][endpoint] ?? 0) + 1;
    // No persistimos en cada petición: se vuelca cada 25 para no castigar el disco.
    if (Object.values(this.db.usage[id]).reduce((a, b) => a + b, 0) % 25 === 0) {
      await this.persist();
    }
  }

  async getUsage(userId: string, days: number): Promise<UsageDay[]> {
    await this.init();
    const out: UsageDay[] = [];
    for (let i = 0; i < days; i += 1) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const byEndpoint = { ...(this.db.usage[`${userId}:${day}`] ?? {}) };
      out.push({ day, byEndpoint, total: Object.values(byEndpoint).reduce((a, b) => a + b, 0) });
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }
}
