import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, cx } from './ui';

const NAV = [
  { to: '/docs', label: 'Documentación' },
  { to: '/endpoints', label: 'Endpoints' },
  { to: '/panel', label: 'Panel' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brat text-base font-black text-black">b</span>
      <span className="text-sm font-bold tracking-tight text-zinc-100">
        Brat<span className="text-brat">API</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-white/5 text-brat' : 'text-muted hover:text-zinc-100'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-[160px] truncate text-xs text-muted sm:block" title={user.email}>
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  className="px-3 py-2"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Salir
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" className="px-3 py-2">
                    Entrar
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="px-3 py-2">Crear cuenta</Button>
                </Link>
              </>
            )}

            <button
              type="button"
              className="rounded-lg border border-line p-2 text-muted md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menú"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-line bg-ink px-4 py-3 md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx('block rounded-lg px-3 py-2.5 text-sm', isActive ? 'bg-white/5 text-brat' : 'text-zinc-200')
                }
              >
                {item.label}
              </NavLink>
            ))}
            {!user ? (
              <NavLink to="/login" className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200">
                Entrar
              </NavLink>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line/70 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Logo />
            <p className="text-xs text-muted">
              Plantilla open-source de API + web. Desplegable en Vercel en minutos.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
            <Link to="/docs" className="hover:text-brat">
              Docs
            </Link>
            <Link to="/endpoints" className="hover:text-brat">
              Endpoints
            </Link>
            <a href={`${API_URL}/health`} target="_blank" rel="noreferrer" className="hover:text-brat">
              Status
            </a>
            <a href={`${API_URL}/openapi.json`} target="_blank" rel="noreferrer" className="hover:text-brat">
              OpenAPI
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
