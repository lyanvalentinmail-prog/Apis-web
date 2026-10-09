# @apis-web/web

Web de la API: landing con generador en vivo, documentación automática, explorador de endpoints,
registro/login y panel de API keys. Vite + React 19 + Tailwind v4.

```bash
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Conexión con la API

El cliente (`src/lib/api.ts`) usa la base `VITE_API_URL`:

- **Local**: no hace falta definirla. Vite hace proxy de `/api/v1/*` → `http://localhost:4000/v1/*`
  (ver `vite.config.ts`, `VITE_API_PROXY_TARGET` para cambiar el destino).
- **Producción**: define `VITE_API_URL=https://tu-api.vercel.app/v1` **antes de compilar** (las
  variables `VITE_*` se incrustan en el bundle).

## Páginas

| Ruta | Contenido |
|---|---|
| `/` | Landing + estudio en vivo (llama a `GET /v1/brat` de verdad) |
| `/docs` | Documentación generada desde `GET /v1/endpoints` |
| `/endpoints` | Explorador: ejecuta cualquier endpoint y muestra respuesta o imagen |
| `/register` · `/login` | Registro con email/contraseña y OAuth si está activo |
| `/panel` | API keys (crear/revocar), consumo diario y primeros pasos |
| `/auth/callback` | Retorno de OAuth (guarda el token y redirige) |

## Estructura

```
src/
├── lib/api.ts       # cliente fetch: auth, keys, catálogo y stickers
├── lib/auth.tsx     # contexto de sesión (JWT en localStorage)
├── components/      # Layout, BratStudio, CodeBlock, primitivas de UI
└── pages/           # Home, Docs, Endpoints, Login, Register, Dashboard…
```
