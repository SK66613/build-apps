import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input } from '../components/ui';

type CustomerListItem = {
  tg_id: string;
  username?: string;
  coins?: number;
  last_seen?: string;
  created_at?: string;
  stamps_progress?: string;
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

export default function Customers(){
  const { appId, range } = useAppState();
  const [query, setQuery] = React.useState('');

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['customers', appId, range.from, range.to, query],
    queryFn: () => apiFetch<{ ok: true; items: CustomerListItem[] }>(
      `/api/cabinet/apps/${appId}/customers?${qs({ ...range, query, limit: 50 })}`
    ),
    staleTime: 5_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Customers</h1>
        <div className="sg-sub">Поиск клиентов, сегменты, профили, монеты, прогресс паспорта, история.</div>
      </div>

      <Card>
        <div style={{ display:'flex', gap: 10, alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight: 950 }}>Список клиентов</div>
          <Input placeholder="Поиск: @username, tg_id" value={query} onChange={e=>setQuery(e.target.value)} style={{ maxWidth: 360 }} />
        </div>

        {q.isError && (
          <div style={{ marginTop: 12, fontWeight: 900 }}>
            Нет эндпоинта <code>/customers</code> или ошибка.
          </div>
        )}

        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead>
              <tr>
                <th>TG</th>
                <th>Username</th>
                <th>Coins</th>
                <th>Passport</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.items || []).map((u) => (
                <tr key={u.tg_id}>
                  <td>{u.tg_id}</td>
                  <td>{u.username ? '@'+u.username : '—'}</td>
                  <td>{u.coins ?? '—'}</td>
                  <td>{u.stamps_progress ?? '—'}</td>
                  <td>{u.last_seen || u.created_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
