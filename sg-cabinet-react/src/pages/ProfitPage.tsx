import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';
import { KpiCard } from '../components/KpiCard';

export function ProfitPage(){
  const { appId, range } = useCabinetStore();
  const q = useQuery({
    queryKey: ['profit.report', appId, range],
    enabled: !!appId,
    queryFn: () => api.profit.report(appId!, range) as Promise<any>,
  });

  const p = q.data?.profit || q.data;

  return (
    <div>
      <h1 className="sg-h1">Profit / ROI</h1>
      <div className="sg-muted">Выгода от мини-аппа: revenue, cost, net, ROI</div>

      <div className="sg-grid" style={{ marginTop: 14 }}>
        <div style={{ gridColumn: 'span 3' }}><KpiCard title="Revenue" value={p?.revenue ?? '—'} /></div>
        <div style={{ gridColumn: 'span 3' }}><KpiCard title="Reward cost" value={p?.reward_cost ?? '—'} /></div>
        <div style={{ gridColumn: 'span 3' }}><KpiCard title="Cashback cost" value={p?.cashback_cost ?? '—'} /></div>
        <div style={{ gridColumn: 'span 3' }}><KpiCard title="ROI" value={p?.roi ?? '—'} /></div>
      </div>

      <div className="sg-card" style={{ marginTop: 14 }}>
        {q.isLoading && <div className="sg-muted">Загрузка…</div>}
        {q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}
        {q.data && <pre style={{ margin:0, whiteSpace:'pre-wrap' }}>{JSON.stringify(q.data, null, 2)}</pre>}
      </div>
    </div>
  );
}
