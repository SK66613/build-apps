import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card } from '../components/ui';
import type { ActivityItem } from '../lib/types';

export default function Live(){
  const { appId } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['activity', appId],
    queryFn: () => apiFetch<{ ok: true; items: ActivityItem[] }>(`/api/cabinet/apps/${appId}/activity?limit=60`),
    refetchInterval: 5000,
    staleTime: 0,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Live Activity</h1>
        <div className="sg-sub">События в реальном времени: крутки, покупки, записи, игры, выдачи призов.</div>
      </div>

      <Card>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Последние события</div>
        {q.isLoading && <div style={{ fontWeight: 800, color: 'var(--muted)' }}>Загрузка...</div>}
        {q.isError && <div style={{ fontWeight: 900 }}>Нет эндпоинта <code>/activity</code> или ошибка.</div>}
        <div style={{ display:'grid', gap: 10 }}>
          {(q.data?.items || []).map((it, idx) => (
            <div key={String(it.id ?? idx)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap: 10 }}>
                <div style={{ fontWeight: 950 }}>{it.text || it.type}</div>
                <div style={{ color:'var(--muted)', fontWeight: 800, fontSize: 12 }}>{it.ts || ''}</div>
              </div>
              {(it.tg_id || it.username) && (
                <div style={{ marginTop: 6, color:'var(--muted)', fontWeight: 800, fontSize: 12 }}>
                  {it.username ? `@${it.username}` : ''} {it.tg_id ? `tg:${it.tg_id}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
