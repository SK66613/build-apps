import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

type ProfitSettings = { coin_value: number };

type RewardCost = { prize_code: string; cost: number };

export default function Settings(){
  const { appId } = useAppState();
  const profitQ = useQuery({
    enabled: !!appId,
    queryKey: ['profit_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: ProfitSettings }>(`/api/cabinet/apps/${appId}/settings/profit`),
    staleTime: 15_000,
  });
  const costsQ = useQuery({
    enabled: !!appId,
    queryKey: ['reward_costs', appId],
    queryFn: () => apiFetch<{ ok: true; items: RewardCost[] }>(`/api/cabinet/apps/${appId}/settings/reward_costs`),
    staleTime: 15_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Settings</h1>
        <div className="sg-sub">Настройки выгоды и себестоимости (для корректного ROI) + системные параметры.</div>
      </div>

      <Card>
        <div style={{ fontWeight: 950 }}>Coin value</div>
        <div style={{ color:'var(--muted)', fontWeight: 800, marginTop: 6 }}>Сколько стоит 1 монета (в рублях скидки/себестоимости).</div>
        {profitQ.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/settings/profit</code>.</div>}
        <div style={{ display:'flex', gap: 10, marginTop: 12, alignItems:'center' }}>
          <Input defaultValue={String(profitQ.data?.settings?.coin_value ?? 1)} style={{ maxWidth: 140 }} />
          <Button variant="primary" onClick={() => alert('PUT /settings/profit')}>Сохранить</Button>
        </div>
      </Card>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight: 950 }}>Себестоимость призов</div>
            <div style={{ color:'var(--muted)', fontWeight: 800, marginTop: 4 }}>Для wheel/passport: prize_code → cost.</div>
          </div>
          <Button variant="primary" onClick={() => alert('PUT /settings/reward_costs')}>Сохранить</Button>
        </div>

        {costsQ.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/settings/reward_costs</code>.</div>}

        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead><tr><th>Prize code</th><th>Cost</th></tr></thead>
            <tbody>
              {(costsQ.data?.items || []).map(r => (
                <tr key={r.prize_code}>
                  <td>{r.prize_code}</td>
                  <td style={{ width: 200 }}><Input defaultValue={String(r.cost)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
