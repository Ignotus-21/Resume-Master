'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiJson, ApiError } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  hasOwnKey: boolean;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, turnstileToken?: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
    } catch (err) {
      // Only treat an explicit auth rejection as "logged out". A transient 500
      // or network blip shouldn't visually sign the user out when their cookie
      // is still valid.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiJson('/api/auth/login', 'POST', { email, password });
    setUser(data.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string, turnstileToken?: string) => {
    const data = await apiJson('/api/auth/signup', 'POST', { email, password, name, turnstileToken });
    setUser(data.user);
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await apiJson('/api/auth/google', 'POST', { credential });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, signup, loginWithGoogle, logout }),
    [user, loading, refresh, login, signup, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
