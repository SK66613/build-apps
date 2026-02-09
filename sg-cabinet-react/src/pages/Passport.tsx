// src/pages/Passport.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppState } from '../app/appState';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/** ========= Types (универсальные) ========= */
type PassportKpi = {
  activated: number;     // пользователи с 1-м шагом (или открытием)
  in_progress: number;   // progress 1..goal-1
  completed: number;     // goal достигнут
  redeemed: number;      // награда выдана
  completion_rate: number; // completed/activated * 100
  redeem_rate: number;     // redeemed/completed * 100
  avg_time_to_complete_days?: number; // среднее время закрытия
  liability?: number;      // условная "нагрузка" по наградам (если считаешь)
};

type PassportSeriesPoint = {
  date: string; // YYYY-MM-DD
  steps: number;
  completed: number;
  redeemed: number;
  active_users: number;
};

type PassportLiveItem = {
  ts: string;
  type: 'step'|'complete'|'redeem';
  tg_id?: string;
  label?: string;         // например "+1 stamp", "completed", "redeemed"
  cashier?: string;
};

type PassportUserRow = {
  tg_id: string;
  name?: string;
  progress: number;
  goal: number;
  status: 'in_progress'|'completed'|'redeemed';
  last_step_at?: string;
  started_at?: string;
};

type PassportTopRow = {
  key: string;    // prize_code / passport_id / tg_id
  title: string;
  value: number;
  sub?: string;
};

/** ========= Utils ========= */
function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}
function pct(n: number, d: number){
  if (!d) return 0;
  return Math.round((n/d) * 100);
}
function clampPct(x: number){ return Math.max(0, Math.min(100, Math.round(x || 0))); }

/** ========= SVG icons (как в Wheel) ========= */
function IcoBars(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);}
function IcoLine(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);}
function IcoArea(){ return (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18"/>
    <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);}

/** ========= Page ========= */
export default function Passport(){
  const { appId, range } = useAppState();

  // chart mode: bar/line/area
  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');

  // under-chart panels: live / users / rewards
  const [panel, setPanel] = React.useState<'live'|'users'|'rewards'>('live');

  // right sticky: top metric switch
  const [topMetric, setTopMetric] = React.useState<'near_complete'|'stuck'|'not_redeemed'>('near_complete');

  // passport selector (если у тебя несколько паспортов)
  // пока заглушка: 'default'
  const [passportId] = React.useState<string>('default');

  /** ===== Queries ===== */
  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['passport.kpi', appId, passportId, range.from, range.to],
    queryFn: () => apiFetch<{ ok:true; kpi: PassportKpi }>(
      `/api/cabinet/apps/${appId}/passport/kpi?passport_id=${encodeURIComponent(passportId)}&${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const qSeries = useQuery({
    enabled: !!appId,
    queryKey: ['passport.series', appId, passportId, range.from, range.to],
    queryFn: () => apiFetch<{ ok:true; items: PassportSeriesPoint[] }>(
      `/api/cabinet/apps/${appId}/passport/series?passport_id=${encodeURIComponent(passportId)}&${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && panel === 'live',
    queryKey: ['passport.live', appId, passportId],
    queryFn: () => apiFetch<{ ok:true; items: PassportLiveItem[] }>(
      `/api/cabinet/apps/${appId}/passport/live?passport_id=${encodeURIComponent(passportId)}`
    ),
    staleTime: 3_000,
    refetchInterval: 7_000,
    retry: 0,
  });

  const qUsers = useQuery({
    enabled: !!appId && panel === 'users',
    queryKey: ['passport.users', appId, passportId, range.from, range.to],
    queryFn: () => apiFetch<{ ok:true; items: PassportUserRow[] }>(
      `/api/cabinet/apps/${appId}/passport/users?passport_id=${encodeURIComponent(passportId)}&${qs(range)}`
    ),
    staleTime: 10_000,
    retry: 0,
  });

  const qRewards = useQuery({
    enabled: !!appId && panel === 'rewards',
    queryKey: ['passport.rewards', appId, passportId, range.from, range.to],
    queryFn: () => apiFetch<{ ok:true; items: any[] }>(
      `/api/cabinet/apps/${appId}/passport/rewards?passport_id=${encodeURIComponent(passportId)}&${qs(range)}`
    ),
    staleTime: 10_000,
    retry: 0,
  });

  const kpi = qKpi.data?.kpi;
  const series = qSeries.data?.items || [];

  // derived rates (если бэк не отдаёт)
  const activated = kpi?.activated || 0;
  const completed = kpi?.completed || 0;
  const redeemed = kpi?.redeemed || 0;
  const completionRate = kpi?.completion_rate ?? pct(completed, activated);
  const redeemRate = kpi?.redeem_rate ?? pct(redeemed, completed);

  // right tops (заглушки — можешь заменить реальным API)
  const qTop = useQuery({
    enabled: !!appId,
    queryKey: ['passport.top', appId, passportId, topMetric, range.from, range.to],
    queryFn: () => apiFetch<{ ok:true; items: PassportTopRow[] }>(
      `/api/cabinet/apps/${appId}/passport/top?passport_id=${encodeURIComponent(passportId)}&metric=${topMetric}&${qs(range)}`
    ),
    staleTime: 10_000,
    retry: 0,
  });

  const top = qTop.data?.items || [];

  /** ===== Chart data normalize ===== */
  const chartData = series.map(x => ({
    name: x.date,
    steps: Number(x.steps)||0,
    completed: Number(x.completed)||0,
    redeemed: Number(x.redeemed)||0,
    active_users: Number(x.active_users)||0,
  }));

  return (
    <div className="sg-page passportPage">
      {/* HEAD */}
      <div className="passportHead">
        <div>
          <h1 className="sg-h1">Passport</h1>
          <div className="sg-sub">
            Воронка, скорость прохождения, live события, пользователи и выдачи.
          </div>
        </div>

        {/* справа можно позже добавить фильтры: паспорт / сегмент / канал */}
        <div className="sg-pill" style={{ padding: '8px 12px' }}>
          <b>passport</b>&nbsp;<span style={{ opacity: .7 }}>dashboard</span>
        </div>
      </div>

      {/* GRID (как Wheel) */}
      <div className="passportGrid">
        {/* LEFT */}
        <div className="passportLeft">
          {/* CHART CARD (always visible) */}
          <Card className="passportCard">
            <div className="passportCardHead passportCardHeadRow">
              <div>
                <div className="passportCardTitle">Динамика</div>
                <div className="passportCardSub">{range.from} — {range.to}</div>
              </div>

              {/* SVG chart-mode buttons */}
              <div className="passportChartBtns" role="tablist" aria-label="Chart type">
                <button
                  type="button"
                  className={'passportChartBtn ' + (chartMode==='bar' ? 'is-active' : '')}
                  onClick={() => setChartMode('bar')}
                  title="Столбцы"
                ><IcoBars/></button>
                <button
                  type="button"
                  className={'passportChartBtn ' + (chartMode==='line' ? 'is-active' : '')}
                  onClick={() => setChartMode('line')}
                  title="Линия"
                ><IcoLine/></button>
                <button
                  type="button"
                  className={'passportChartBtn ' + (chartMode==='area' ? 'is-active' : '')}
                  onClick={() => setChartMode('area')}
                  title="Area"
                ><IcoArea/></button>
              </div>
            </div>

            <div className="passportChart">
              {qSeries.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qSeries.isError && <div className="sg-muted">Ошибка: {(qSeries.error as Error).message}</div>}

              {!qSeries.isLoading && !qSeries.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <BarChart data={chartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="steps" fill="var(--accent)" radius={[10,10,4,4]} />
                      <Bar dataKey="redeemed" fill="var(--accent2)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="steps" stroke="var(--accent)" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="redeemed" stroke="var(--accent2)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="steps" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.14} strokeWidth={3} />
                      <Area type="monotone" dataKey="redeemed" stroke="var(--accent2)" fill="var(--accent2)" fillOpacity={0.10} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* KPI tiles under chart */}
            <div className="passportKpiRow">
              <div className="passportKpi">
                <div className="passportKpiLbl">Activated</div>
                <div className="passportKpiVal">{kpi?.activated ?? '—'}</div>
              </div>
              <div className="passportKpi">
                <div className="passportKpiLbl">Completed</div>
                <div className="passportKpiVal">{kpi?.completed ?? '—'}</div>
              </div>
              <div className="passportKpi">
                <div className="passportKpiLbl">Redeemed</div>
                <div className="passportKpiVal">{kpi?.redeemed ?? '—'}</div>
              </div>
              <div className="passportKpi">
                <div className="passportKpiLbl">Completion</div>
                <div className="passportKpiVal">{clampPct(completionRate)}%</div>
              </div>
              <div className="passportKpi">
                <div className="passportKpiLbl">Redeem rate</div>
                <div className="passportKpiVal">{clampPct(redeemRate)}%</div>
              </div>
            </div>

            {/* UNDER CHART SEGMENTS */}
            <div className="passportUnderTabs">
              <div className="sg-tabs passportUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='live' ? 'is-active' : '')} onClick={() => setPanel('live')}>Live</button>
                <button className={'sg-tab ' + (panel==='users' ? 'is-active' : '')} onClick={() => setPanel('users')}>Users</button>
                <button className={'sg-tab ' + (panel==='rewards' ? 'is-active' : '')} onClick={() => setPanel('rewards')}>Rewards</button>
              </div>

              {/* PANEL BODY */}
              <div className="passportUnderPanel">
                {panel === 'live' && (
                  <>
                    <div className="passportUnderHead">
                      <div>
                        <div className="passportCardTitle">Live события</div>
                        <div className="passportCardSub">auto refresh</div>
                      </div>
                      <div className="sg-pill" style={{ padding:'8px 12px' }}>
                        {qLive.isFetching ? 'обновляю…' : 'готово'}
                      </div>
                    </div>

                    {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
                    {qLive.isError && <div className="sg-muted">Ошибка: {(qLive.error as Error).message}</div>}

                    {qLive.data?.items?.length ? (
                      <div className="passportLiveList">
                        {qLive.data.items.slice(0, 16).map((e, i) => (
                          <div className="passportLiveRow" key={i}>
                            <div className="passportLiveType">{e.type}</div>
                            <div className="passportLiveLabel">{e.label || e.tg_id || '—'}</div>
                            <div className="passportLiveTs">{e.ts}</div>
                          </div>
                        ))}
                      </div>
                    ) : (!qLive.isLoading && !qLive.isError) ? (
                      <div className="sg-muted">Пока пусто</div>
                    ) : null}
                  </>
                )}

                {panel === 'users' && (
                  <>
                    <div className="passportUnderHead">
                      <div>
                        <div className="passportCardTitle">Пользователи</div>
                        <div className="passportCardSub">progress / last step</div>
                      </div>
                    </div>

                    {qUsers.isLoading && <div className="sg-muted">Загрузка…</div>}
                    {qUsers.isError && <div className="sg-muted">Ошибка: {(qUsers.error as Error).message}</div>}

                    {qUsers.data?.items?.length ? (
                      <div className="passportTableWrap">
                        <table className="sg-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Progress</th>
                              <th>Status</th>
                              <th>Last step</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qUsers.data.items.slice(0, 50).map((u) => (
                              <tr key={u.tg_id}>
                                <td style={{ fontWeight: 900 }}>{u.name || u.tg_id}</td>
                                <td>{u.progress}/{u.goal}</td>
                                <td>{u.status}</td>
                                <td>{u.last_step_at || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (!qUsers.isLoading && !qUsers.isError) ? (
                      <div className="sg-muted">Нет данных</div>
                    ) : null}
                  </>
                )}

                {panel === 'rewards' && (
                  <>
                    <div className="passportUnderHead">
                      <div>
                        <div className="passportCardTitle">Награды</div>
                        <div className="passportCardSub">issued / redeemed</div>
                      </div>
                    </div>

                    {qRewards.isLoading && <div className="sg-muted">Загрузка…</div>}
                    {qRewards.isError && <div className="sg-muted">Ошибка: {(qRewards.error as Error).message}</div>}

                    {qRewards.data?.items?.length ? (
                      <pre style={{ margin:0, whiteSpace:'pre-wrap' }}>
                        {JSON.stringify(qRewards.data.items.slice(0, 20), null, 2)}
                      </pre>
                    ) : (!qRewards.isLoading && !qRewards.isError) ? (
                      <div className="sg-muted">Нет данных</div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT (sticky) */}
        <div className="passportRight">
          {/* Summary PRO */}
          <Card className="passportCard">
            <div className="passportCardHead">
              <div className="passportCardTitle">Сводка</div>
            </div>

            <div className="passportSummaryPro">
              <div className="passportSummaryTiles">
                <div className="passportSumTile">
                  <div className="passportSumLbl">In progress</div>
                  <div className="passportSumVal">{kpi?.in_progress ?? '—'}</div>
                </div>
                <div className="passportSumTile">
                  <div className="passportSumLbl">Completed</div>
                  <div className="passportSumVal">{kpi?.completed ?? '—'}</div>
                </div>
                <div className="passportSumTile is-strong">
                  <div className="passportSumLbl">Redeem</div>
                  <div className="passportSumVal">{clampPct(redeemRate)}%</div>
                </div>
              </div>

              <div className="passportRateBar">
                <div className="passportRateTop">
                  <div className="passportRateName">Completion</div>
                  <div className="passportRateBadge">{clampPct(completionRate)}%</div>
                </div>
                <div className="passportBarTrack" aria-hidden="true">
                  <div className="passportBarFill" style={{ width: `${clampPct(completionRate)}%` }} />
                </div>
                <div className="passportRateMeta">
                  <span className="sg-muted">Activated: <b>{activated}</b></span>
                  <span className="sg-muted">Completed: <b>{completed}</b></span>
                </div>
              </div>
            </div>
          </Card>

          {/* Sticky Top list */}
          <Card className="passportCard passportStickyTop">
            <div className="passportCardHead passportTopHead">
              <div className="passportCardTitle">Top</div>

              <div className="sg-tabs passportMiniTabs">
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='near_complete' ? 'is-active' : '')}
                  onClick={() => setTopMetric('near_complete')}
                >Near</button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='stuck' ? 'is-active' : '')}
                  onClick={() => setTopMetric('stuck')}
                >Stuck</button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='not_redeemed' ? 'is-active' : '')}
                  onClick={() => setTopMetric('not_redeemed')}
                >NR</button>
              </div>
            </div>

            <div className="passportTopList">
              {qTop.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qTop.isError && <div className="sg-muted">Ошибка: {(qTop.error as Error).message}</div>}

              {!qTop.isLoading && !qTop.isError && top.map((r, idx) => {
                const max = Math.max(1, top[0]?.value || 0);
                const w = Math.round((r.value / max) * 100);
                return (
                  <div className={'passportTopRowPro ' + (idx < 3 ? 'is-top' : '')} key={r.key}>
                    <div className={'passportTopMedal m' + (idx+1)}>{idx+1}</div>

                    <div className="passportTopMid">
                      <div className="passportTopTitle">{r.title}</div>
                      {r.sub && <div className="passportTopMini">{r.sub}</div>}
                      <div className="passportTopBar">
                        <div className="passportTopBarFill" style={{ width: `${w}%` }} />
                      </div>
                    </div>

                    <div className="passportTopRight">
                      <div className="passportTopCount">{r.value}</div>
                    </div>
                  </div>
                );
              })}

              {!qTop.isLoading && !qTop.isError && !top.length && (
                <div className="sg-muted">Пока пусто</div>
              )}
            </div>
          </Card>

          {/* Optional: insights */}
          <Card className="passportCard">
            <div className="passportCardHead">
              <div className="passportCardTitle">Insights</div>
            </div>
            <div className="passportIdeas">
              <div className="sg-muted">• near-complete: прогресс 80–99% → пуш “остался 1 шаг”</div>
              <div className="sg-muted">• stuck: без шага 7+ дней → спец-оффер</div>
              <div className="sg-muted">• not redeemed: completed без выдачи → обучить кассиров/упростить redeem</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
