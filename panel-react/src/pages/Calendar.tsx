import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card } from '../components/ui';

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_title?: string;
  resource_title?: string;
  tg_id?: string;
  price?: number;
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

export default function Calendar(){
  const { appId, range } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['bookings', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: Booking[] }>(`/api/cabinet/apps/${appId}/calendar/bookings?${qs(range)}`),
    staleTime: 5_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Calendar</h1>
        <div className="sg-sub">Записи клиентов, услуги, мастера, заполненность, no-show.</div>
      </div>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 10 }}>
          <div style={{ fontWeight: 950 }}>Записи</div>
          <Button variant="primary" onClick={() => alert('Дальше: CRUD services/resources/bookings')}>Создать запись</Button>
        </div>
        {q.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/calendar/bookings</code> в воркер.</div>}
        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead><tr><th>Start</th><th>Service</th><th>Resource</th><th>Status</th><th>Price</th><th>Client</th></tr></thead>
            <tbody>
              {(q.data?.items || []).map(b => (
                <tr key={b.id}>
                  <td>{b.starts_at}</td>
                  <td>{b.service_title || '—'}</td>
                  <td>{b.resource_title || '—'}</td>
                  <td>{b.status}</td>
                  <td>{b.price ?? '—'}</td>
                  <td>{b.tg_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
