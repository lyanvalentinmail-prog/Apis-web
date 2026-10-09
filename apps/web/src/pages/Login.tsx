import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, ErrorNote, Field, Input, Spinner } from '../components/ui';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/panel';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  useEffect(() => {
    api
      .providers()
      .then(({ data }) => setProviders({ github: data.github, google: data.google }))
      .catch(() => setProviders({ github: false, google: false }));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
      <div className="space-y-5">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Bienvenido de <span className="text-brat">vuelta</span>
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Entra para gestionar tus API keys, ver tu consumo y probar los endpoints desde el panel.
        </p>
        <ul className="space-y-2 text-sm text-zinc-300">
          {['API keys ilimitadas (hasta 25)', 'Estadísticas de uso por endpoint', 'Límites más altos que el modo anónimo'].map(
            (item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-brat">✓</span>
                {item}
              </li>
            )
          )}
        </ul>
      </div>

      <Card className="space-y-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        {providers.github || providers.google ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" /> o continúa con <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid gap-2">
              {providers.github ? (
                <a href={`${API_URL}/auth/oauth/github?redirect=${encodeURIComponent(next)}`} className="btn-ghost w-full">
                  Continuar con GitHub
                </a>
              ) : null}
              {providers.google ? (
                <a href={`${API_URL}/auth/oauth/google?redirect=${encodeURIComponent(next)}`} className="btn-ghost w-full">
                  Continuar con Google
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="text-center text-sm text-muted">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-brat hover:underline">
            Regístrate gratis
          </Link>
        </p>
      </Card>
    </div>
  );
}
