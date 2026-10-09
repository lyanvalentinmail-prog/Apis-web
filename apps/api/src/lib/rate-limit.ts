import type { RequestHandler } from 'express';
import { config } from '../config.js';
import type { Plan } from './store-types.js';
import { ApiError } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, Bucket>();

/** Ventana fija en memoria por instancia (en serverless es "best effort"). */
function memoryHit(id: string, limit: number, windowMs: number): { count: number; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = memoryBuckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    memoryBuckets.set(id, fresh);
    if (memoryBuckets.size > 10_000) {
      for (const [k, v] of memoryBuckets) if (v.resetAt < now) memoryBuckets.delete(k);
    }
    return { count: 1, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  bucket.count += 1;
  return { count: bucket.count, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

/** Ventana fija en Upstash/Vercel KV cuando está configurado (compartida entre instancias). */
async function kvHit(id: string, limit: number, windowMs: number) {
  const { url, token } = config.kv;
  const key = `rl:${id}`;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, windowMs, 'NX'],
      ['PTTL', key],
    ]),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { result: number }[];
  const count = Number(json[0]?.result ?? 1);
  const ttl = Number(json[2]?.result ?? windowMs);
  return { count, remaining: Math.max(0, limit - count), resetAt: Date.now() + Math.max(ttl, 0) };
}

export interface RateLimitOptions {
  /** Límite por minuto; si se omite se usa el del plan. */
  perMinute?: number;
  /** Identificador estable (por defecto: id de key o IP). */
  keyOf?: (req: Parameters<RequestHandler>[0]) => string;
}

/**
 * Limitador por minuto. El identificador es la API key, el usuario o la IP.
 * El límite sale del plan (free/pro) salvo override.
 */
export function rateLimit(options: RateLimitOptions = {}): RequestHandler {
  return (req, res, next) => {
    (async () => {
      const plan: Plan | 'anon' = req.auth?.plan ?? 'anon';
      const limit = options.perMinute ?? config.rateLimit[plan].perMinute;
      const id = `${options.keyOf ? options.keyOf(req) : (req.auth?.apiKey?.id ?? req.auth?.userId ?? clientIp(req))}`;
      const windowMs = 60_000;

      const result = config.kv.url && config.kv.token
        ? await kvHit(`${id}:${Math.floor(Date.now() / windowMs)}`, limit, windowMs)
        : memoryHit(`${id}:${Math.floor(Date.now() / windowMs)}`, limit, windowMs);

      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

      if (result.count > limit) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        throw ApiError.tooManyRequests(`Has superado el límite de ${limit} peticiones/minuto del plan ${plan}`, {
          limit,
          retryAfter,
        });
      }
      next();
    })().catch(next);
  };
}

export function clientIp(req: Parameters<RequestHandler>[0]): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.ip || req.socket?.remoteAddress || 'unknown';
}
