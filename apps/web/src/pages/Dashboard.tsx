import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API_URL, bratUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CopyButton } from '../components/CodeBlock';
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Spinner, cx } from '../components/ui';
import type { ApiKeyInfo, UsageDay } from '../types';

export default function Dashboard() {
  const { token, user, ready } = useAuth();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [usage, setUsage] = useState<UsageDay[]>([]);
  const [total, setTotal] = useState(0);
  const [limits, setLimits] = useState<{ perMinute: number; perDay: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate('/login?next=/panel', { replace: true });
  }, [ready, user, navigate]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [keysRes, usageRes] = await Promise.all([api.listKeys(token), api.usage(token, 30)]);
      setKeys(keysRes.data);
      setUsage(usageRes.data.days);
      setTotal(usageRes.data.total);
      setLimits(usageRes.data.limit);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.createKey(token, newKeyName.trim() || 'Mi key');
      setCreatedKey(data.key ?? null);
      setNewKeyName('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!token) return;
    if (!confirm('¿Revocar esta API key? Dejará de funcionar de inmediato.')) return;
    try {
      await api.deleteKey(token, id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
        <Spinner /> cargando tu panel…
      </div>
    );
  }

  const today = usage.at(-1)?.total ?? 0;
  const activeKey = keys[0];
  const maxDay = Math.max(1, ...usage.slice(-14).map((d) => d.total));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brat">Panel</Badge>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Hola, {user.name?.split(' ')[0] ?? user.email.split('@')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user.email} · plan <span className="font-semibold text-brat">{user.plan}</span>
          </p>
        </div>
        <Link to="/endpoints" className="btn-ghost">
          Probar endpoints →
        </Link>
      </header>

      <ErrorNote>{error}</ErrorNote>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Hoy', value: today, hint: 'peticiones' },
          { label: 'Últimos 30 días', value: total, hint: 'peticiones' },
          { label: 'Límite', value: limits ? `${limits.perMinute}/min` : '—', hint: user.plan === 'pro' ? 'plan pro' : 'plan free' },
          { label: 'API keys', value: keys.length, hint: 'activas' },
        ].map((stat) => (
          <Card key={stat.label} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="text-2xl font-black text-brat">{stat.value}</p>
            <p className="text-[11px] text-zinc-500">{stat.hint}</p>
          </Card>
        ))}
      </div>

      {/* Gráfico */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Consumo de los últimos 14 días</h2>
          <span className="text-xs text-muted">{total} peticiones en 30 días</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted">
            <Spinner /> cargando…
          </div>
        ) : (
          <div className="flex h-32 items-end gap-1.5">
            {usage.slice(-14).map((day) => (
              <div key={day.day} className="group flex flex-1 flex-col items-center gap-1">
                <div
                  className={cx(
                    'w-full rounded-t-md transition-all',
                    day.total > 0 ? 'bg-brat/80 group-hover:bg-brat' : 'bg-white/5'
                  )}
                  style={{ height: `${Math.max(4, (day.total / maxDay) * 100)}%` }}
                  title={`${day.day}: ${day.total} peticiones`}
                />
                <span className="text-[9px] text-zinc-600">{day.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* API keys */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Tus API keys</h2>
            <span className="text-xs text-muted">{keys.length}/25</span>
          </div>

          {createdKey ? (
            <div className="animate-fade-up space-y-2 rounded-xl border border-brat/40 bg-brat/10 p-4">
              <p className="text-sm font-semibold text-brat">¡Key creada! Guárdala ahora: no la volverás a ver completa.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-brat/30 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100">
                  {createdKey}
                </code>
                <CopyButton value={createdKey} />
              </div>
              <button className="text-xs text-muted hover:text-zinc-200" onClick={() => setCreatedKey(null)}>
                Ya la guardé, ocultar
              </button>
            </div>
          ) : null}

          {keys.length === 0 ? (
            <EmptyState
              title="Todavía no tienes keys"
              description="Crea una para autenticar tus peticiones y disfrutar de límites más altos."
            />
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-black/20 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{key.name}</p>
                    <p className="font-mono text-[11px] text-muted">{key.masked ?? `${key.prefix}••••${key.last4}`}</p>
                  </div>
                  <div className="text-right text-[11px] text-muted">
                    <p>{key.requests} peticiones</p>
                    <p>{key.lastUsedAt ? `usada ${new Date(key.lastUsedAt).toLocaleDateString('es')}` : 'sin uso'}</p>
                  </div>
                  <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => revoke(key.id)}>
                    Revocar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="text-base font-bold">Crear una key</h2>
            <form onSubmit={createKey} className="space-y-3">
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Nombre (ej. Producción)"
                maxLength={60}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Spinner /> : null}
                Generar API key
              </Button>
            </form>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Solo se guarda el hash SHA-256 de la key. Puedes revocarla en cualquier momento.
            </p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-bold">Tu primera petición</h2>
            <p className="text-[11px] text-zinc-500">
              Sustituye <code className="font-mono text-brat">TU_KEY</code> por la key que acabas de crear.
            </p>
            <pre className="overflow-x-auto rounded-xl border border-line bg-black/40 p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300">
{`curl "${API_URL}/brat?text=brat&size=1080" \\
  -H "Authorization: Bearer TU_KEY" \\
  -o brat.png`}
            </pre>
            {activeKey ? (
              <p className="text-[11px] text-zinc-500">
                Key activa: <span className="font-mono text-zinc-300">{activeKey.prefix}…{activeKey.last4}</span>
              </p>
            ) : null}
            <a
              href={bratUrl({ text: 'brat', size: 512, background: '#8ACE00', blur: 28, bold: true, format: 'png' })}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost w-full"
            >
              Probar sin key (límite bajo)
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
