import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card } from '../components/ui';

type PassportStage = { stage: string; users: number };

type RewardRow = { prize_code: string; title: string; issued: number; redeemed: number };

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

export default function Passport(){
  const { appId, range } = useAppState();
  const q = useQuery({
    enabled: !!appId,
    queryKey: ['passport', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; stages: PassportStage[]; rewards: RewardRow[] }>(`/api/cabinet/apps/${appId}/passport/stats?${qs(range)}`),
    staleTime: 10_000,
  });

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Passport</h1>
        <div className="sg-sub">Сколько собирают штампов, где отваливаются, какие награды подтверждают.</div>
      </div>

      <div className="sg-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 950 }}>Стадии</div>
          {q.isError && <div style={{ marginTop: 10, fontWeight: 900 }}>Добавь эндпоинт <code>/passport/stats</code> в воркер.</div>}
          <div style={{ display:'grid', gap: 10, marginTop: 12 }}>
            {(q.data?.stages || []).map(s => (
              <div key={s.stage} style={{ display:'flex', justifyContent:'space-between', border:'1px solid var(--border)', borderRadius:14, padding:10 }}>
                <span style={{ fontWeight: 950 }}>{s.stage}</span>
                <span style={{ fontWeight: 950 }}>{s.users}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 950 }}>Награды</div>
          <div style={{ overflow:'auto', marginTop: 12 }}>
            <table className="sg-table">
              <thead><tr><th>Code</th><th>Title</th><th>Issued</th><th>Redeemed</th></tr></thead>
              <tbody>
                {(q.data?.rewards || []).map(r => (
                  <tr key={r.prize_code}><td>{r.prize_code}</td><td>{r.title}</td><td>{r.issued}</td><td>{r.redeemed}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
