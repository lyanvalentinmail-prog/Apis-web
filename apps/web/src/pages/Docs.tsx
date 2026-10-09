import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, API_URL } from '../lib/api';
import { CodeBlock, CopyButton } from '../components/CodeBlock';
import { Badge, Card, ErrorNote, MethodBadge, Spinner, cx } from '../components/ui';
import type { EndpointDoc } from '../types';

const TAG_LABELS: Record<string, string> = {
  general: 'General',
  brat: 'Stickers Brat',
  auth: 'Autenticación',
  keys: 'API keys',
  account: 'Cuenta',
};

const AUTH_LABEL: Record<EndpointDoc['auth'], { text: string; tone: 'neutral' | 'brat' | 'warn' }> = {
  none: { text: 'Público', tone: 'neutral' },
  api_key: { text: 'API key o sesión', tone: 'brat' },
  session: { text: 'Sesión web', tone: 'warn' },
};

export default function Docs() {
  const [endpoints, setEndpoints] = useState<EndpointDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const active = params.get('endpoint') ?? 'intro';

  useEffect(() => {
    api
      .endpoints()
      .then(({ data }) => setEndpoints(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointDoc[]>();
    for (const endpoint of endpoints) {
      const list = map.get(endpoint.tag) ?? [];
      list.push(endpoint);
      map.set(endpoint.tag, list);
    }
    return [...map.entries()];
  }, [endpoints]);

  useEffect(() => {
    if (active !== 'intro') {
      document.getElementById(`endpoint-${active}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [active, loading]);

  function goto(id: string) {
    setParams(id === 'intro' ? {} : { endpoint: id }, { replace: true });
    (document.getElementById(`section-${id}`) ?? document.getElementById(`endpoint-${id}`))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-10 space-y-3">
        <Badge tone="brat">Documentación</Badge>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Cómo usar la API</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Esta documentación se genera a partir del catálogo que sirve la propia API en{' '}
          <code className="font-mono text-brat">GET {API_URL}/endpoints</code>. Si añades un endpoint al backend,
          aparece aquí automáticamente.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* Índice */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <nav className="space-y-6 text-sm">
            <div className="space-y-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Guía</p>
              {[
                ['intro', 'Introducción'],
                ['auth', 'Autenticación'],
                ['errors', 'Errores'],
                ['limits', 'Límites y caché'],
                ['params', 'Parámetros del sticker'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => goto(id)}
                  className={cx(
                    'block w-full rounded-lg px-3 py-1.5 text-left transition',
                    active === id ? 'bg-brat/10 font-semibold text-brat' : 'text-muted hover:text-zinc-100'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Spinner className="h-3.5 w-3.5" /> cargando endpoints…
              </p>
            ) : (
              grouped.map(([tag, items]) => (
                <div key={tag} className="space-y-1">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">{TAG_LABELS[tag] ?? tag}</p>
                  {items.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => goto(endpoint.id)}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition',
                        active === endpoint.id ? 'bg-brat/10 font-semibold text-brat' : 'text-muted hover:text-zinc-100'
                      )}
                    >
                      <span className="font-mono text-[10px] opacity-70">{endpoint.method}</span>
                      <span className="truncate">{endpoint.title}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* Contenido */}
        <div className="min-w-0 space-y-14">
          <ErrorNote>{error}</ErrorNote>

          <Section id="intro" title="Introducción">
            <p>
              La API genera stickers con la estética del álbum <em>brat</em>: fondo de color plano, tipografía tipo
              Arial en minúsculas y desenfoque. Devuelve la imagen directamente como binario, lista para guardar o
              mostrar en un <code className="font-mono">&lt;img&gt;</code>.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>
                • URL base: <code className="font-mono text-brat">{API_URL}</code>
              </li>
              <li>• Formatos de respuesta: JSON (<code className="font-mono">application/json</code>) o imagen.</li>
              <li>
                • Todas las respuestas JSON tienen la forma{' '}
                <code className="font-mono">{'{ "data": …, "error": … }'}</code>.
              </li>
            </ul>
            <div className="mt-5">
              <CodeBlock
                snippets={[
                  { label: 'cURL', language: 'bash', code: `curl "${API_URL}/brat?text=hola&size=512" -o sticker.png` },
                  {
                    label: 'JavaScript',
                    language: 'js',
                    code: `const res = await fetch('${API_URL}/brat?text=hola&size=512');
const blob = await res.blob();
document.querySelector('img').src = URL.createObjectURL(blob);`,
                  },
                  {
                    label: 'Python',
                    language: 'python',
                    code: `import requests
r = requests.get(f"{API_URL}/brat", params={"text": "hola", "size": 512})
open("sticker.png", "wb").write(r.content)`,
                  },
                ]}
              />
            </div>
          </Section>

          <Section id="auth" title="Autenticación">
            <p>
              Hay dos formas de autenticarse: con una <strong>API key</strong> (para tus scripts y servidores) y con un{' '}
              <strong>token de sesión</strong> (el que usa esta web tras iniciar sesión). En ambos casos se envía como
              cabecera:
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-black/40 p-4 font-mono text-xs text-zinc-300">
              Authorization: Bearer bsk_live_…
            </pre>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Regístrate en <Link to="/register" className="text-brat hover:underline">/register</Link>.</li>
              <li>Entra en el <Link to="/panel" className="text-brat hover:underline">panel</Link> y crea una key.</li>
              <li>Cópiala en ese momento: solo se muestra completa una vez.</li>
            </ol>
            <p className="mt-4 text-sm text-muted">
              Sin autenticación también funciona, con un límite más bajo (40 peticiones/minuto por IP).
            </p>
          </Section>

          <Section id="errors" title="Errores">
            <p>Los errores usan códigos HTTP estándar y este cuerpo:</p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-black/40 p-4 font-mono text-xs text-zinc-300">
{`{
  "error": {
    "code": "bad_request",
    "message": "Parámetros inválidos",
    "details": [{ "field": "blur", "message": "Número inválido" }]
  }
}`}
            </pre>
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Significado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    ['400 bad_request', 'Falta un parámetro o el valor no es válido'],
                    ['401 unauthorized', 'API key ausente, inválida o revocada'],
                    ['403 forbidden', 'El plan no permite la operación'],
                    ['404 not_found', 'Endpoint o recurso inexistente'],
                    ['409 conflict', 'El email ya está registrado'],
                    ['429 rate_limited', 'Superaste el límite de peticiones (mira Retry-After)'],
                    ['501 not_implemented', 'OAuth no configurado en este despliegue'],
                    ['500 internal_error', 'Fallo inesperado del servidor'],
                  ].map(([code, text]) => (
                    <tr key={code}>
                      <td className="px-4 py-2.5 font-mono text-xs text-brat">{code}</td>
                      <td className="px-4 py-2.5 text-muted">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="limits" title="Límites y caché">
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5">Peticiones/minuto</th>
                    <th className="px-4 py-2.5">Peticiones/día</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    ['Anónimo (sin key)', '40', '2.000'],
                    ['Free (registrado)', '120', '50.000'],
                    ['Pro', '600', '500.000'],
                  ].map(([plan, minute, day]) => (
                    <tr key={plan}>
                      <td className="px-4 py-2.5">{plan}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{minute}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{day}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted">
              Cada respuesta incluye <code className="font-mono">X-RateLimit-Limit</code>,{' '}
              <code className="font-mono">X-RateLimit-Remaining</code> y <code className="font-mono">X-RateLimit-Reset</code>.
              Las imágenes son deterministas: se sirven con <code className="font-mono">ETag</code> y{' '}
              <code className="font-mono">Cache-Control: immutable</code>, así que repetir la misma petición no consume
              red.
            </p>
          </Section>

          <Section id="params" title="Parámetros del sticker">
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Parámetro</th>
                    <th className="px-4 py-2.5">Por defecto</th>
                    <th className="px-4 py-2.5">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    ['text', '—', 'Texto del sticker. Usa \\n para saltos de línea (hasta 240 caracteres)'],
                    ['size', '1080', 'Lado del cuadrado en píxeles (16-4096)'],
                    ['background', 'brat', 'Hex o preset: brat, lime, white, black, cream, pink, blue, purple, orange, red'],
                    ['color', '#0A2A00', 'Color del texto'],
                    ['blur', '28', 'Desenfoque de 0 a 100'],
                    ['bold', 'true', 'Negrita'],
                    ['transform', 'lower', 'lower · upper · none'],
                    ['align', 'center', 'left · center · right'],
                    ['padding', '9', 'Margen interior en % del lado corto'],
                    ['radius', '0', 'Esquinas redondeadas en píxeles'],
                    ['format', 'png', 'png · svg · jpeg · webp'],
                    ['quality', '90', 'Calidad para jpeg/webp (1-100)'],
                  ].map(([name, def, text]) => (
                    <tr key={name}>
                      <td className="px-4 py-2.5 font-mono text-xs text-brat">{name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{def}</td>
                      <td className="px-4 py-2.5 text-muted">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {grouped.map(([tag, items]) => (
            <div key={tag} className="space-y-8">
              <h2 className="border-b border-line pb-3 text-xl font-bold tracking-tight">{TAG_LABELS[tag] ?? tag}</h2>
              {items.map((endpoint) => (
                <Card key={endpoint.id} id={`endpoint-${endpoint.id}`} className="scroll-mt-24 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <MethodBadge method={endpoint.method} />
                    <code className="font-mono text-sm text-zinc-100">{endpoint.path}</code>
                    <Badge tone={AUTH_LABEL[endpoint.auth].tone}>{AUTH_LABEL[endpoint.auth].text}</Badge>
                    <span className="ml-auto flex items-center gap-2">
                      <CopyButton value={`${API_URL}${endpoint.path}`} label="Copiar ruta" />
                      <Link to={`/endpoints?endpoint=${endpoint.id}`} className="text-xs font-semibold text-brat hover:underline">
                        Probar →
                      </Link>
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-muted">{endpoint.description}</p>

                  {endpoint.params.length ? (
                    <div className="overflow-hidden rounded-xl border border-line">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted">
                          <tr>
                            <th className="px-4 py-2.5">Nombre</th>
                            <th className="px-4 py-2.5">Tipo</th>
                            <th className="px-4 py-2.5">Por defecto</th>
                            <th className="px-4 py-2.5">Descripción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {endpoint.params.map((param) => (
                            <tr key={`${param.in}-${param.name}`}>
                              <td className="px-4 py-2.5 font-mono text-xs">
                                <span className="text-brat">{param.name}</span>
                                {param.required ? <span className="ml-1 text-red-400">*</span> : null}
                                <span className="ml-2 text-[10px] uppercase text-zinc-500">{param.in}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{param.type}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{param.default ?? '—'}</td>
                              <td className="px-4 py-2.5 text-muted">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Respuesta</p>
                    <pre className="overflow-x-auto rounded-xl border border-line bg-black/40 p-3.5 font-mono text-[11.5px] text-zinc-300">
                      {endpoint.response}
                    </pre>
                  </div>

                  <CodeBlock
                    snippets={[
                      { label: 'cURL', language: 'bash', code: endpoint.examples.curl },
                      ...(endpoint.examples.js ? [{ label: 'JavaScript', language: 'js', code: endpoint.examples.js }] : []),
                      ...(endpoint.examples.python
                        ? [{ label: 'Python', language: 'python', code: endpoint.examples.python }]
                        : []),
                    ]}
                  />
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${id}`} className="scroll-mt-24">
      <h2 className="mb-3 border-b border-line pb-3 text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}
