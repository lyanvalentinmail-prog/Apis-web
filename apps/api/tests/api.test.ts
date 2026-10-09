import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { MemoryStore } from '../src/stores/memory.js';

let server: Server;
let baseUrl: string;

test.before(async () => {
  const app = createApp(new MemoryStore());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  server?.close();
});

async function json<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T, headers: res.headers };
}

test('GET /v1/health responde ok', async () => {
  const { status, body } = await json<{ data: { status: string; driver: string } }>('/v1/health');
  assert.equal(status, 200);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.driver, 'memory');
});

test('GET /v1/endpoints devuelve el catálogo', async () => {
  const { status, body } = await json<{ data: { id: string; path: string }[] }>('/v1/endpoints');
  assert.equal(status, 200);
  assert.ok(body.data.length >= 10);
  assert.ok(body.data.some((e) => e.path === '/v1/brat'));
});

test('registro, login y gestión de API keys de extremo a extremo', async () => {
  const email = `ada+${Date.now()}@example.com`;

  const registered = await json<{ data: { token: string; user: { email: string } } }>('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'supersecreto123', name: 'Ada' }),
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.user.email, email);
  const session = registered.body.data.token;

  // No se puede repetir el email
  const duplicated = await json<{ error: { code: string } }>('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'otraclave123' }),
  });
  assert.equal(duplicated.status, 409);

  // Login correcto e incorrecto
  const login = await json<{ data: { token: string } }>('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'supersecreto123' }),
  });
  assert.equal(login.status, 200);

  const badLogin = await json<{ error: { code: string } }>('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'incorrecta' }),
  });
  assert.equal(badLogin.status, 401);

  // Crear key
  const created = await json<{ data: { key: string; id: string; prefix: string } }>('/v1/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
    body: JSON.stringify({ name: 'Tests' }),
  });
  assert.equal(created.status, 201);
  const apiKey = created.body.data.key;
  assert.match(apiKey, /^bsk_live_[a-f0-9]{48}$/);

  // Listar keys (enmascaradas)
  const listed = await json<{ data: { id: string; masked: string; key?: string }[] }>('/v1/keys', {
    headers: { Authorization: `Bearer ${session}` },
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  assert.ok(!listed.body.data[0].key, 'la key completa no debe volver a listarse');

  // /v1/me con la API key
  const me = await json<{ data: { via: string; user: { email: string } } }>('/v1/me', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.via, 'api_key');
  assert.equal(me.body.data.user.email, email);

  // Generar sticker con la key
  const sticker = await fetch(`${baseUrl}/v1/brat?text=brat&size=200`, { headers: { Authorization: `Bearer ${apiKey}` } });
  assert.equal(sticker.status, 200);
  assert.equal(sticker.headers.get('content-type'), 'image/png');
  assert.ok((await sticker.arrayBuffer()).byteLength > 1000);

  // Consumo registrado
  const usage = await json<{ data: { total: number } }>('/v1/me/usage?days=7', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  assert.ok(usage.body.data.total >= 1);

  // Revocar
  const revoked = await json<void>(`/v1/keys/${created.body.data.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session}` },
  });
  assert.equal(revoked.status, 204);

  const afterRevoke = await fetch(`${baseUrl}/v1/brat?text=brat`, { headers: { Authorization: `Bearer ${apiKey}` } });
  assert.equal(afterRevoke.status, 401);
});

test('la API key es obligatoria en endpoints protegidos', async () => {
  const { status, body } = await json<{ error: { code: string } }>('/v1/me');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'unauthorized');
});

test('el endpoint brat funciona sin autenticación y valida parámetros', async () => {
  const ok = await fetch(`${baseUrl}/v1/brat?text=hola&format=svg`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'image/svg+xml');

  const missing = await fetch(`${baseUrl}/v1/brat`);
  assert.equal(missing.status, 400);

  const badColor = await fetch(`${baseUrl}/v1/brat?text=hola&background=no-es-un-color!!`);
  assert.equal(badColor.status, 400);
});

test('incluye cabeceras de rate limit y caché', async () => {
  const res = await fetch(`${baseUrl}/v1/brat?text=brat&size=64`);
  assert.ok(res.headers.get('x-ratelimit-limit'));
  assert.ok(res.headers.get('x-ratelimit-remaining'));
  assert.ok(res.headers.get('etag'));
  assert.match(res.headers.get('cache-control') ?? '', /max-age=\d+/);

  // La misma petición con If-None-Match responde 304
  const etag = res.headers.get('etag')!;
  const cached = await fetch(`${baseUrl}/v1/brat?text=brat&size=64`, { headers: { 'If-None-Match': etag } });
  assert.equal(cached.status, 304);
});

test('POST /v1/brat acepta el cuerpo en JSON', async () => {
  const res = await fetch(`${baseUrl}/v1/brat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hola\nmundo', size: 300, format: 'svg' }),
  });
  assert.equal(res.status, 200);
  const svg = await res.text();
  assert.equal(svg.match(/<text /g)?.length, 2);
});

test('los endpoints inexistentes devuelven 404 con el formato de error', async () => {
  const { status, body } = await json<{ error: { code: string } }>('/v1/no-existe');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
});
