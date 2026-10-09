import type { ApiKeyInfo, BratParams, EndpointDoc, UsageDay, User } from '../types';

/**
 * URL base de la API.
 * - En local: Vite hace proxy de /api -> http://localhost:4000 (ver vite.config.ts).
 * - En producción: define VITE_API_URL=https://tu-api.vercel.app/v1
 */
export const API_URL: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1').replace(/\/$/, '');

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

interface ApiResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (res.status === 204) {
    return { data: undefined as T, status: res.status, headers: res.headers };
  }

  const text = await res.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? 'request_failed',
      error?.message ?? `Error ${res.status}`,
      error?.details
    );
  }

  return { data: (payload as { data?: T })?.data as T, status: res.status, headers: res.headers };
}

export const api = {
  health: () => request<{ status: string; driver: string; version: string }>('/health'),
  endpoints: () => request<EndpointDoc[]>('/endpoints'),
  providers: () => request<{ password: boolean; github: boolean; google: boolean }>('/auth/providers'),

  register: (payload: { email: string; password: string; name?: string }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: payload }),

  me: (token: string) =>
    request<{ user: User; via: string; plan: string; limits: { perMinute: number; perDay: number } }>('/me', { token }),

  usage: (token: string, days = 30) =>
    request<{ days: UsageDay[]; total: number; limit: { perMinute: number; perDay: number } }>(`/me/usage?days=${days}`, { token }),

  listKeys: (token: string) => request<ApiKeyInfo[]>('/keys', { token }),
  createKey: (token: string, name: string) => request<ApiKeyInfo>('/keys', { method: 'POST', body: { name }, token }),
  deleteKey: (token: string, id: string) => request<void>(`/keys/${id}`, { method: 'DELETE', token }),
};

/* ------------------------------------------------------------------ */
/* Sticker Brat                                                        */
/* ------------------------------------------------------------------ */

export function bratQuery(params: BratParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}

/** URL pública del sticker (solo válida sin API key, o con key si se pasa por header). */
export function bratUrl(params: BratParams): string {
  return `${API_URL}/brat?${bratQuery(params)}`;
}

export interface BratImage {
  blob: Blob;
  url: string;
  contentType: string;
  status: number;
  width: number;
  height: number;
  ms: number;
}

/** Descarga el sticker como blob (permite enviar la API key por header). */
export async function fetchBrat(params: BratParams, token?: string | null): Promise<BratImage> {
  const started = performance.now();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(bratUrl(params), { headers });
  const contentType = res.headers.get('content-type') ?? 'image/png';

  if (!res.ok) {
    const detail = contentType.includes('json') ? ((await res.json()) as { error?: { message?: string } }) : null;
    throw new ApiRequestError(res.status, 'brat_failed', detail?.error?.message ?? `Error ${res.status} al generar el sticker`);
  }

  const blob = await res.blob();
  return {
    blob,
    url: URL.createObjectURL(blob),
    contentType,
    status: res.status,
    width: Number(res.headers.get('x-image-width') ?? 0),
    height: Number(res.headers.get('x-image-height') ?? 0),
    ms: Math.round(performance.now() - started),
  };
}

export function downloadBrat(params: BratParams, filename?: string) {
  const link = document.createElement('a');
  link.href = bratUrl({ ...params, download: true } as BratParams);
  link.download =
    filename ??
    `brat-${(params.text || 'sticker').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'sticker'}.${params.format ?? 'png'}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
