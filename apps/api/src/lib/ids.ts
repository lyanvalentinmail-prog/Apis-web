import { randomBytes, createHash, randomUUID } from 'node:crypto';

/** id tipo usr_/key_ legible y ordenable. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

export function uuid(): string {
  return randomUUID();
}

/** Genera una API key en texto plano: bsk_live_<32 bytes hex>. */
export function generateApiKey(): { key: string; prefix: string; last4: string; hash: string } {
  const secret = randomBytes(24).toString('hex'); // 48 chars
  const key = `bsk_live_${secret}`;
  return {
    key,
    prefix: key.slice(0, 16), // bsk_live_ + 7 chars
    last4: key.slice(-4),
    hash: hashApiKey(key),
  };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function looksLikeApiKey(value: string): boolean {
  return /^bsk_(live|test)_[a-f0-9]{32,}$/.test(value);
}
