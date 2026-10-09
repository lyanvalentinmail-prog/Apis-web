export type Plan = 'free' | 'pro';
export type Provider = 'password' | 'github' | 'google';

export interface User {
  id: string;
  email: string;
  name: string | null;
  /** null cuando el usuario se registró solo con OAuth. */
  passwordHash: string | null;
  provider: Provider;
  providerId: string | null;
  plan: Plan;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  last4: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  requests: number;
}

export interface UsageDay {
  /** YYYY-MM-DD */
  day: string;
  total: number;
  byEndpoint: Record<string, number>;
}

export interface Store {
  readonly driver: string;
  init(): Promise<void>;

  // Usuarios
  createUser(user: User): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByProvider(provider: Provider, providerId: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User | null>;

  // API keys
  createApiKey(key: ApiKey): Promise<ApiKey>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyById(userId: string, id: string): Promise<ApiKey | null>;
  /** Búsqueda por hash sha256 (usada en cada petición autenticada). */
  getApiKeyByHash(hash: string): Promise<ApiKey | null>;
  updateApiKey(id: string, patch: Partial<ApiKey>): Promise<ApiKey | null>;
  deleteApiKey(userId: string, id: string): Promise<boolean>;

  // Uso / estadísticas
  trackUsage(userId: string, endpoint: string): Promise<void>;
  getUsage(userId: string, days: number): Promise<UsageDay[]>;
}
