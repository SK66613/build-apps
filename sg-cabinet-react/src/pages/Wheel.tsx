import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;
  cost?: number;
  weight?: number;
  active?: number;
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  return p.toString();
}

function toInt(v: any, d = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

export default function Wheel(){
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });

  // локальная форма редактирования
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  // когда пришли данные — инициализируем draft
  React.useEffect(() => {
    const items = q.data?.items || [];
    if (!items.length) return;

    setDraft((prev) => {
      // чтобы не затирать правки пользователя при рефетче —
      // только добавим отсутствующие ключи
      const next = { ...prev };
      for (const p of items) {
        const key = p.prize_code;
        if (!key) continue;
        if (next[key] === undefined) {
          next[key] = {
            weight: (p.weight ?? '') === null || (p.weight ?? '') === undefined ? '' : String(p.weight),
            active: !!p.active,
          };
        }
      }
      return next;
    });
  }, [q.data?.items]);

  const items = q.data?.items || [];

  function setWeight(code: string, v: string){
    setDraft((d) => ({ ...d, [code]: { weight: v, active: !!d[code]?.active } }));
  }
  function toggleActive(code: string){
    setDraft((d) => ({ ...d, [code]: { weight: d[code]?.weight ?? '', active: !d[code]?.active } }));
  }

  async function save(){
    if (!appId) return;
    setSaveMsg('');

    // собираем payload только по тем кодам, которые есть в таблице
    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;

        const weight = Math.max(0, toInt(d.weight, 0));
        const active = d.active ? 1 : 0;

        return { prize_code: code, weight, active };
      })
      .filter(Boolean) as Array<{ prize_code: string; weight: number; active: 0 | 1 }>;

    if (!payloadItems.length){
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try{
      const r = await apiFetch<{ ok: true; updated: number }>(
        `/api/cabinet/apps/${appId}/wheel/prizes`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: payloadItems }),
        }
      );

      setSaveMsg(`Сохранено: ${r.updated}`);
      // перезагружаем stats (чтобы подтянуть актуальные weight/active если надо)
      await qc.invalidateQueries({ queryKey: ['wheel', appId] });

    }catch(e: any){
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    }finally{
      setSaving(false);
    }
  }

  return (
    <div className="sg-grid" style={{ gap: 18 }}>
      <div>
        <h1 className="sg-h1">Wheel</h1>
        <div className="sg-sub">Аналитика выпадений, подтверждения, себестоимость + управление шансами.</div>
      </div>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 10 }}>
          <div style={{ fontWeight: 950 }}>Призы</div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            {saveMsg && <div style={{ fontWeight: 800, opacity: 0.8 }}>{saveMsg}</div>}
            <Button variant="primary" disabled={saving || q.isLoading || !appId} onClick={save}>
              {saving ? 'Сохраняю…' : 'Сохранить изменения'}
            </Button>
          </div>
        </div>

        {q.isError && (
          <div style={{ marginTop: 10, fontWeight: 900 }}>
            Ошибка загрузки. Проверь эндпоинт <code>/wheel/stats</code> в воркере.
          </div>
        )}

        <div style={{ overflow:'auto', marginTop: 12 }}>
          <table className="sg-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Wins</th>
                <th>Redeemed</th>
                <th style={{ minWidth: 180 }}>Weight</th>
                <th style={{ minWidth: 120 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };
                return (
                  <tr key={p.prize_code}>
                    <td>{p.prize_code}</td>
                    <td>{p.title}</td>
                    <td>{p.wins}</td>
                    <td>{p.redeemed}</td>
                    <td>
                      <Input
                        value={d.weight}
                        onChange={(e: any) => setWeight(p.prize_code, e.target.value)}
                        placeholder="weight"
                      />
                    </td>
                    <td>
                      <label style={{ display:'flex', alignItems:'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={!!d.active}
                          onChange={() => toggleActive(p.prize_code)}
                        />
                        <span style={{ fontWeight: 800 }}>{d.active ? 'on' : 'off'}</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
              {!items.length && !q.isLoading && (
                <tr><td colSpan={6} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
