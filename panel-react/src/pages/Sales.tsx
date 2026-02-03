import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card } from '../components/ui';

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

type SalesRow = { day?: string; cashier?: string; total: number; checks: number; avg_check?: number };

export default function Sales(){
  const { appId, range } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['sales', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; rows: SalesRow[] }>(`/api/cabinet/apps/${appId}/sales/stats?${qs({ ...range, group: 'day' })}`),
    staleTime: 10_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Sales</h1>
        <div className="sg-sub">Продажи по QR/кассирам, средний чек, эффективность кэшбэка.</div>
      </div>

      <Card>
        <div style={{ fontWeight: 950 }}>Сводка продаж</div>
        {q.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/sales/stats</code> в воркер.</div>}
        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead><tr><th>Day</th><th>Total</th><th>Checks</th><th>Avg</th></tr></thead>
            <tbody>
              {(q.data?.rows || []).map((r, idx) => (
                <tr key={r.day || idx}>
                  <td>{r.day || '—'}</td>
                  <td>{r.total}</td>
                  <td>{r.checks}</td>
                  <td>{r.avg_check ?? (r.checks ? Math.round(r.total / r.checks) : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
