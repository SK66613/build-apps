import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';

export function CustomersPage(){
  const { appId } = useCabinetStore();
  const [query, setQuery] = useState('');

  const q = useQuery({
    queryKey: ['customers.list', appId, query],
    enabled: !!appId,
    queryFn: () => api.customers.list(appId!, { query, limit: 50 }) as Promise<any>,
  });

  const rows = useMemo(()=> (q.data?.customers || q.data?.items || q.data?.rows || []), [q.data]);

  return (
    <div>
      <h1 className="sg-h1">Customers</h1>
      <div className="sg-muted">Поиск, сегменты, карточка клиента</div>

      <div style={{ display:'flex', gap: 10, marginTop: 14 }}>
        <input className="sg-input" style={{ flex: 1 }} placeholder="username или tg_id" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <button className="sg-btn" onClick={()=>q.refetch()}>Search</button>
      </div>

      <div className="sg-card" style={{ marginTop: 14 }}>
        {q.isLoading && <div className="sg-muted">Загрузка…</div>}
        {q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}

        <div style={{ display:'grid', gap: 10 }}>
          {rows.map((u: any) => (
            <div key={u.tg_user_id || u.tg_id || u.id} style={{ padding: 12, borderRadius: 14, border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>@{u.tg_username || '—'} <span className="sg-muted">({u.tg_user_id || u.tg_id})</span></div>
                  <div className="sg-muted" style={{ fontSize: 12 }}>opens: {u.total_opens ?? 0} • spins: {u.total_spins ?? 0} • prizes: {u.total_prizes ?? 0}</div>
                </div>
                <button className="sg-btn" onClick={()=>alert('Drawer профиля клиента — следующий шаг UI')}>Open</button>
              </div>
            </div>
          ))}
          {!q.isLoading && !rows.length && <div className="sg-muted">Пусто</div>}
        </div>
      </div>
    </div>
  );
}
