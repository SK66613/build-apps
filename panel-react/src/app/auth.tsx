import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { MeResponse } from '../lib/types';

type AuthCtx = {
  me: MeResponse | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
    staleTime: 15_000,
  });

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['me'] }); };

  const logout = async () => {
    try { await apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' }); } finally {
      await qc.invalidateQueries({ queryKey: ['me'] });
    }
  };

  return (
    <AuthContext.Provider value={{ me: q.data ?? null, isLoading: q.isLoading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
