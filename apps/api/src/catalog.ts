export interface ParamDoc {
  name: string;
  in: 'query' | 'body' | 'path' | 'header';
  type: string;
  required?: boolean;
  default?: string;
  description: string;
  example?: string;
}

export interface EndpointDoc {
  id: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  tag: 'general' | 'brat' | 'auth' | 'keys' | 'account';
  description: string;
  auth: 'none' | 'api_key' | 'session';
  params: ParamDoc[];
  response: string;
  examples: { curl: string; js?: string; python?: string };
}

const API_BASE = 'https://TU-API.vercel.app/v1';

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'health',
    method: 'GET',
    path: '/v1/health',
    title: 'Estado del servicio',
    tag: 'general',
    description: 'Comprueba que la API está viva y qué driver de persistencia está usando.',
    auth: 'none',
    params: [],
    response: '{ "data": { "status": "ok", "driver": "file", "version": "1.0.0", "uptime": 12.4 } }',
    examples: { curl: `curl ${API_BASE}/health` },
  },
  {
    id: 'endpoints',
    method: 'GET',
    path: '/v1/endpoints',
    title: 'Catálogo de endpoints',
    tag: 'general',
    description: 'Devuelve todos los endpoints con sus parámetros. La documentación de la web se genera desde aquí.',
    auth: 'none',
    params: [],
    response: '{ "data": [ { "id": "brat", "method": "GET", "path": "/v1/brat", ... } ] }',
    examples: { curl: `curl ${API_BASE}/endpoints` },
  },
  {
    id: 'register',
    method: 'POST',
    path: '/v1/auth/register',
    title: 'Crear cuenta',
    tag: 'auth',
    description: 'Registra un usuario con email y contraseña. Devuelve un token de sesión (JWT) para el panel.',
    auth: 'none',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'Email único', example: 'tu@email.com' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'Mínimo 8 caracteres', example: 'supersecreto123' },
      { name: 'name', in: 'body', type: 'string', description: 'Nombre visible', example: 'Ada Lovelace' },
    ],
    response: '{ "data": { "token": "eyJhbGciOi...", "user": { "id": "usr_x", "email": "...", "plan": "free" } } }',
    examples: {
      curl: `curl -X POST ${API_BASE}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"tu@email.com","password":"supersecreto123"}'`,
      js: `const res = await fetch('${API_BASE}/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'tu@email.com', password: 'supersecreto123' })
});
const { data } = await res.json();
console.log(data.token);`,
    },
  },
  {
    id: 'login',
    method: 'POST',
    path: '/v1/auth/login',
    title: 'Iniciar sesión',
    tag: 'auth',
    description: 'Devuelve un token de sesión JWT válido durante 30 días.',
    auth: 'none',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, description: 'Email de la cuenta' },
      { name: 'password', in: 'body', type: 'string', required: true, description: 'Contraseña' },
    ],
    response: '{ "data": { "token": "eyJhbGciOi...", "user": { ... } } }',
    examples: {
      curl: `curl -X POST ${API_BASE}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"tu@email.com","password":"supersecreto123"}'`,
    },
  },
  {
    id: 'me',
    method: 'GET',
    path: '/v1/me',
    title: 'Perfil del usuario',
    tag: 'account',
    description: 'Datos del usuario autenticado (por API key o por token de sesión).',
    auth: 'api_key',
    params: [{ name: 'Authorization', in: 'header', type: 'string', required: true, description: 'Bearer bsk_live_... o el JWT de sesión' }],
    response: '{ "data": { "id": "usr_x", "email": "...", "plan": "free", "via": "api_key" } }',
    examples: { curl: `curl ${API_BASE}/me -H "Authorization: Bearer bsk_live_TU_KEY"` },
  },
  {
    id: 'keys-create',
    method: 'POST',
    path: '/v1/keys',
    title: 'Crear API key',
    tag: 'keys',
    description: 'Genera una nueva API key. El valor completo solo se devuelve una vez; después solo verás el prefijo.',
    auth: 'session',
    params: [{ name: 'name', in: 'body', type: 'string', description: 'Etiqueta para identificarla', default: 'Mi app', example: 'Producción' }],
    response: '{ "data": { "id": "key_x", "key": "bsk_live_...", "name": "Producción", "prefix": "bsk_live_1a2b3c4", "last4": "9f2a" } }',
    examples: {
      curl: `curl -X POST ${API_BASE}/keys \\
  -H "Authorization: Bearer TU_TOKEN_DE_SESION" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Producción"}'`,
    },
  },
  {
    id: 'keys-list',
    method: 'GET',
    path: '/v1/keys',
    title: 'Listar API keys',
    tag: 'keys',
    description: 'Lista tus keys (enmascaradas) con su uso y fecha de último uso.',
    auth: 'session',
    params: [],
    response: '{ "data": [ { "id": "key_x", "name": "Producción", "masked": "bsk_live_1a2b3c4••••9f2a", "requests": 128 } ] }',
    examples: { curl: `curl ${API_BASE}/keys -H "Authorization: Bearer TU_TOKEN_DE_SESION"` },
  },
  {
    id: 'keys-delete',
    method: 'DELETE',
    path: '/v1/keys/:id',
    title: 'Revocar API key',
    tag: 'keys',
    description: 'Revoca una key. Deja de funcionar de inmediato.',
    auth: 'session',
    params: [{ name: 'id', in: 'path', type: 'string', required: true, description: 'Id de la key (key_...)' }],
    response: '204 No Content',
    examples: { curl: `curl -X DELETE ${API_BASE}/keys/key_x -H "Authorization: Bearer TU_TOKEN_DE_SESION"` },
  },
  {
    id: 'usage',
    method: 'GET',
    path: '/v1/me/usage',
    title: 'Consumo y estadísticas',
    tag: 'account',
    description: 'Peticiones por día y por endpoint de los últimos N días.',
    auth: 'api_key',
    params: [{ name: 'days', in: 'query', type: 'number', default: '30', description: 'Días de histórico (1-90)' }],
    response: '{ "data": [ { "day": "2026-10-09", "total": 42, "byEndpoint": { "GET /v1/brat": 42 } } ] }',
    examples: { curl: `curl "${API_BASE}/me/usage?days=7" -H "Authorization: Bearer bsk_live_TU_KEY"` },
  },
  {
    id: 'brat-get',
    method: 'GET',
    path: '/v1/brat',
    title: 'Generar sticker Brat',
    tag: 'brat',
    description:
      'Devuelve la imagen del sticker (PNG por defecto). Se puede usar sin API key con un límite reducido.',
    auth: 'none',
    params: [
      { name: 'text', in: 'query', type: 'string', required: true, description: 'Texto del sticker. Usa \\n o %0A para saltos de línea', example: 'brat' },
      { name: 'size', in: 'query', type: 'number', default: '1080', description: 'Lado del cuadrado en px (16-4096)', example: '1080' },
      { name: 'width', in: 'query', type: 'number', description: 'Ancho personalizado (16-4096)' },
      { name: 'height', in: 'query', type: 'number', description: 'Alto personalizado (16-4096)' },
      { name: 'background', in: 'query', type: 'string', default: 'brat', description: 'Hex (#8ACE00) o preset: brat, lime, white, black, cream, pink, blue, purple, orange, red', example: '#8ACE00' },
      { name: 'color', in: 'query', type: 'string', default: '#0A2A00', description: 'Color del texto', example: '#0A2A00' },
      { name: 'blur', in: 'query', type: 'number', default: '28', description: 'Desenfoque 0-100 (0 = texto nítido)', example: '28' },
      { name: 'bold', in: 'query', type: 'boolean', default: 'true', description: 'Negrita', example: 'true' },
      { name: 'italic', in: 'query', type: 'boolean', default: 'false', description: 'Cursiva' },
      { name: 'transform', in: 'query', type: 'string', default: 'lower', description: 'lower | upper | none' },
      { name: 'align', in: 'query', type: 'string', default: 'center', description: 'left | center | right' },
      { name: 'padding', in: 'query', type: 'number', default: '9', description: 'Margen interior en % del lado corto (0-40)' },
      { name: 'radius', in: 'query', type: 'number', default: '0', description: 'Esquinas redondeadas en px' },
      { name: 'lineHeight', in: 'query', type: 'number', default: '1.02', description: 'Interlineado (0.6-3)' },
      { name: 'tracking', in: 'query', type: 'number', default: '0', description: 'Espaciado entre letras en em (-0.5 a 1)' },
      { name: 'fontSize', in: 'query', type: 'number', description: 'Tamaño de fuente fijo en px (desactiva el ajuste automático)' },
      { name: 'format', in: 'query', type: 'string', default: 'png', description: 'png | jpeg | webp | svg' },
      { name: 'quality', in: 'query', type: 'number', default: '90', description: 'Calidad 1-100 para jpeg/webp' },
      { name: 'download', in: 'query', type: 'boolean', default: 'false', description: 'Fuerza la descarga con Content-Disposition' },
    ],
    response: 'Binario: image/png, image/jpeg, image/webp o image/svg+xml',
    examples: {
      curl: `curl "${API_BASE}/brat?text=brat&size=1080" -o brat.png

# con API key y formato SVG
curl "${API_BASE}/brat?text=hola%0Amundo&format=svg" \\
  -H "Authorization: Bearer bsk_live_TU_KEY" -o sticker.svg`,
      js: `const params = new URLSearchParams({ text: 'brat', size: '1080', background: '#8ACE00' });
const res = await fetch(\`\${API_BASE}/brat?\${params}\`, {
  headers: { Authorization: 'Bearer bsk_live_TU_KEY' }
});
const blob = await res.blob();
document.querySelector('img').src = URL.createObjectURL(blob);`,
      python: `import requests
r = requests.get(f"{API_BASE}/brat", params={"text": "brat", "size": 1080},
                 headers={"Authorization": "Bearer bsk_live_TU_KEY"})
open("brat.png", "wb").write(r.content)`,
    },
  },
  {
    id: 'brat-post',
    method: 'POST',
    path: '/v1/brat',
    title: 'Generar sticker Brat (JSON)',
    tag: 'brat',
    description: 'Igual que el GET pero enviando los parámetros como JSON. Más cómodo para textos largos o multilínea.',
    auth: 'none',
    params: [{ name: 'body', in: 'body', type: 'object', required: true, description: 'Mismos parámetros que el GET, en JSON' }],
    response: 'Binario de imagen',
    examples: {
      curl: `curl -X POST ${API_BASE}/brat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bsk_live_TU_KEY" \\
  -d '{"text":"brat summer","size":1080,"format":"webp"}' -o brat.webp`,
      js: `const res = await fetch(\`\${API_BASE}/brat\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bsk_live_TU_KEY' },
  body: JSON.stringify({ text: 'brat\\nverano', size: 1080, background: 'pink' })
});
const blob = await res.blob();`,
    },
  },
];

export function endpointsByTag() {
  const groups: Record<string, EndpointDoc[]> = {};
  for (const endpoint of ENDPOINTS) {
    (groups[endpoint.tag] ??= []).push(endpoint);
  }
  return groups;
}
