import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { User } from '../types';
import { Spinner } from '../components/ui';

/** El backend redirige aquí con ?token=…&user=…&redirect=… tras completar OAuth. */
export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = params.get('token');
      const redirect = params.get('redirect') ?? '/panel';
      if (!token) {
        setError('No se recibió ningún token del proveedor');
        return;
      }
      try {
        const raw = params.get('user');
        const user = raw ? (JSON.parse(decodeURIComponent(raw)) as User) : undefined;
        await setSession(token, user);
        navigate(redirect, { replace: true });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [params, navigate, setSession]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      {error ? (
        <>
          <h1 className="text-xl font-bold">No se pudo completar el inicio de sesión</h1>
          <p className="text-sm text-red-300">{error}</p>
          <a href="/login" className="btn-ghost">
            Volver a entrar
          </a>
        </>
      ) : (
        <>
          <Spinner className="h-7 w-7 text-brat" />
          <p className="text-sm text-muted">Validando tu sesión…</p>
        </>
      )}
    </div>
  );
}
