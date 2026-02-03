import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export function RequireAuth({ children }: { children: React.ReactNode }){
  const loc = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ['auth.me'],
    queryFn: () => api.auth.me(),
  });

  if (isLoading) return <div className="sg-page-center">Загрузка…</div>;

  if (!data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
