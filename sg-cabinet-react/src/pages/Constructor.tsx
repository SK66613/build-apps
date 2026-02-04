import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import ConstructorLayout from '../constructor/ConstructorLayout';
import { useConstructorStore } from '../constructor/state/constructorStore';
import { makeDefaultBlueprint } from '../constructor/state/utils';
import type { Blueprint } from '../constructor/state/types';

function pickConfig(payload: any): Blueprint | null {
  if (!payload) return null;
  // common shapes:
  // { ok:true, config:{...} }
  // { config:{...} }
  // { ok:true, data:{config:{...}} }
  const c = payload?.config || payload?.data?.config || payload?.data || payload;
  if (c && typeof c === 'object' && (c.nav || c.routes)) return c as Blueprint;
  return null;
}

export default function Constructor(){
  const { appId } = useAppState();
  const setAppId = useConstructorStore(s => s.setAppId);
  const setBlueprint = useConstructorStore(s => s.setBlueprint);

  React.useEffect(() => {
    setAppId(appId);
  }, [appId, setAppId]);

  const q = useQuery({
    queryKey: ['ctor.config', appId],
    enabled: !!appId,
    queryFn: async () => apiFetch<any>(`/api/app/${encodeURIComponent(appId!)}/config`, { method: 'GET' }),
    staleTime: 0,
  });

  React.useEffect(() => {
    if (!appId){
      setBlueprint(makeDefaultBlueprint());
      return;
    }
    if (q.isSuccess){
      const bp = pickConfig(q.data) || makeDefaultBlueprint();
      setBlueprint(bp);
    }
  }, [appId, q.isSuccess, q.data, setBlueprint]);

  if (!appId){
    return <div className="sg-card">Выбери проект слева, чтобы открыть конструктор.</div>;
  }

  if (q.isLoading){
    return <div className="sg-card">Загрузка конфигурации…</div>;
  }

  if (q.isError){
    return <div className="sg-card">Ошибка: {(q.error as Error).message}</div>;
  }

  return <ConstructorLayout />;
}

