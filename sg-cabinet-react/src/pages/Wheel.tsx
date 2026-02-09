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

/* ===== SVG icons for chart mode ===== */
function IcoBars(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IcoLine(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoArea(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18"/>
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function Wheel(){
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');

  // под графиком переключаем только Live / Settings
  const [panel, setPanel] = React.useState<'live'|'settings'>('live');

  const [topMetric, setTopMetric] = React.useState<'wins'|'redeemed'>('wins');

  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(
      `/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && panel === 'live',
    queryKey: ['wheel.live', appId, range.from, range.to],
    queryFn: async () => {
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

  // Chart data
  const chartData = items.map(p => ({
    title: p.title || p.prize_code,
    wins: Number(p.wins) || 0,
    redeemed: Number(p.redeemed) || 0,
  }));

  // Top prizes
const top = [...items]
  .sort((a,b) => (Number((b as any)[topMetric])||0) - (Number((a as any)[topMetric])||0))
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
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          {/* CHART ALWAYS VISIBLE */}

          
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Распределение призов</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              {/* SVG chart-mode buttons ON the chart card */}
              <div className="wheelChartBtns" role="tablist" aria-label="Chart type">
                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='bar' ? 'is-active' : '')}
                  onClick={() => setChartMode('bar')}
                  title="Столбцы"
                  aria-label="Столбцы"
                ><IcoBars/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='line' ? 'is-active' : '')}
                  onClick={() => setChartMode('line')}
                  title="Линия"
                  aria-label="Линия"
                ><IcoLine/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='area' ? 'is-active' : '')}
                  onClick={() => setChartMode('area')}
                  title="Area"
                  aria-label="Area"
                ><IcoArea/></button>
              </div>
            </div>

            <div className="wheelChart">
              {qStats.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qStats.isError && <div className="sg-muted">Ошибка: {(qStats.error as Error).message}</div>}

              {!qStats.isLoading && !qStats.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <BarChart data={chartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="wins" fill="var(--accent)" radius={[10,10,4,4]} />
                      <Bar dataKey="redeemed" fill="var(--accent2)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="wins" stroke="var(--accent)" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="redeemed" stroke="var(--accent2)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="wins" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.16} strokeWidth={3} />
                      <Area type="monotone" dataKey="redeemed" stroke="var(--accent2)" fill="var(--accent2)" fillOpacity={0.12} strokeWidth={3} />
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

            {/* SWITCHER UNDER CHART (Live / Settings) */}
            <div className="wheelUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='live' ? 'is-active' : '')} onClick={() => setPanel('live')}>
                  Live
                </button>
                <button className={'sg-tab ' + (panel==='settings' ? 'is-active' : '')} onClick={() => setPanel('settings')}>
                  Настройки
                </button>
              </div>

              {panel === 'live' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Live (последние события)</div>
                      <div className="wheelCardSub">auto refresh</div>
                    </div>
                    <div className="sg-pill" style={{ padding: '8px 12px' }}>
                      {qLive.isFetching ? 'обновляю…' : 'готово'}
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
                      {qLive.data.items.slice(0, 16).map((e, i) => (
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
                </div>
              )}

              {panel === 'settings' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
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
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">




<Card className="wheelCard">
  <div className="wheelCardHead">
    <div className="wheelCardTitle">Сводка</div>
  </div>

  <div className="wheelSummaryPro">
    <div className="wheelSummaryTiles">
      <div className="wheelSumTile">
        <div className="wheelSumLbl">Активных</div>
        <div className="wheelSumVal">{items.filter(i => (Number(i.active)||0) ? true : false).length}</div>
      </div>

      <div className="wheelSumTile">
        <div className="wheelSumLbl">Всего</div>
        <div className="wheelSumVal">{items.length}</div>
      </div>

      <div className="wheelSumTile is-strong">
        <div className="wheelSumLbl">Redeem</div>
        <div className="wheelSumVal">{redeemRate}%</div>
      </div>
    </div>

    <div className="wheelRedeemBar">
      <div className="wheelRedeemTop">
        <div className="wheelRedeemName">Redeem rate</div>
        <div className={"wheelRedeemBadge " + (redeemRate >= 70 ? 'ok' : redeemRate >= 40 ? 'mid' : 'bad')}>
          {redeemRate >= 70 ? 'OK' : redeemRate >= 40 ? 'RISK' : 'BAD'}
        </div>
      </div>

      <div className="wheelBarTrack" aria-hidden="true">
        <div className="wheelBarFill" style={{ width: `${Math.max(0, Math.min(100, redeemRate))}%` }} />
      </div>

      <div className="wheelRedeemMeta">
        <span className="sg-muted">Wins: <b>{totalWins}</b></span>
        <span className="sg-muted">Redeemed: <b>{totalRedeemed}</b></span>
      </div>
    </div>
  </div>
</Card>



          

          <Card className="wheelCard wheelStickyTop">
  <div className="wheelCardHead wheelTopHead">
    <div className="wheelCardTitle">Топ призов</div>

    <div className="sg-tabs wheelMiniTabs">
      <button
        type="button"
        className={'sg-tab ' + (topMetric==='wins' ? 'is-active' : '')}
        onClick={() => setTopMetric('wins')}
      >
        Wins
      </button>
      <button
        type="button"
        className={'sg-tab ' + (topMetric==='redeemed' ? 'is-active' : '')}
        onClick={() => setTopMetric('redeemed')}
      >
        Redeemed
      </button>
    </div>
  </div>

  <div className="wheelTopList">
    {top.map((p, idx) => {
      const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
      const val = Number((p as any)[topMetric]) || 0;
      const w = Math.round((val / max) * 100);

      return (
        <div className={"wheelTopRowPro " + (idx < 3 ? "is-top" : "")} key={p.prize_code}>
          <div className={"wheelTopMedal m" + (idx+1)}>{idx+1}</div>

          <div className="wheelTopMid">
            <div className="wheelTopTitle">{p.title}</div>

            <div className="wheelTopMini">
              {topMetric === 'wins'
                ? `redeemed: ${Number(p.redeemed)||0}`
                : `wins: ${Number(p.wins)||0}`
              }
            </div>

            <div className="wheelTopBar">
              <div className="wheelTopBarFill" style={{ width: `${w}%` }} />
            </div>
          </div>

          <div className="wheelTopRight">
            <div className="wheelTopCount">{val}</div>
          </div>
        </div>
      );
    })}

    {!top.length && <div className="sg-muted">Пока пусто</div>}
  </div>
</Card>


<Card className="wheelCard wheelStickyTop">
  {/* ...header + tabs... */}

  <div className="wheelTopList">
    {/* ...rows... */}
  </div>

  {/* ✅ заглушка ВНУТРИ sticky карточки */}
  <div className="wheelTopStub">
    <div className="wheelTopStubTitle">Next widgets</div>
    <div className="wheelTopStubTxt">
      Скоро: ROI, проблемные призы, авто-weight, блокировка “крутить”.
    </div>
  </div>
</Card>






          
        </div>
      </div>
    </div>
  );
}
