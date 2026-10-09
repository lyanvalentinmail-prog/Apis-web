import { Link } from 'react-router-dom';
import { BratStudio } from '../components/BratStudio';
import { CodeBlock } from '../components/CodeBlock';
import { Badge, Card, MethodBadge } from '../components/ui';
import { API_URL } from '../lib/api';

const FEATURES = [
  {
    title: 'Render real en el servidor',
    text: 'SVG generado a medida y rasterizado a PNG, JPEG o WebP con tipografía métrica Arial. El texto se ajusta solo al lienzo.',
    icon: '◧',
  },
  {
    title: 'Autenticación por API key',
    text: 'Keys tipo bsk_live_… con hash SHA-256 en base de datos. Se ven completas una sola vez y se revocan al instante.',
    icon: '🔑',
  },
  {
    title: 'Registro con email u OAuth',
    text: 'Email y contraseña con scrypt, o GitHub/Google activables con dos variables de entorno.',
    icon: '🛡️',
  },
  {
    title: 'Persistencia intercambiable',
    text: 'JSON en local, Vercel KV / Upstash o Postgres. Se elige según las variables de entorno, sin tocar código.',
    icon: '🗄️',
  },
  {
    title: 'Límites y estadísticas',
    text: 'Rate limit por minuto según plan, cabeceras X-RateLimit-* y consumo diario por endpoint.',
    icon: '📊',
  },
  {
    title: 'Documentación viva',
    text: 'El catálogo de endpoints se sirve desde la propia API: la web lee GET /v1/endpoints y se actualiza sola.',
    icon: '📚',
  },
];

const STEPS = [
  { n: '01', title: 'Crea tu cuenta', text: 'Registro con email y contraseña (o GitHub/Google si lo activas).' },
  { n: '02', title: 'Genera una API key', text: 'Desde el panel creas una key con un nombre y la copias una única vez.' },
  { n: '03', title: 'Llama al endpoint', text: 'GET /v1/brat?text=hola devuelve la imagen lista para usar.' },
];

const HIGHLIGHTS = [
  { method: 'GET', path: '/v1/brat', text: 'Genera un sticker (PNG, SVG, JPEG o WebP)' },
  { method: 'POST', path: '/v1/auth/register', text: 'Crea una cuenta y obtén un token de sesión' },
  { method: 'POST', path: '/v1/keys', text: 'Emite una API key nueva' },
  { method: 'GET', path: '/v1/me/usage', text: 'Consulta tu consumo por día y endpoint' },
] as const;

export default function Home() {
  return (
    <div className="space-y-24 pb-10">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up space-y-7">
            <Badge tone="brat">API real · plantilla open source</Badge>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              API para crear stickers <span className="text-brat">estilo Brat</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Una plantilla completa: backend Express con generación de imágenes, web en React con registro,
              documentación automática y gestión de API keys. Todo en un mismo repositorio y lista para Vercel.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary px-5 py-3">
                Crear cuenta gratis
              </Link>
              <Link to="/docs" className="btn-ghost px-5 py-3">
                Ver documentación
              </Link>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              {[
                ['<200 ms', 'por sticker'],
                ['4', 'formatos'],
                ['120 req/min', 'plan free'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-xl font-bold text-brat">{value}</dt>
                  <dd className="text-xs text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up">
            <div className="rounded-[28px] border border-line bg-black/40 p-4 shadow-[0_40px_120px_-40px_rgba(138,206,0,0.45)]">
              <BratStudio showCode={false} className="grid-cols-1" />
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Cómo funciona</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.n} className="space-y-2">
              <span className="font-mono text-sm font-bold text-brat">{step.n}</span>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Estudio completo */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Estudio en vivo</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Cada cambio que hagas aquí abajo llama al endpoint real <code className="font-mono text-brat">GET /v1/brat</code>.
              Cambia el fondo, el desenfoque o el formato y descarga el resultado.
            </p>
          </div>
          <Link to="/endpoints" className="btn-ghost">
            Abrir explorador →
          </Link>
        </div>
        <BratStudio />
      </section>

      {/* Ejemplo de código */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Tres líneas y lo tienes</h2>
            <p className="text-sm leading-relaxed text-muted">
              La API acepta los parámetros por query string o por JSON. Sin API key funciona con un límite
              reducido; con tu key tienes 120 peticiones por minuto y estadísticas de uso.
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              {[
                'Ajuste automático del texto al lienzo, con saltos de línea',
                'Presets de color y esquinas redondeadas',
                'Caché HTTP con ETag e immutable',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-brat">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <CodeBlock
            snippets={[
              { label: 'cURL', language: 'bash', code: `curl "${API_URL}/brat?text=brat&size=1080" -o brat.png` },
              {
                label: 'JavaScript',
                language: 'js',
                code: `const params = new URLSearchParams({ text: 'brat', size: '1080' });

const res = await fetch(\`\${API_URL}/brat?\${params}\`, {
  headers: { Authorization: 'Bearer ' + process.env.BRAT_API_KEY }
});

const blob = await res.blob();
// listo para mostrar o descargar`,
              },
              {
                label: 'Python',
                language: 'python',
                code: `import os, requests

r = requests.get(f"{API_URL}/brat",
                 params={"text": "brat", "size": 1080},
                 headers={"Authorization": f"Bearer {os.environ['BRAT_API_KEY']}"})

open("brat.png", "wb").write(r.content)`,
              },
            ]}
          />
        </div>
      </section>

      {/* Características */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Qué incluye la plantilla</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="space-y-2.5">
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="text-base font-bold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Endpoints destacados */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Endpoints principales</h2>
          <Link to="/endpoints" className="text-sm font-semibold text-brat hover:underline">
            Ver los 11 →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line">
          {HIGHLIGHTS.map((item, index) => (
            <Link
              key={item.path}
              to="/endpoints"
              className={`flex items-center gap-4 bg-panel/50 px-4 py-3.5 transition hover:bg-white/5 ${
                index ? 'border-t border-line' : ''
              }`}
            >
              <MethodBadge method={item.method} />
              <code className="font-mono text-sm text-zinc-200">{item.path}</code>
              <span className="ml-auto hidden text-xs text-muted sm:block">{item.text}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="card relative overflow-hidden p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brat/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Del repositorio a producción en minutos</h2>
              <p className="text-sm leading-relaxed text-muted">
                Sube el repo a GitHub, crea dos proyectos en Vercel (uno para <code className="font-mono text-brat">apps/api</code> y
                otro para <code className="font-mono text-brat">apps/web</code>), añade las variables de entorno y listo.
                El README incluye el paso a paso completo.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary">
                  Empezar ahora
                </Link>
                <Link to="/docs" className="btn-ghost">
                  Leer los docs
                </Link>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-line bg-black/50 p-5 font-mono text-[12px] leading-relaxed text-zinc-300">
{`# 1. instalar
npm install

# 2. desarrollo (API :4000 + web :5173)
npm run dev

# 3. desplegar
vercel deploy --prod`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
