import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CopyButton } from '../components/CodeBlock';
import { Badge, Card, ErrorNote, MethodBadge, Spinner, cx } from '../components/ui';
import type { EndpointDoc, ParamDoc } from '../types';

const TAG_LABELS: Record<string, string> = {
  general: 'General',
  brat: 'Stickers Brat',
  auth: 'Autenticación',
  keys: 'API keys',
  account: 'Cuenta',
};

const SELECT_OPTIONS: Record<string, string[]> = {
  format: ['png', 'svg', 'jpeg', 'webp'],
  transform: ['lower', 'upper', 'none'],
  align: ['left', 'center', 'right'],
};

const BOOLEANS = new Set(['bold', 'italic', 'download']);

type Values = Record<string, string | boolean>;

function initialValues(endpoint: EndpointDoc): Values {
  const values: Values = {};
  for (const param of endpoint.params) {
    if (param.in === 'body') continue;
    if (param.type === 'boolean') values[param.name] = param.default === 'true';
    else values[param.name] = param.example ?? param.default ?? '';
  }
  return values;
}

function initialBody(endpoint: EndpointDoc): string {
  const bodyParam = endpoint.params.find((p) => p.in === 'body');
  if (!bodyParam) return '';
  if (endpoint.id === 'brat-post') {
    return JSON.stringify({ text: 'brat', size: 512, background: '#8ACE00', format: 'png' }, null, 2);
  }
  const fromQuery = Object.fromEntries(
    endpoint.params.filter((p) => p.in === 'body' && p.name !== 'body').map((p) => [p.name, p.example ?? p.default ?? ''])
  );
  return JSON.stringify(Object.keys(fromQuery).length ? fromQuery : { name: 'Mi app' }, null, 2);
}

interface TestResult {
  status: number;
  statusText: string;
  time: number;
  contentType: string;
  headers: [string, string][];
  text?: string;
  imageUrl?: string;
}

export default function Endpoints() {
  const { token: sessionToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<EndpointDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [selectedId, setSelectedId] = useState<string>(searchParams.get('endpoint') ?? 'brat-get');
  const [values, setValues] = useState<Values>({});
  const [body, setBody] = useState('');
  const [useSession, setUseSession] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [tab, setTab] = useState<'body' | 'headers'>('body');

  useEffect(() => {
    api
      .endpoints()
      .then(({ data }) => {
        setCatalog(data);
        const wanted = searchParams.get('endpoint');
        const initial = data.find((e) => e.id === wanted) ?? data.find((e) => e.id === 'brat-get') ?? data[0];
        if (initial) {
          setSelectedId(initial.id);
          setValues(initialValues(initial));
          setBody(initialBody(initial));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endpoint = useMemo(() => catalog.find((e) => e.id === selectedId) ?? null, [catalog, selectedId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (e) => e.path.toLowerCase().includes(term) || e.title.toLowerCase().includes(term) || e.method.toLowerCase() === term
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointDoc[]>();
    for (const item of filtered) {
      const list = map.get(item.tag) ?? [];
      list.push(item);
      map.set(item.tag, list);
    }
    return [...map.entries()];
  }, [filtered]);

  function select(endpointDoc: EndpointDoc) {
    setSelectedId(endpointDoc.id);
    setValues(initialValues(endpointDoc));
    setBody(initialBody(endpointDoc));
    setResult(null);
    setTab('body');
    setSearchParams({ endpoint: endpointDoc.id }, { replace: true });
  }

  function setValue(name: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  const builtUrl = useMemo(() => {
    if (!endpoint) return '';
    let path = endpoint.path;
    for (const param of endpoint.params.filter((p) => p.in === 'path')) {
      path = path.replace(`:${param.name}`, encodeURIComponent(String(values[param.name] ?? '')));
    }
    const search = new URLSearchParams();
    for (const param of endpoint.params.filter((p) => p.in === 'query')) {
      const value = values[param.name];
      if (value === undefined || value === '' || value === false) continue;
      search.set(param.name, String(value));
    }
    const qs = search.toString();
    return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
  }, [endpoint, values]);

  const curlSnippet = useMemo(() => {
    if (!endpoint) return '';
    const headers: string[] = [];
    const token = useSession ? sessionToken : apiKey;
    if (token) headers.push(`-H "Authorization: Bearer ${token}"`);
    if (endpoint.method !== 'GET' && body) headers.push(`-H "Content-Type: application/json"`);
    if (endpoint.method !== 'GET' && body) headers.push(`-d '${body.replace(/\n\s*/g, ' ')}'`);
    return [`curl -X ${endpoint.method} "${builtUrl}"`, ...headers].join(' \\\n  ');
  }, [endpoint, builtUrl, body, useSession, sessionToken, apiKey]);

  async function run() {
    if (!endpoint) return;
    setRunning(true);
    setResult(null);
    const started = performance.now();
    try {
      const headers: Record<string, string> = {};
      const token = useSession ? sessionToken : apiKey;
      if (token) headers.Authorization = `Bearer ${token}`;
      if (endpoint.method !== 'GET' && body) headers['Content-Type'] = 'application/json';

      const res = await fetch(builtUrl, {
        method: endpoint.method,
        headers,
        body: endpoint.method !== 'GET' && body ? body : undefined,
      });

      const contentType = res.headers.get('content-type') ?? '';
      const responseHeaders: [string, string][] = [];
      res.headers.forEach((value, key) => responseHeaders.push([key, value]));

      if (contentType.includes('image')) {
        const blob = await res.blob();
        setResult({
          status: res.status,
          statusText: res.statusText,
          time: Math.round(performance.now() - started),
          contentType,
          headers: responseHeaders,
          imageUrl: URL.createObjectURL(blob),
        });
      } else {
        const text = await res.text();
        let pretty = text;
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          /* se muestra tal cual */
        }
        setResult({
          status: res.status,
          statusText: res.statusText,
          time: Math.round(performance.now() - started),
          contentType,
          headers: responseHeaders,
          text: pretty,
        });
      }
      setTab('body');
    } catch (err) {
      setResult({
        status: 0,
        statusText: 'Error de red',
        time: Math.round(performance.now() - started),
        contentType: 'text/plain',
        headers: [],
        text: (err as Error).message,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-3">
        <Badge tone="brat">Explorador</Badge>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Prueba los endpoints en vivo</h1>
        <p className="max-w-2xl text-sm text-muted">
          Selecciona un endpoint, rellena los parámetros y lanza la petición contra la API real. El catálogo viene de{' '}
          <code className="font-mono text-brat">GET /v1/endpoints</code>.
        </p>
      </header>

      <ErrorNote>{error}</ErrorNote>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted">
          <Spinner /> cargando catálogo…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Listado */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <input
              className="input"
              placeholder="Buscar endpoint…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <nav className="space-y-5">
              {grouped.map(([tag, items]) => (
                <div key={tag} className="space-y-1">
                  <p className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-500">{TAG_LABELS[tag] ?? tag}</p>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => select(item)}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                        item.id === selectedId
                          ? 'border-brat/50 bg-brat/10 text-brat'
                          : 'border-transparent text-zinc-300 hover:bg-white/5'
                      )}
                    >
                      <MethodBadge method={item.method} />
                      <code className="truncate font-mono text-xs">{item.path.replace('/v1', '')}</code>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          {/* Detalle */}
          {endpoint ? (
            <div className="min-w-0 space-y-5">
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <MethodBadge method={endpoint.method} />
                  <code className="font-mono text-sm text-zinc-100">{endpoint.path}</code>
                  <span className="ml-auto">
                    <CopyButton value={builtUrl} label="Copiar URL" />
                  </span>
                </div>
                <p className="text-sm text-muted">{endpoint.description}</p>

                {/* Autenticación */}
                <div className="space-y-2 rounded-xl border border-line bg-black/20 p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Autenticación</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="auth-mode"
                        className="accent-brat"
                        checked={useSession}
                        onChange={() => setUseSession(true)}
                      />
                      <span className={cx(!user && 'text-zinc-500')}>
                        Sesión de la web {user ? `(${user.email})` : '(sin iniciar)'}
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="auth-mode"
                        className="accent-brat"
                        checked={!useSession}
                        onChange={() => setUseSession(false)}
                      />
                      API key manual
                    </label>
                  </div>
                  {!useSession ? (
                    <input
                      className="input font-mono text-xs"
                      placeholder="bsk_live_…"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  ) : null}
                  {!useSession && !apiKey ? (
                    <p className="text-[11px] text-zinc-500">
                      Pega tu key o créala en el <Link to="/panel" className="text-brat hover:underline">panel</Link>.
                    </p>
                  ) : null}
                </div>

                {/* Parámetros */}
                {endpoint.params.length ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Parámetros</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {endpoint.params
                        .filter((p) => p.in === 'query' || p.in === 'path')
                        .map((param) => (
                          <ParamControl key={param.name} param={param} value={values[param.name] ?? ''} onChange={setValue} />
                        ))}
                    </div>
                  </div>
                ) : null}

                {endpoint.method !== 'GET' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Cuerpo (JSON)</p>
                    <textarea
                      className="input min-h-[130px] font-mono text-xs"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={run} disabled={running}>
                    {running ? <Spinner /> : null}
                    {running ? 'Enviando…' : 'Enviar petición'}
                  </button>
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-[11px] text-zinc-400">
                    {builtUrl}
                  </code>
                </div>
              </Card>

              {/* cURL generado */}
              <Card className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Petición equivalente</p>
                  <CopyButton value={curlSnippet} />
                </div>
                <pre className="overflow-x-auto rounded-xl border border-line bg-black/40 p-3.5 font-mono text-[11.5px] text-zinc-300">
                  {curlSnippet}
                </pre>
              </Card>

              {/* Respuesta */}
              {result ? (
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={result.status >= 400 ? 'red' : result.status >= 200 && result.status < 300 ? 'brat' : 'neutral'}>
                      {result.status || '—'} {result.statusText}
                    </Badge>
                    <span className="text-xs text-muted">{result.time} ms</span>
                    <span className="text-xs text-muted">{result.contentType || 'sin contenido'}</span>
                    <div className="ml-auto flex gap-1">
                      {(['body', 'headers'] as const).map((item) => (
                        <button
                          key={item}
                          onClick={() => setTab(item)}
                          className={cx(
                            'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                            tab === item ? 'bg-white/10 text-brat' : 'text-muted hover:text-zinc-200'
                          )}
                        >
                          {item === 'body' ? 'Cuerpo' : 'Cabeceras'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tab === 'body' ? (
                    result.imageUrl ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-black/30 p-5">
                        <img src={result.imageUrl} alt="Resultado" className="max-h-80 w-auto rounded-xl" />
                        <a href={result.imageUrl} download={`brat-${Date.now()}`} className="btn-ghost">
                          Descargar imagen
                        </a>
                      </div>
                    ) : (
                      <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-black/40 p-3.5 font-mono text-[12px] text-zinc-300">
                        {result.text || '(vacío)'}
                      </pre>
                    )
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-line">
                          {result.headers.map(([key, value]) => (
                            <tr key={key}>
                              <td className="px-3 py-2 font-mono text-brat">{key}</td>
                              <td className="px-3 py-2 font-mono text-zinc-300">{value}</td>
                            </tr>
                          ))}
                          {result.headers.length === 0 ? (
                            <tr>
                              <td className="px-3 py-2 text-muted">Sin cabeceras</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ParamControl({
  param,
  value,
  onChange,
}: {
  param: ParamDoc;
  value: string | boolean;
  onChange: (name: string, value: string | boolean) => void;
}) {
  const options = SELECT_OPTIONS[param.name];

  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs text-zinc-200">
          {param.name}
          {param.required ? <span className="ml-0.5 text-red-400">*</span> : null}
        </span>
        <span className="text-[10px] uppercase text-zinc-500">{param.in}</span>
      </span>

      {BOOLEANS.has(param.name) || param.type === 'boolean' ? (
        <select
          className="input"
          value={String(value)}
          onChange={(e) => onChange(param.name, e.target.value === 'true')}
        >
          <option value="">(omitir)</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : options ? (
        <select className="input" value={String(value)} onChange={(e) => onChange(param.name, e.target.value)}>
          <option value="">(por defecto)</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : param.name === 'text' ? (
        <textarea
          className="input min-h-[70px] font-mono text-xs"
          value={String(value)}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder="brat"
        />
      ) : (
        <input
          className="input font-mono text-xs"
          type={param.type === 'number' ? 'number' : 'text'}
          value={String(value)}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={param.default ?? param.example ?? ''}
        />
      )}

      <span className="block text-[11px] leading-snug text-zinc-500">{param.description}</span>
    </label>
  );
}
