// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
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

type ActivityItem = {
  ts?: string;
  type?: string;
  label?: string;
  user?: string;
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function toInt(v: any, d = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

function clampN(n: any, min: number, max: number){
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export default function Wheel(){
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');
  const [section, setSection] = React.useState<'stats'|'live'|'settings'>('stats');

  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(
      `/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && section === 'live',
    queryKey: ['wheel.live', appId, range.from, range.to],
    queryFn: async () => {
      // используем общий activity
      return apiFetch<{ ok: true; items: ActivityItem[] }>(
        `/api/cabinet/apps/${appId}/activity?${qs(range)}`
      );
    },
    staleTime: 5_000,
    refetchInterval: 7_000,
    retry: 0,
  });

  const items = qStats.data?.items || [];

  // KPI
  const totalWins = items.reduce((s, p) => s + (Number(p.wins) || 0), 0);
  const totalRedeemed = items.reduce((s, p) => s + (Number(p.redeemed) || 0), 0);
  const redeemRate = totalWins > 0 ? Math.round((totalRedeemed / totalWins) * 100) : 0;

  // Chart data (оставим все призы, но можно ограничить топом)
  const chartData = items.map(p => ({
    title: p.title || p.prize_code,
    wins: Number(p.wins) || 0,
    redeemed: Number(p.redeemed) || 0,
  }));

  // Top prizes (по wins)
  const top = [...items]
    .sort((a,b) => (Number(b.wins)||0) - (Number(a.wins)||0))
    .slice(0, 7);

  // ===== Settings form draft =====
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  React.useEffect(() => {
    if (!items.length) return;
    setDraft(prev => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qStats.data?.items]);

  function setWeight(code: string, v: string){
    setDraft(d => ({ ...d, [code]: { weight: v, active: !!d[code]?.active } }));
  }
  function toggleActive(code: string){
    setDraft(d => ({ ...d, [code]: { weight: d[code]?.weight ?? '', active: !d[code]?.active } }));
  }

  async function save(){
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;

        const weight = clampN(toInt(d.weight, 0), 0, 1_000_000);
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
      await qc.invalidateQueries({ queryKey: ['wheel', appId] });
    }catch(e: any){
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    }finally{
      setSaving(false);
    }
  }

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Wheel</h1>
          <div className="sg-sub">График + KPI + топы + live + настройка весов (runtime override).</div>
        </div>

        <div className="sg-tabs">
          <button className={'sg-tab ' + (chartMode==='bar' ? 'is-active' : '')} onClick={() => setChartMode('bar')}>Столбцы</button>
          <button className={'sg-tab ' + (chartMode==='line' ? 'is-active' : '')} onClick={() => setChartMode('line')}>Линия</button>
          <button className={'sg-tab ' + (chartMode==='area' ? 'is-active' : '')} onClick={() => setChartMode('area')}>Area</button>
        </div>
      </div>

      {/* 2 колонки */}
      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          {/* SECTION TABS */}
          <div className="wheelSectionTabs">
            <div className="sg-tabs">
              <button className={'sg-tab ' + (section==='stats' ? 'is-active' : '')} onClick={() => setSection('stats')}>Статистика</button>
              <button className={'sg-tab ' + (section==='live' ? 'is-active' : '')} onClick={() => setSection('live')}>Live</button>
              <button className={'sg-tab ' + (section==='settings' ? 'is-active' : '')} onClick={() => setSection('settings')}>Настройки</button>
            </div>
          </div>

          {section === 'stats' && (
            <>
              <Card className="wheelCard">
                <div className="wheelCardHead">
                  <div>
                    <div className="wheelCardTitle">Распределение призов</div>
                    <div className="wheelCardSub">{range.from} — {range.to}</div>
                  </div>
                </div>

                <div className="wheelChart">
                  {qStats.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qStats.isError && <div className="sg-muted">Ошибка: {(qStats.error as Error).message}</div>}

                  {!qStats.isLoading && !qStats.isError && (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartMode === 'bar' ? (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={42} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="wins" fill="var(--accent)" radius={[10,10,0,0]} />
                          <Bar dataKey="redeemed" fill="var(--accent2)" radius={[10,10,0,0]} />
                        </BarChart>
                      ) : chartMode === 'line' ? (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={42} />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="wins" stroke="var(--accent)" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="redeemed" stroke="var(--accent2)" strokeWidth={3} dot={false} />
                        </LineChart>
                      ) : (
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={42} />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="wins" stroke="var(--accent)" fill="var(--accentSoft)" strokeWidth={2} />
                          <Area type="monotone" dataKey="redeemed" stroke="var(--accent2)" fill="rgba(59,130,246,.10)" strokeWidth={2} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="wheelKpiRow">
                  <div className="wheelKpi">
                    <div className="wheelKpiLbl">Wins</div>
                    <div className="wheelKpiVal">{totalWins}</div>
                  </div>
                  <div className="wheelKpi">
                    <div className="wheelKpiLbl">Redeemed</div>
                    <div className="wheelKpiVal">{totalRedeemed}</div>
                  </div>
                  <div className="wheelKpi">
                    <div className="wheelKpiLbl">Redeem rate</div>
                    <div className="wheelKpiVal">{redeemRate}%</div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {section === 'live' && (
            <Card className="wheelCard">
              <div className="wheelCardHead">
                <div>
                  <div className="wheelCardTitle">Live (последние события)</div>
                  <div className="wheelCardSub">auto refresh</div>
                </div>
              </div>

              {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}

              {qLive.isError && (
                <div className="sg-muted">
                  Ошибка: {(qLive.error as Error).message}
                  <div style={{ marginTop: 8 }}>
                    Если видишь <b>Not found</b> — значит в воркере нет эндпоинта <code>/activity</code>.
                  </div>
                </div>
              )}

              {qLive.data?.items?.length ? (
                <div className="wheelLiveList">
                  {qLive.data.items.slice(0, 20).map((e, i) => (
                    <div className="wheelLiveRow" key={i}>
                      <div className="wheelLiveType">{e.type || 'event'}</div>
                      <div className="wheelLiveLabel">{e.label || e.user || '—'}</div>
                      <div className="wheelLiveTs">{e.ts || ''}</div>
                    </div>
                  ))}
                </div>
              ) : (!qLive.isLoading && !qLive.isError) ? (
                <div className="sg-muted">Пока пусто</div>
              ) : null}
            </Card>
          )}

          {section === 'settings' && (
            <Card className="wheelCard">
              <div className="wheelCardHead wheelCardHeadRow">
                <div>
                  <div className="wheelCardTitle">Настройки (runtime override)</div>
                  <div className="wheelCardSub">Меняешь weight/active → сохраняешь → воркер применяет в рантайме.</div>
                </div>

                <div className="wheelSave">
                  {saveMsg && <div className="wheelSaveMsg">{saveMsg}</div>}
                  <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={save}>
                    {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                  </Button>
                </div>
              </div>

              {qStats.isError && (
                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  Ошибка загрузки. Проверь эндпоинт <code>/wheel/stats</code> в воркере.
                </div>
              )}

              <div className="wheelTableWrap">
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Wins</th>
                      <th>Redeemed</th>
                      <th style={{ minWidth: 240 }}>Weight</th>
                      <th style={{ minWidth: 120 }}>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };
                      return (
                        <tr key={p.prize_code}>
                          <td><b>{p.prize_code}</b></td>
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
                    {!items.length && !qStats.isLoading && (
                      <tr><td colSpan={6} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Топ призов</div>
            </div>

            <div className="wheelTopList">
              {top.map((p, idx) => (
                <div className="wheelTopRow" key={p.prize_code}>
                  <div className="wheelTopIdx">{idx + 1}</div>
                  <div className="wheelTopTitle">{p.title}</div>
                  <div className="wheelTopVal">{p.wins}</div>
                </div>
              ))}
              {!top.length && <div className="sg-muted">Пока пусто</div>}
            </div>
          </Card>

          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Сводка</div>
            </div>

            <div className="wheelSummary">
              <div className="wheelSummaryRow"><span className="sg-muted">Активных призов</span><b>{items.filter(i => (Number(i.active)||0) ? true : false).length}</b></div>
              <div className="wheelSummaryRow"><span className="sg-muted">Всего призов</span><b>{items.length}</b></div>
              <div className="wheelSummaryRow"><span className="sg-muted">Redeem rate</span><b>{redeemRate}%</b></div>
            </div>
          </Card>

          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Режим</div>
            </div>

            <div className="wheelMode">
              <div className="sg-tabs wheelModeTabs">
                <button className={'sg-tab ' + (section==='live' ? 'is-active' : '')} onClick={() => setSection('live')}>Live</button>
                <button className={'sg-tab ' + (section==='settings' ? 'is-active' : '')} onClick={() => setSection('settings')}>Настройки / Веса</button>
                <button className={'sg-tab ' + (section==='stats' ? 'is-active' : '')} onClick={() => setSection('stats')}>Статистика</button>
              </div>
            </div>
          </Card>

          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Идеи next widgets</div>
            </div>
            <div className="wheelIdeas">
              <div className="sg-muted">• Себестоимость (cost) + ROI по колесу</div>
              <div className="sg-muted">• “Проблемные призы”: много wins, мало redeemed</div>
              <div className="sg-muted">• Авто-рекомендации по weight</div>
              <div className="sg-muted">• Блокировка “крутить”, если есть незабранный приз</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
