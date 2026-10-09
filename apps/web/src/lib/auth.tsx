import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import type { User } from '../types';

const TOKEN_KEY = 'apis_web_token';

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => void;
  setSession: (token: string, user?: User) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const loadUser = useCallback(async (currentToken: string) => {
    const { data } = await api.me(currentToken);
    setUser(data.user);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }
      try {
        await loadUser(token);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadUser]);

  const setSession = useCallback(
    async (newToken: string, knownUser?: User) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      if (knownUser) setUser(knownUser);
      else await loadUser(newToken);
    },
    [loadUser]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const { data } = await api.login({ email, password });
        await setSession(data.token, data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [setSession]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      setLoading(true);
      try {
        const { data } = await api.register({ email, password, name });
        await setSession(data.token, data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [setSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, loading, ready, login, register, logout, setSession, refresh: () => loadUser(token!) }),
    [token, user, loading, ready, login, register, logout, setSession, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
