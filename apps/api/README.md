# @apis-web/api

API REST para generar stickers estilo Brat. Express 5 + TypeScript, sin servicios externos
obligatorios. La documentación completa y las instrucciones de deploy están en el
[README del repositorio](../../README.md).

```bash
npm run dev        # http://localhost:4000
npm test           # 19 tests
npm run build      # dist/
```

## Endpoints

`GET /v1/health` · `GET /v1/endpoints` · `GET /v1/openapi.json` · `POST /v1/auth/register` ·
`POST /v1/auth/login` · `GET /v1/auth/providers` · `GET /v1/auth/oauth/:provider` ·
`GET /v1/me` · `GET /v1/me/usage` · `GET|POST /v1/keys` · `DELETE /v1/keys/:id` ·
`GET|POST /v1/brat`

Ejemplo:

```bash
curl "http://localhost:4000/v1/brat?text=brat&size=512" -o brat.png
```

## Variables de entorno

Copia `.env.example` como `.env`. Las más importantes:

| Variable | Uso |
|---|---|
| `PORT` | Puerto local (4000) |
| `API_BASE_URL` | URL pública (CORS, cookies, OAuth) |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma |
| `AUTH_SECRET` | Firma sesiones JWT y el state de OAuth |
| `STORE_DRIVER` | `memory` · `file` · `kv` · `postgres` (auto por defecto) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash |
| `DATABASE_URL` | Postgres (requiere `npm i pg`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth GitHub |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |

## Cómo funciona el generador

1. `brat/schema.ts` valida y normaliza los parámetros (zod), con alias cortos (`t`, `s`, `bg`…).
2. `brat/render.ts` mide el texto con las tablas de avance de Arial (`brat/fonts.ts`), calcula el
   tamaño de fuente que mejor encaja y centra el bloque de tinta real.
3. Se construye un SVG con `feGaussianBlur` y se rasteriza con **resvg** (PNG); **sharp** convierte
   a JPEG/WebP cuando se piden. En `format=svg` se devuelve el SVG tal cual.

Las fuentes (Liberation Sans, métricas compatibles con Arial) se copian a `assets/fonts` en el
`postinstall`, así el render es idéntico en local y en Vercel.
