import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

type PrizeStat = { prize_code: string; title: string; wins: number; redeemed: number; cost?: number; weight?: number; active?: number };

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

export default function Wheel(){
  const { appId, range } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Wheel</h1>
        <div className="sg-sub">Аналитика выпадений, подтверждения, себестоимость + управление шансами.</div>
      </div>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 10 }}>
          <div style={{ fontWeight: 950 }}>Призы</div>
          <Button variant="primary" onClick={() => alert('Дальше: PUT /wheel/prizes (runtime override)')}>Сохранить изменения</Button>
        </div>
        {q.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/wheel/stats</code> в воркер.</div>}

        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead><tr><th>Code</th><th>Title</th><th>Wins</th><th>Redeemed</th><th>Weight</th><th>Active</th></tr></thead>
            <tbody>
              {(q.data?.items || []).map((p) => (
                <tr key={p.prize_code}>
                  <td>{p.prize_code}</td>
                  <td>{p.title}</td>
                  <td>{p.wins}</td>
                  <td>{p.redeemed}</td>
                  <td style={{ minWidth: 160 }}>
                    <Input defaultValue={String(p.weight ?? '')} placeholder="weight" />
                  </td>
                  <td>{p.active ? 'on' : 'off'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
