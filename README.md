# Brat Sticker API + Web

Plantilla full-stack **funcional** para crear stickers estilo *brat* por HTTP: API REST con generación
real de imágenes + web con registro, documentación automática y gestión de API keys.

Todo en **un mismo repositorio** (monorepo con npm workspaces) y lista para **Vercel**.

```
apps/api   →  API REST (Express 5 + TypeScript) con el generador Brat
apps/web   →  Web (Vite + React 19 + Tailwind v4) con registro, docs y panel de API keys
```

---

## ✨ Qué hace

| | |
|---|---|
| 🎨 **Generador Brat** | SVG generado a medida y rasterizado a **PNG / JPEG / WebP**. Tipografía métrica Arial/Helvetica (Liberation Sans), ajuste automático del texto al lienzo, desenfoque configurable, presets de color, esquinas redondeadas. |
| 🔐 **Registro y login** | Email + contraseña con **scrypt** y sesión JWT. **GitHub y Google OAuth** listos para activar con dos variables de entorno. |
| 🔑 **API keys** | `bsk_live_…` con hash SHA-256, enmascaradas en el panel, revocables al instante. |
| 📚 **Documentación viva** | La web lee `GET /v1/endpoints` del backend: si añades un endpoint, aparece en la documentación y en el explorador. |
| 🧪 **Explorador** | Prueba cualquier endpoint desde el navegador, con API key o con tu sesión. |
| 🗄️ **Persistencia intercambiable** | JSON en local (funciona sin configurar nada), **Vercel KV / Upstash** o **Postgres**, según las variables de entorno. |
| 🚦 **Límites y métricas** | Rate limit por minuto según plan, cabeceras `X-RateLimit-*`, ETag + `Cache-Control: immutable` y consumo diario por endpoint. |

---

## 🚀 Inicio rápido

```bash
git clone <tu-repo> apis-web && cd apis-web
npm install          # instala API y web (workspaces) y copia las fuentes
npm run dev          # API en :4000 · Web en :5173
```

- Web: <http://localhost:5173>
- API: <http://localhost:4000/v1/health>
- Prueba rápida: <http://localhost:4000/v1/brat?text=brat&size=512>

> En local la web llama a `/api/v1/...` y Vite hace proxy a la API (ver `apps/web/vite.config.ts`).

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | API (`:4000`) y web (`:5173`) en paralelo |
| `npm run build` | Compila la API (`tsc`) y la web (`vite build`) |
| `npm test` | Tests de la API (node:test + tsx) |
| `npm run typecheck` | TypeScript sin emitir en ambos paquetes |

---

## 📡 Endpoints

Base URL: `https://<tu-api>.vercel.app/v1`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | – | Estado del servicio y driver de persistencia |
| GET | `/endpoints` | – | Catálogo completo (lo consume la web) |
| GET | `/openapi.json` | – | Especificación OpenAPI 3.1 |
| POST | `/auth/register` | – | Crear cuenta → token de sesión |
| POST | `/auth/login` | – | Iniciar sesión → token de sesión |
| GET | `/auth/providers` | – | Qué métodos de login están activos |
| GET | `/auth/oauth/github` | – | Iniciar OAuth (también `/google`) |
| GET | `/me` | key/sesión | Perfil, plan y límites |
| GET | `/me/usage` | key/sesión | Consumo por día y endpoint |
| GET/POST | `/keys` | sesión | Listar / crear API keys |
| DELETE | `/keys/:id` | sesión | Revocar una key |
| GET/POST | `/brat` | opcional | **Generar el sticker** |

### Generar un sticker

```bash
# PNG (por defecto)
curl "https://TU-API.vercel.app/v1/brat?text=brat&size=1080" -o brat.png

# SVG multilínea, fondo rosa, con tu API key
curl "https://TU-API.vercel.app/v1/brat?text=hola%0Amundo&background=pink&format=svg" \
  -H "Authorization: Bearer bsk_live_TU_KEY" -o sticker.svg
```

**Parámetros de `/v1/brat`**

| Parámetro | Por defecto | Rango / valores | Descripción |
|---|---|---|---|
| `text` | *(obligatorio)* | hasta 240 car. | Texto; usa `\n` (o `%0A`) para saltos de línea |
| `size` | `1080` | 16–4096 | Lado del cuadrado en px |
| `width` / `height` | – | 16–4096 | Tamaño rectangular personalizado |
| `background` | `brat` | hex o preset | `brat, lime, white, black, cream, pink, blue, purple, orange, red` |
| `color` | `#0A2A00` | hex | Color del texto |
| `blur` | `28` | 0–100 | Desenfoque (0 = nítido) |
| `bold` / `italic` | `true` / `false` | booleano | Estilo de la tipografía |
| `transform` | `lower` | `lower·upper·none` | Mayúsculas/minúsculas |
| `align` | `center` | `left·center·right` | Alineación horizontal |
| `padding` | `9` | 0–40 | Margen interior en % del lado corto |
| `radius` | `0` | px | Esquinas redondeadas |
| `lineHeight` | `1.02` | 0.6–3 | Interlineado |
| `tracking` | `0` | −0.5–1 | Espaciado entre letras (em) |
| `fontSize` | auto | px | Fija el tamaño de fuente |
| `format` | `png` | `png·svg·jpeg·webp` | Formato de salida |
| `quality` | `90` | 1–100 | Calidad para jpeg/webp |
| `download` | `false` | booleano | Fuerza la descarga |

Atajos: `t` = `text`, `s` = `size`, `w`/`h`, `bg` = `background`, `fg` = `color`, `fmt` = `format`.

---

## ☁️ Desplegar en Vercel

El repo tiene dos apps, así que se crean **dos proyectos de Vercel** desde el mismo repositorio
( puedes hacerlo tantas veces como quieras: *Add New → Project → Import* ).

### 1. Proyecto de la API

| Ajuste | Valor |
|---|---|
| **Root Directory** | `apps/api` |
| **Framework Preset** | Other |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (por defecto) |

Variables de entorno (**Settings → Environment Variables**):

```env
AUTH_SECRET=            # obligatorio: openssl rand -base64 48
API_BASE_URL=https://tu-api.vercel.app
CORS_ORIGINS=https://tu-web.vercel.app
STORE_DRIVER=file       # o kv / postgres (ver abajo)
WEB_URL=https://tu-web.vercel.app
```

Tras el primer deploy, **copia la URL del proyecto** (por ejemplo `https://apis-web-api.vercel.app`).

### 2. Proyecto de la web

| Ajuste | Valor |
|---|---|
| **Root Directory** | `apps/web` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

Variables de entorno (**se leen en tiempo de build**):

```env
VITE_API_URL=https://tu-api.vercel.app/v1
```

> ⚠️ `VITE_API_URL` se compila dentro del bundle: después de cambiarla hay que **redeployear** la web.

### 3. Persistencia en producción

El driver `file` funciona en Vercel (escribe en `/tmp`), pero los datos son **efímeros**: se pierden
entre despliegues y no se comparten entre regiones. Para algo duradero elige una de estas:

**Opción A — Vercel KV / Upstash (recomendada, sin migraciones)**

1. En Vercel: *Storage → Create Database → KV* y conéctala al proyecto de la API.
2. Vercel inyecta `KV_REST_API_URL` y `KV_REST_API_TOKEN`. La API los detecta automáticamente
   (o fija `STORE_DRIVER=kv`).

**Opción B — Postgres (Neon, Supabase, Vercel Postgres)**

```bash
npm i pg --workspace @apis-web/api     # dependencia opcional
```

```env
STORE_DRIVER=postgres
DATABASE_URL=postgres://usuario:clave@host/db?sslmode=require
```

Las tablas se crean solas en el primer arranque (`users`, `api_keys`, `usage_daily`).

### 4. Activar OAuth (opcional)

**GitHub** → <https://github.com/settings/developers> · Authorization callback URL:
`https://TU-API.vercel.app/v1/auth/oauth/github/callback`

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

**Google** → <https://console.cloud.google.com/apis/credentials> · Authorized redirect URI:
`https://TU-API.vercel.app/v1/auth/oauth/google/callback`

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Si no defines estas variables, los botones de OAuth simplemente no aparecen.

---

## 🧱 Estructura

```
.
├── apps/
│   ├── api/
│   │   ├── api/index.ts        # entrada serverless para Vercel
│   │   ├── assets/fonts/       # Liberation Sans (métricas Arial) para el render
│   │   ├── src/
│   │   │   ├── app.ts          # Express: CORS, JSON, rutas y errores
│   │   │   ├── config.ts       # variables de entorno centralizadas
│   │   │   ├── catalog.ts      # catálogo de endpoints (alimenta /v1/endpoints y la web)
│   │   │   ├── brat/           # fonts.ts · render.ts · schema.ts (generador)
│   │   │   ├── lib/            # auth (scrypt+JWT) · rate-limit · errors · ids
│   │   │   ├── routes/         # meta · auth · oauth · keys · brat
│   │   │   └── stores/         # memory · file · kv · postgres
│   │   └── vercel.json
│   └── web/
│       ├── src/
│       │   ├── lib/api.ts      # cliente HTTP + helpers del sticker
│       │   ├── lib/auth.tsx    # contexto de sesión (localStorage + JWT)
│       │   ├── components/     # Layout · BratStudio · CodeBlock · ui
│       │   └── pages/          # Home · Docs · Endpoints · Login · Register · Panel
│       └── vercel.json
├── scripts/postinstall.mjs     # copia las fuentes TTF desde node_modules
└── package.json                # workspaces
```

---

## 🔒 Seguridad y producción

- Cambia `AUTH_SECRET` en cuanto despliegues (firma las sesiones JWT y el `state` de OAuth).
- Las contraseñas se guardan con **scrypt** (N=16384) y las API keys solo como **hash SHA-256**.
- Define `CORS_ORIGINS` con el dominio de tu web en producción.
- Los límites por defecto: 40 req/min sin key, 120 con cuenta free, 600 en pro
  (`RATE_LIMIT_ANON_MINUTE`, `RATE_LIMIT_FREE_MINUTE`, `RATE_LIMIT_PRO_MINUTE`).
- Errores con forma estable: `{ "error": { "code", "message", "details" } }`.

---

## ✅ Tests

```bash
npm test          # 19 tests: render Brat, ajuste de texto, centrado y flujo completo de la API
```

Incluye tests de integración que levantan la app con un store en memoria y recorren
registro → login → creación de key → generación de sticker → consumo → revocación.

---

## 📄 Licencia

MIT. Las fuentes Liberation Sans (paquete `@typopro/dtp-liberation`) se distribuyen bajo
SIL Open Font License.
