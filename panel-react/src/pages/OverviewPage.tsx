import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';
import { KpiCard } from '../components/KpiCard';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function OverviewPage(){
  const { appId, range } = useCabinetStore();

  const q = useQuery({
    queryKey: ['dash.summary', appId, range],
    enabled: !!appId,
    queryFn: () => api.dashboard.summary(appId!, range) as Promise<any>,
  });

  const kpi = q.data?.kpi;
  const profit = q.data?.profit;

  // demo trend placeholder (you will replace with /sales/stats group=day)
  const trend = (q.data?.trend || []).length ? q.data.trend : [
    { day: range.from, revenue: 0 },
    { day: range.to, revenue: 0 },
  ];

  return (
    <div>
      <h1 className="sg-h1">Overview</h1>
      <div className="sg-muted">Сводка по выбранному проекту и периоду</div>

      {!appId && <div className="sg-card" style={{ marginTop: 14 }}>Выбери проект слева сверху</div>}

      {q.isLoading && <div className="sg-card" style={{ marginTop: 14 }}>Загрузка…</div>}
      {q.isError && <div className="sg-card" style={{ marginTop: 14 }}>Ошибка: {(q.error as Error).message}</div>}

      {q.data && (
        <>
          <div className="sg-grid" style={{ marginTop: 14 }}>
            <div style={{ gridColumn: 'span 3' }}><KpiCard title="Active users" value={kpi?.active_users ?? '—'} /></div>
            <div style={{ gridColumn: 'span 3' }}><KpiCard title="Opens" value={kpi?.opens ?? '—'} /></div>
            <div style={{ gridColumn: 'span 3' }}><KpiCard title="Sales" value={kpi?.sales_total ?? '—'} hint="total" /></div>
            <div style={{ gridColumn: 'span 3' }}><KpiCard title="Bookings" value={kpi?.bookings ?? '—'} /></div>

            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Prizes won" value={kpi?.prizes_won ?? '—'} /></div>
            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Prizes redeemed" value={kpi?.prizes_redeemed ?? '—'} /></div>
            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Coins issued" value={kpi?.coins_issued ?? '—'} /></div>
          </div>

          <div className="sg-grid" style={{ marginTop: 14 }}>
            <div className="sg-card" style={{ gridColumn: 'span 8' }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Revenue trend</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="sg-card" style={{ gridColumn: 'span 4' }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Profit / ROI</div>
              <div className="sg-muted">Revenue: <b>{profit?.revenue ?? '—'}</b></div>
              <div className="sg-muted">Reward cost: <b>{profit?.reward_cost ?? '—'}</b></div>
              <div className="sg-muted">Cashback cost: <b>{profit?.cashback_cost ?? '—'}</b></div>
              <div style={{ marginTop: 10, fontWeight: 900, fontSize: 22 }}>Net: {profit?.net_gain ?? '—'}</div>
              <div className="sg-muted">ROI: <b>{profit?.roi ?? '—'}</b></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
