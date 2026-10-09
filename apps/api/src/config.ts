import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/** En Vercel el sistema de archivos es de solo lectura: usamos /tmp para el driver "file". */
function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'apis-web-data');
  return path.join(here, '..', '.data');
}

export const config = {
  env: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: int(process.env.PORT, 4000),

  /** URL pública de la API (se usa en CORS, cookies y respuestas). */
  baseUrl: process.env.API_BASE_URL ?? process.env.PUBLIC_API_URL ?? `http://localhost:${int(process.env.PORT, 4000)}`,

  /** Orígenes permitidos para el navegador (separados por coma). */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Secreto para firmar sesiones (JWT). Imprescindible en producción. */
  authSecret: process.env.AUTH_SECRET ?? 'dev-only-insecure-secret-change-me',

  /** Duración de la sesión de la web (segundos). */
  sessionTtl: int(process.env.SESSION_TTL, 60 * 60 * 24 * 30),

  /** Driver de persistencia: memory | file | kv | postgres (auto por defecto). */
  storeDriver: (process.env.STORE_DRIVER ?? 'auto') as 'auto' | 'memory' | 'file' | 'kv' | 'postgres',
  dataDir: dataDir(),

  /** Upstash Redis / Vercel KV (REST). */
  kv: {
    url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '',
    token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  },

  /** Postgres (Neon, Supabase, Vercel Postgres...). */
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '',

  /** Límites por plan (peticiones por minuto y al día). "anon" = sin autenticar. */
  rateLimit: {
    anon: { perMinute: int(process.env.RATE_LIMIT_ANON_MINUTE, 30), perDay: int(process.env.RATE_LIMIT_ANON_DAY, 1000) },
    free: { perMinute: int(process.env.RATE_LIMIT_FREE_MINUTE, 60), perDay: int(process.env.RATE_LIMIT_FREE_DAY, 5000) },
    pro: { perMinute: int(process.env.RATE_LIMIT_PRO_MINUTE, 600), perDay: int(process.env.RATE_LIMIT_PRO_DAY, 500_000) },
  },

  /** OAuth (opcional). Si faltan las variables, las rutas responden 501. */
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      enabled: bool(process.env.OAUTH_GITHUB_ENABLED) || Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      enabled: bool(process.env.OAUTH_GOOGLE_ENABLED) || Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },

  /** Redirección tras completar OAuth en la web. */
  webUrl: process.env.WEB_URL ?? process.env.VITE_WEB_URL ?? 'http://localhost:5173',

  /** Cache HTTP de las imágenes generadas (segundos). */
  imageCacheMaxAge: int(process.env.IMAGE_CACHE_MAX_AGE, 60 * 60 * 24 * 7),

  trustProxy: bool(process.env.TRUST_PROXY, true),

  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;

export type Config = typeof config;

export const isVercel = Boolean(process.env.VERCEL);
