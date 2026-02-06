import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCabinetStore } from '../lib/store';
import { KpiCard } from '../components/KpiCard';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;
  cost?: number;
  weight?: number;
  active?: number;
};

type ChartMode = 'bar' | 'line' | 'area';

function toInt(v: any, d = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

export function WheelPage(){
  const { appId, range } = useCabinetStore();
  const qc = useQueryClient();

  const [chartMode, setChartMode] = React.useState<ChartMode>('bar');
  const [tab, setTab] = React.useState<'live' | 'settings'>('live');

  const q = useQuery({
    queryKey: ['wheel.stats', appId, range],
    enabled: !!appId,
    queryFn: () => api.wheel.stats(appId!, range) as Promise<{ ok?: boolean; items?: PrizeStat[]; data?: any }>,
    staleTime: 10_000,
  });

  // live feed (reuse existing worker endpoint)
  const live = useQuery({
    queryKey: ['dash.activity', appId],
    enabled: !!appId && tab === 'live',
    queryFn: () => api.dashboard.activity(appId!, { limit: 50 }) as Promise<any>,
    refetchInterval: tab === 'live' ? 8_000 : false,
  });

  const items: PrizeStat[] = (q.data?.items || q.data?.data?.items || []) as PrizeStat[];
  const chartData = (items || []).map((p) => ({
    name: p.title || p.prize_code,
    wins: Number(p.wins || 0),
    redeemed: Number(p.redeemed || 0),
  }));

  const totals = React.useMemo(() => {
    let wins = 0;
    let redeemed = 0;
    for (const p of items){
      wins += Number(p.wins || 0);
      redeemed += Number(p.redeemed || 0);
    }
    const redeemRate = wins > 0 ? Math.round((redeemed / wins) * 100) : 0;
    return { wins, redeemed, redeemRate };
  }, [items]);

  const topPrizes = React.useMemo(() => {
    return [...items]
      .sort((a,b) => (Number(b.wins||0) - Number(a.wins||0)))
      .slice(0, 5);
  }, [items]);

  // =========================
  // Settings: weight/active editor (same mechanics as old Wheel.tsx)
  // =========================
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState('');

  React.useEffect(() => {
    if (!items.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of items){
        const key = p.prize_code;
        if (!key) continue;
        if (next[key] === undefined){
          next[key] = {
            weight: (p.weight ?? '') === null || (p.weight ?? '') === undefined ? '' : String(p.weight),
            active: !!p.active,
          };
        }
      }
      return next;
    });
  }, [items]);

  function setWeight(code: string, v: string){
    setDraft((d) => ({ ...d, [code]: { weight: v, active: !!d[code]?.active } }));
  }
  function toggleActive(code: string){
    setDraft((d) => ({ ...d, [code]: { weight: d[code]?.weight ?? '', active: !d[code]?.active } }));
  }

  async function save(){
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;
        const weight = Math.max(0, toInt(d.weight, 0));
        const active = d.active ? 1 : 0;
        return { prize_code: code, weight, active: active as 0 | 1 };
      })
      .filter(Boolean) as Array<{ prize_code: string; weight: number; active: 0 | 1 }>;

    if (!payloadItems.length){
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try{
      const r = await api.wheel.updatePrizes(appId, payloadItems);
      setSaveMsg(`Сохранено: ${r?.updated ?? payloadItems.length}`);
      await qc.invalidateQueries({ queryKey: ['wheel.stats', appId] });
    }catch(e: any){
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    }finally{
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 12 }}>
        <div>
          <h1 className="sg-h1">Wheel</h1>
          <div className="sg-muted">Статистика в стиле Ozon: график + KPI + топы + live + настройки весов</div>
        </div>

        <div className="sg-tabs" aria-label="chart mode">
          <button className={"sg-tab " + (chartMode === 'bar' ? 'is-active' : '')} onClick={() => setChartMode('bar')}>Столбцы</button>
          <button className={"sg-tab " + (chartMode === 'line' ? 'is-active' : '')} onClick={() => setChartMode('line')}>Линия</button>
          <button className={"sg-tab " + (chartMode === 'area' ? 'is-active' : '')} onClick={() => setChartMode('area')}>Area</button>
        </div>
      </div>

      {!appId && <div className="sg-card" style={{ marginTop: 14, padding: 14 }}>Выбери проект сверху</div>}

      <div className="sg-grid" style={{ marginTop: 14, gap: 14, alignItems:'start' }}>
        {/* ===== LEFT: main chart card (wide) ===== */}
        <div className="sg-card" style={{ gridColumn: 'span 8', padding: 16 }}>
          <div className="sg-row" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 950 }}>Динамика / распределение призов</div>
            <div className="sg-muted" style={{ fontSize: 12 }}>
              {range?.from} → {range?.to}
            </div>
          </div>

          {q.isLoading && <div className="sg-muted">Загрузка…</div>}
          {q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}

          {!q.isLoading && !q.isError && (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'bar' ? (
                  <BarChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="wins" />
                    <Bar dataKey="redeemed" />
                  </BarChart>
                ) : chartMode === 'line' ? (
                  <LineChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="wins" dot={false} />
                    <Line type="monotone" dataKey="redeemed" dot={false} />
                  </LineChart>
                ) : (
                  <AreaChart data={chartData} margin={{ left: 6, right: 10, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide={false} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="wins" />
                    <Area type="monotone" dataKey="redeemed" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="sg-grid" style={{ marginTop: 12, gap: 12 }}>
            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Wins" value={totals.wins || '—'} hint="выпадений" /></div>
            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Redeemed" value={totals.redeemed || '—'} hint="подтверждено" /></div>
            <div style={{ gridColumn: 'span 4' }}><KpiCard title="Redeem rate" value={(totals.wins ? totals.redeemRate : '—') + (totals.wins ? '%' : '')} hint="redeemed / wins" /></div>
          </div>
        </div>

        {/* ===== RIGHT: ozon-ish side cards ===== */}
        <div style={{ gridColumn: 'span 4', display:'grid', gap: 14 }}>
          <div className="sg-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>ТОП призов</div>
            <div className="sg-list">
              {topPrizes.map((p, idx) => (
                <div key={p.prize_code} className="sg-row">
                  <div style={{ display:'flex', alignItems:'center', gap: 10, minWidth: 0 }}>
                    <div className="sg-pill" style={{ padding:'6px 10px' }}>{idx + 1}</div>
                    <div style={{ fontWeight: 900, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title || p.prize_code}</div>
                  </div>
                  <div className="sg-muted" style={{ fontWeight: 900 }}>{p.wins}</div>
                </div>
              ))}
              {!topPrizes.length && <div className="sg-muted">Нет данных</div>}
            </div>
          </div>

          <div className="sg-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Сводка</div>
            <div className="sg-list">
              <div className="sg-row"><div className="sg-muted">Призов активных</div><div style={{ fontWeight: 950 }}>{items.filter(i => !!i.active).length}</div></div>
              <div className="sg-row"><div className="sg-muted">Призов всего</div><div style={{ fontWeight: 950 }}>{items.length || '—'}</div></div>
              <div className="sg-divider" />
              <div className="sg-row"><div className="sg-muted">Redeem rate</div><div style={{ fontWeight: 950 }}>{totals.wins ? totals.redeemRate + '%' : '—'}</div></div>
              <div className="sg-row"><div className="sg-muted">Выпадений</div><div style={{ fontWeight: 950 }}>{totals.wins || '—'}</div></div>
            </div>
          </div>

          <div className="sg-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Быстрые действия</div>
            <div className="sg-list">
              <button className={"sg-btn " + (tab === 'live' ? 'sg-btn--primary' : '')} onClick={() => setTab('live')}>Live</button>
              <button className={"sg-btn " + (tab === 'settings' ? 'sg-btn--primary' : '')} onClick={() => setTab('settings')}>Настройки / Веса</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bottom area: live / settings ===== */}
      <div className="sg-grid" style={{ marginTop: 14, gap: 14, alignItems:'start' }}>
        <div className="sg-card" style={{ gridColumn: 'span 8', padding: 16 }}>
          {tab === 'live' ? (
            <>
              <div className="sg-row" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 950 }}>Live (последние события)</div>
                <div className="sg-muted" style={{ fontSize: 12 }}>{live.isFetching ? 'обновляю…' : 'auto refresh'}</div>
              </div>

              {live.isLoading && <div className="sg-muted">Загрузка…</div>}
              {live.isError && <div className="sg-muted">Ошибка: {(live.error as Error).message}</div>}

              <div className="sg-list">
                {(live.data?.items || live.data?.events || []).slice(0, 30).map((it: any, idx: number) => (
                  <div key={it.id || idx} style={{ padding: 12, border:'1px solid var(--border)', borderRadius: 14, background:'rgba(255,255,255,.35)' }}>
                    <div style={{ fontWeight: 950 }}>{it.title || it.type || 'event'}</div>
                    <div className="sg-muted" style={{ fontSize: 12 }}>{it.ts || it.created_at || ''} • tg: {it.tg_id || it.tg_user_id || ''}</div>
                    {it.payload && (
                      <div className="sg-muted" style={{ marginTop: 6, fontSize: 12, whiteSpace:'pre-wrap' }}>
                        {typeof it.payload === 'string' ? it.payload : JSON.stringify(it.payload)}
                      </div>
                    )}
                  </div>
                ))}

                {!live.isLoading && !(live.data?.items || live.data?.events || []).length && (
                  <div className="sg-muted">Пока пусто</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="sg-row" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 950 }}>Настройки (runtime override)</div>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  {saveMsg && <div className="sg-muted" style={{ fontWeight: 850 }}>{saveMsg}</div>}
                  <button className="sg-btn sg-btn--primary" disabled={saving || q.isLoading || !appId} onClick={save}>
                    {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                  </button>
                </div>
              </div>

              <div style={{ overflow:'auto' }}>
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Code</th>
                      <th>Title</th>
                      <th style={{ width: 90 }}>Wins</th>
                      <th style={{ width: 110 }}>Redeemed</th>
                      <th style={{ minWidth: 180 }}>Weight</th>
                      <th style={{ width: 120 }}>Active</th>
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
                            <input
                              className="sg-input"
                              value={d.weight}
                              onChange={(e) => setWeight(p.prize_code, (e.target as HTMLInputElement).value)}
                              placeholder="weight"
                              style={{ padding: '10px 12px' }}
                            />
                          </td>
                          <td>
                            <label style={{ display:'flex', alignItems:'center', gap: 10 }}>
                              <input type="checkbox" checked={!!d.active} onChange={() => toggleActive(p.prize_code)} />
                              <span style={{ fontWeight: 900 }}>{d.active ? 'on' : 'off'}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                    {!items.length && !q.isLoading && (
                      <tr><td colSpan={6} className="sg-muted" style={{ padding: 14 }}>Нет призов.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* right bottom: placeholder for future widgets */}
        <div className="sg-card" style={{ gridColumn: 'span 4', padding: 16 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Идеи для next widgets</div>
          <div className="sg-muted" style={{ lineHeight: 1.45 }}>
            • Себестоимость призов (cost) + ROI по колесу<br/>
            • Подозрительные призы: много wins, мало redeemed<br/>
            • Рекомендации по weight (авто-баланс)<br/>
            • Конфиги: spin_cost, лимиты, блокировка «крутить» если есть незабранный приз
          </div>
        </div>
      </div>
    </div>
  );
}
