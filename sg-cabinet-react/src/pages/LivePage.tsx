import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';

export function LivePage(){
  const { appId } = useCabinetStore();
  const q = useQuery({
    queryKey: ['dash.activity', appId],
    enabled: !!appId,
    queryFn: () => api.dashboard.activity(appId!, { limit: 100 }) as Promise<any>,
    refetchInterval: 8_000,
  });

  const items = q.data?.items || q.data?.events || [];

  return (
    <div>
      <h1 className="sg-h1">Live</h1>
      <div className="sg-muted">Реалтайм-лента активности (auto refresh)</div>

      <div className="sg-card" style={{ marginTop: 14 }}>
        {q.isLoading && <div className="sg-muted">Загрузка…</div>}
        {q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}
        {!q.isLoading && !items.length && <div className="sg-muted">Пока пусто</div>}

        <div style={{ display:'grid', gap: 10 }}>
          {items.map((it: any, idx: number) => (
            <div key={it.id || idx} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 14, background: 'rgba(255,255,255,.35)' }}>
              <div style={{ fontWeight: 900 }}>{it.title || it.type || 'event'}</div>
              <div className="sg-muted" style={{ fontSize: 12 }}>{it.ts || it.created_at || ''} • tg: {it.tg_id || it.tg_user_id || ''}</div>
              {it.payload && <div className="sg-muted" style={{ marginTop: 6, fontSize: 12, whiteSpace:'pre-wrap' }}>{typeof it.payload === 'string' ? it.payload : JSON.stringify(it.payload)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
