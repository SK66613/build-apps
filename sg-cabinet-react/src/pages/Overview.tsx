import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card } from '../components/ui';
import type { SummaryResponse } from '../lib/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

export default function Overview(){
  const { appId, range } = useAppState();

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['summary', appId, range.from, range.to, range.tz],
    queryFn: () => apiFetch<SummaryResponse>(`/api/cabinet/apps/${appId}/summary?${qs(range)}`),
    staleTime: 10_000,
  });

  const kpi = q.data?.kpi || {};
  const profit = q.data?.profit;

  // temporary chart stub: server can return series later
  const chartData = [
    { day: range.from, revenue: profit?.revenue || 0, cost: (profit?.reward_cost||0) + (profit?.cashback_cost||0) },
    { day: range.to, revenue: profit?.revenue || 0, cost: (profit?.reward_cost||0) + (profit?.cashback_cost||0) },
  ];

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Overview</h1>
        <div className="sg-sub">Состояние проекта, продажи, активность, монетизация и стоимость бонусов.</div>
      </div>

      {q.isError && (
        <Card>
          <div style={{ fontWeight: 900 }}>Ошибка загрузки summary.</div>
          <div style={{ color: 'var(--muted)', fontWeight: 700, marginTop: 6 }}>
            Скорее всего эндпоинт ещё не добавлен в воркер: <code>/api/cabinet/apps/:appId/summary</code>
          </div>
        </Card>
      )}

      <div className="sg-grid kpi">
        <Card>
          <div style={{ color:'var(--muted)', fontWeight: 900 }}>Активные</div>
          <div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{kpi.active_users ?? '—'}</div>
        </Card>
        <Card>
          <div style={{ color:'var(--muted)', fontWeight: 900 }}>Новые</div>
          <div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{kpi.new_users ?? '—'}</div>
        </Card>
        <Card>
          <div style={{ color:'var(--muted)', fontWeight: 900 }}>Продажи</div>
          <div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{kpi.sales_total ?? '—'}</div>
        </Card>
        <Card>
          <div style={{ color:'var(--muted)', fontWeight: 900 }}>ROI</div>
          <div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{profit ? profit.roi.toFixed(2) : '—'}</div>
        </Card>
      </div>

      <div className="sg-grid" style={{ gridTemplateColumns: '1.4fr .9fr', gap: 16 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12 }}>
            <div>
              <div style={{ fontWeight: 950 }}>Revenue vs Bonus Cost</div>
              <div style={{ color:'var(--muted)', fontWeight: 800, fontSize: 12, marginTop: 3 }}>
                Когда добавим серверную серию по дням — график станет реальным.
              </div>
            </div>
          </div>
          <div style={{ height: 260, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="day" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="currentColor" dot={false} />
                <Line type="monotone" dataKey="cost" stroke="currentColor" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 950 }}>Выгода</div>
          <div style={{ display:'grid', gap: 10, marginTop: 12, fontWeight: 850 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Выручка</span><span>{profit?.revenue ?? '—'}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Себестоимость призов</span><span>{profit?.reward_cost ?? '—'}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Кэшбэк / монеты</span><span>{profit?.cashback_cost ?? '—'}</span></div>
            <div style={{ height:1, background:'var(--border)', margin:'6px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight: 1000 }}><span>Net</span><span>{profit?.net_gain ?? '—'}</span></div>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 950 }}>Ключевые метрики</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 12 }}>
          {[
            ['Opens', kpi.opens],
            ['Spins', kpi.spins],
            ['Prizes won', kpi.prizes_won],
            ['Prizes redeemed', kpi.prizes_redeemed],
            ['Coins issued', kpi.coins_issued],
            ['Sales checks', kpi.sales_checks],
            ['Bookings', kpi.bookings],
            ['Bookings done', kpi.bookings_completed],
          ].map(([label, val]) => (
            <div key={label} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ color:'var(--muted)', fontWeight: 900, fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 1000, marginTop: 6 }}>{val ?? '—'}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
