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

type ProfitReport = {
  ok: true;
  revenue: number;
  cashback_cost: number;
  reward_cost: number;
  messaging_cost?: number;
  net_gain: number;
  roi: number;
  notes?: string[];
};

export default function Profit(){
  const { appId, range } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['profit', appId, range.from, range.to],
    queryFn: () => apiFetch<ProfitReport>(`/api/cabinet/apps/${appId}/profit/report?${qs(range)}`),
    staleTime: 10_000,
  });

  const d = q.data;

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Profit / ROI</h1>
        <div className="sg-sub">Считаем выгоду: выручка − (себестоимость призов + кэшбэк + рассылки).</div>
      </div>

      {q.isError && (
        <Card>
          <div style={{ fontWeight: 900 }}>Добавь эндпоинт <code>/profit/report</code> в воркер.</div>
          <div style={{ color:'var(--muted)', fontWeight: 800, marginTop: 6 }}>
            Для корректного ROI нужны таблицы: <code>profit_settings</code> (coin_value) и <code>reward_costs</code> (себестоимость).
          </div>
        </Card>
      )}

      <div className="sg-grid kpi">
        <Card><div style={{ color:'var(--muted)', fontWeight: 900 }}>Revenue</div><div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{d?.revenue ?? '—'}</div></Card>
        <Card><div style={{ color:'var(--muted)', fontWeight: 900 }}>Reward cost</div><div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{d?.reward_cost ?? '—'}</div></Card>
        <Card><div style={{ color:'var(--muted)', fontWeight: 900 }}>Cashback cost</div><div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{d?.cashback_cost ?? '—'}</div></Card>
        <Card><div style={{ color:'var(--muted)', fontWeight: 900 }}>ROI</div><div style={{ fontSize: 26, fontWeight: 1000, marginTop: 6 }}>{d ? d.roi.toFixed(2) : '—'}</div></Card>
      </div>

      <Card>
        <div style={{ fontWeight: 950 }}>Разбор</div>
        <div style={{ display:'grid', gap: 10, marginTop: 12, fontWeight: 850 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Выручка</span><span>{d?.revenue ?? '—'}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Себестоимость призов</span><span>{d?.reward_cost ?? '—'}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Кэшбэк / монеты</span><span>{d?.cashback_cost ?? '—'}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--muted)' }}>Рассылки</span><span>{d?.messaging_cost ?? 0}</span></div>
          <div style={{ height:1, background:'var(--border)', margin:'6px 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight: 1000 }}><span>Net gain</span><span>{d?.net_gain ?? '—'}</span></div>
        </div>
      </Card>
    </div>
  );
}
