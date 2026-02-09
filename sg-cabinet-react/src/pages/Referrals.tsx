// src/pages/Referrals.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

type Range = { from?: string; to?: string };

type RefKpi = {
  invites: number;
  signups: number;
  activated: number;
  first_purchase: number;
  repeat_buyers: number;
  rewarded: number;
  fraud_flagged: number;
  revenue: number;
  bonus_cost: number;
};

type RefFunnel = Array<{ step: string; value: number }>;

type RefTrendPoint = {
  d: string; // date
  signups: number;
  activated: number;
  purchases: number;
  revenue: number;
  bonus_cost: number;
};

type ReferrerRow = {
  referrer_tg: string;
  name?: string;
  signups: number;
  activated: number;
  purchases: number;
  revenue: number;
  bonus_cost: number;
  roi?: number;
};

type ReferralRow = {
  ts: string;
  referrer_tg: string;
  referred_tg: string;
  status: string; // signed/activated/purchased/fraud
  first_purchase_sum?: number;
  risk?: 'ok'|'mid'|'bad';
};

type LiveItem = {
  ts: string;
  type: string; // click/signup/activate/purchase/reward/fraud
  label: string;
  referrer_tg?: string;
  referred_tg?: string;
  amount?: number;
};

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || String(v) === '') continue;
    p.set(k, String(v));
  }
  return p.toString();
}
function n(v: any){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function pct(a: number, b: number){ if (!b) return '0%'; return Math.round((a/b)*100) + '%'; }
function money(v: any){ return (n(v)).toLocaleString('ru-RU'); }

function IcoBar(){ return (
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

export default function Referrals(){
  const { appId, range } = useAppState() as { appId?: string|number|null; range: Range };

  // ===== Segments (верхняя навигация страницы)
  const [seg, setSeg] = React.useState<'overview'|'funnel'|'referrers'|'list'|'rewards'|'antifraud'|'rules'>('overview');

  // ===== Chart (всегда сверху)
  const [chartType, setChartType] = React.useState<'area'|'line'|'bar'>('area');
  const [metric, setMetric] = React.useState<'signups'|'activated'|'purchases'|'revenue'|'bonus_cost'>('signups');

  // ===== Live/Alerts под графиком
  const [under, setUnder] = React.useState<'live'|'alerts'>('alerts');

  // ===== Filters
  const [q, setQ] = React.useState('');
  const [minSum, setMinSum] = React.useState('');
  const [risk, setRisk] = React.useState<'all'|'ok'|'mid'|'bad'>('all');

  // ===== Data queries (эндпоинты — каркас; если у тебя другие, просто замени URL)
  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['ref.kpi', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; kpi: RefKpi }>(`/api/cabinet/apps/${appId}/referrals/kpi?${qs(range)}`),
    staleTime: 10_000,
  });

  const qTrend = useQuery({
    enabled: !!appId,
    queryKey: ['ref.trend', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; items: RefTrendPoint[] }>(`/api/cabinet/apps/${appId}/referrals/trend?${qs(range)}`),
    staleTime: 10_000,
  });

  const qFunnel = useQuery({
    enabled: !!appId && (seg === 'overview' || seg === 'funnel'),
    queryKey: ['ref.funnel', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; items: RefFunnel }>(`/api/cabinet/apps/${appId}/referrals/funnel?${qs(range)}`),
    staleTime: 10_000,
  });

  const qReferrers = useQuery({
    enabled: !!appId && (seg === 'overview' || seg === 'referrers'),
    queryKey: ['ref.referrers', appId, range?.from, range?.to],
    queryFn: () => apiFetch<{ ok:true; items: ReferrerRow[] }>(`/api/cabinet/apps/${appId}/referrals/referrers?${qs(range)}`),
    staleTime: 10_000,
  });

  const qList = useQuery({
    enabled: !!appId && (seg === 'list' || seg === 'overview'),
    queryKey: ['ref.list', appId, range?.from, range?.to, q, minSum, risk],
    queryFn: () => apiFetch<{ ok:true; items: ReferralRow[] }>(
      `/api/cabinet/apps/${appId}/referrals/list?${qs({ ...range, q, min_sum: minSum, risk })}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && under === 'live',
    queryKey: ['ref.live', appId],
    queryFn: () => apiFetch<{ ok:true; items: LiveItem[] }>(`/api/cabinet/apps/${appId}/referrals/live`),
    staleTime: 3_000,
    refetchInterval: 6_000,
    retry: 0,
  });

  // ===== Derived
  const kpi: RefKpi = qKpi.data?.kpi || {
    invites:0, signups:0, activated:0, first_purchase:0, repeat_buyers:0, rewarded:0, fraud_flagged:0,
    revenue:0, bonus_cost:0,
  };

  const actRate = pct(kpi.activated, kpi.signups);
  const p1Rate = pct(kpi.first_purchase, kpi.signups);
  const fraudRate = pct(kpi.fraud_flagged, kpi.signups);
  const roi = kpi.bonus_cost > 0 ? Math.round(((kpi.revenue - kpi.bonus_cost) / kpi.bonus_cost) * 100) : (kpi.revenue > 0 ? 999 : 0);

  const trend = qTrend.data?.items || [];
  const funnel = qFunnel.data?.items || [];
  const referrers = qReferrers.data?.items || [];
  const list = qList.data?.items || [];

  // alerts (примеры правил, можно сделать реально из бэка)
  const alerts = [
    { kind: fraudRate !== '0%' ? 'warn' : 'ok', title: 'Fraud risk', desc: `Флагов: ${kpi.fraud_flagged} (${fraudRate})` },
    { kind: kpi.bonus_cost > kpi.revenue ? 'bad' : 'ok', title: 'ROI', desc: `Доход: ${money(kpi.revenue)} / Бонусы: ${money(kpi.bonus_cost)} (ROI ~ ${roi}%)` },
    { kind: kpi.signups > 0 && kpi.first_purchase === 0 ? 'warn' : 'ok', title: 'First purchase', desc: `Конверсия 1-й покупки: ${p1Rate}` },
  ];

  return (
    <div className="sg-page refPage">
      {/* ===== Header */}
      <div className="refHead">
        <div>
          <h1 className="sg-h1">Referrals</h1>
          <div className="sg-sub">Воронка, качество, экономика, антифрод. Всё как в топовых лоялти.</div>
        </div>

        {/* Segments */}
        <div className="sg-tabs refSegTabs">
          <button className={'sg-tab ' + (seg==='overview' ? 'is-active':'')} onClick={() => setSeg('overview')}>Overview</button>
          <button className={'sg-tab ' + (seg==='funnel' ? 'is-active':'')} onClick={() => setSeg('funnel')}>Funnel</button>
          <button className={'sg-tab ' + (seg==='referrers' ? 'is-active':'')} onClick={() => setSeg('referrers')}>Referrers</button>
          <button className={'sg-tab ' + (seg==='list' ? 'is-active':'')} onClick={() => setSeg('list')}>List</button>
          <button className={'sg-tab ' + (seg==='rewards' ? 'is-active':'')} onClick={() => setSeg('rewards')}>Rewards</button>
          <button className={'sg-tab ' + (seg==='antifraud' ? 'is-active':'')} onClick={() => setSeg('antifraud')}>Anti-fraud</button>
          <button className={'sg-tab ' + (seg==='rules' ? 'is-active':'')} onClick={() => setSeg('rules')}>Rules</button>
        </div>
      </div>

      {/* ===== Grid: left content + sticky right */}
      <div className="refGrid">
        {/* LEFT */}
        <div className="refLeft">
          {/* ===== Chart card ALWAYS */}
          <Card className="refCard">
            <div className="refCardHead refCardHeadRow">
              <div>
                <div className="refCardTitle">Динамика</div>
                <div className="refCardSub">{range?.from} — {range?.to}</div>
              </div>

              {/* Chart-type icon buttons */}
              <div className="refChartBtns" role="tablist" aria-label="Chart type">
                <button className={'refChartBtn ' + (chartType==='bar'?'is-active':'')} onClick={() => setChartType('bar')} title="Bars"><IcoBar/></button>
                <button className={'refChartBtn ' + (chartType==='line'?'is-active':'')} onClick={() => setChartType('line')} title="Line"><IcoLine/></button>
                <button className={'refChartBtn ' + (chartType==='area'?'is-active':'')} onClick={() => setChartType('area')} title="Area"><IcoArea/></button>
              </div>
            </div>

            {/* Metric segmented */}
            <div className="refMetricRow">
              <div className="sg-tabs refMetricTabs">
                <button className={'sg-tab ' + (metric==='signups'?'is-active':'')} onClick={() => setMetric('signups')}>Signups</button>
                <button className={'sg-tab ' + (metric==='activated'?'is-active':'')} onClick={() => setMetric('activated')}>Activated</button>
                <button className={'sg-tab ' + (metric==='purchases'?'is-active':'')} onClick={() => setMetric('purchases')}>Purchases</button>
                <button className={'sg-tab ' + (metric==='revenue'?'is-active':'')} onClick={() => setMetric('revenue')}>Revenue</button>
                <button className={'sg-tab ' + (metric==='bonus_cost'?'is-active':'')} onClick={() => setMetric('bonus_cost')}>Bonus</button>
              </div>
            </div>

            <div className="refChart">
              {qTrend.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qTrend.isError && <div className="sg-muted">Ошибка: {(qTrend.error as Error).message}</div>}

              {!qTrend.isLoading && !qTrend.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={trend} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Bar dataKey={metric} fill="var(--ref-accent)" radius={[10,10,4,4]}/>
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Line type="monotone" dataKey={metric} stroke="var(--ref-accent)" strokeWidth={3} dot={false}/>
                    </LineChart>
                  ) : (
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35}/>
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} height={42}/>
                      <YAxis tick={{ fontSize: 12 }}/>
                      <Tooltip />
                      <Area type="monotone" dataKey={metric} stroke="var(--ref-accent)" fill="var(--ref-accent)" fillOpacity={0.14} strokeWidth={3}/>
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* KPI under chart */}
            <div className="refKpiRow">
              <div className="refKpi">
                <div className="refKpiLbl">Signups</div>
                <div className="refKpiVal">{kpi.signups}</div>
                <div className="refKpiMini">Invites: <b>{kpi.invites}</b></div>
              </div>
              <div className="refKpi">
                <div className="refKpiLbl">Activated</div>
                <div className="refKpiVal">{kpi.activated}</div>
                <div className="refKpiMini">Rate: <b>{actRate}</b></div>
              </div>
              <div className="refKpi">
                <div className="refKpiLbl">Revenue</div>
                <div className="refKpiVal">{money(kpi.revenue)}</div>
                <div className="refKpiMini">Bonus: <b>{money(kpi.bonus_cost)}</b></div>
              </div>
            </div>

            {/* Live / Alerts under chart */}
            <div className="refUnder">
              <div className="sg-tabs refUnderTabs">
                <button className={'sg-tab ' + (under==='alerts'?'is-active':'')} onClick={() => setUnder('alerts')}>Alerts</button>
                <button className={'sg-tab ' + (under==='live'?'is-active':'')} onClick={() => setUnder('live')}>Live</button>
              </div>

              {under === 'alerts' && (
                <div className="refUnderPanel">
                  <div className="refUnderHead">
                    <div>
                      <div className="refCardTitle">Alerts</div>
                      <div className="refCardSub">сигналы качества и рисков</div>
                    </div>
                    <div className="refBadgeRow">
                      <span className={'refBadge ' + (kpi.bonus_cost > kpi.revenue ? 'bad':'ok')}>ROI ~ {roi}%</span>
                      <span className={'refBadge ' + (kpi.fraud_flagged ? 'mid':'ok')}>Fraud {fraudRate}</span>
                    </div>
                  </div>

                  <div className="refAlerts">
                    {alerts.map((a, i) => (
                      <div key={i} className={'refAlert ' + a.kind}>
                        <div className="refAlertTitle">{a.title}</div>
                        <div className="refAlertDesc">{a.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {under === 'live' && (
                <div className="refUnderPanel">
                  <div className="refUnderHead">
                    <div>
                      <div className="refCardTitle">Live</div>
                      <div className="refCardSub">последние события</div>
                    </div>
                    <div className="sg-pill" style={{ padding:'8px 12px' }}>
                      {qLive.isFetching ? 'обновляю…' : 'готово'}
                    </div>
                  </div>

                  {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qLive.isError && (
                    <div className="sg-muted">
                      Ошибка: {(qLive.error as Error).message}
                      <div style={{ marginTop: 6, opacity: .8 }}>Если эндпоинт другой — замени <code>/referrals/live</code>.</div>
                    </div>
                  )}

                  {qLive.data?.items?.length ? (
                    <div className="refLiveList">
                      {qLive.data.items.slice(0, 18).map((e, i) => (
                        <div className="refLiveRow" key={i}>
                          <div className="refLiveType">{e.type}</div>
                          <div className="refLiveLabel">{e.label}</div>
                          <div className="refLiveTs">{e.ts}</div>
                        </div>
                      ))}
                    </div>
                  ) : (!qLive.isLoading && !qLive.isError) ? (
                    <div className="sg-muted">Пока пусто</div>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          {/* ===== Content by segment */}
          {seg === 'overview' && (
            <>
              <Card className="refCard">
                <div className="refCardHead">
                  <div className="refCardTitle">Funnel</div>
                  <div className="refCardSub">конверсии по шагам</div>
                </div>

                <div className="refFunnel">
                  {qFunnel.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {!qFunnel.isLoading && !funnel.length && <div className="sg-muted">Нет данных.</div>}
                  {!!funnel.length && (
                    <div className="refFunnelGrid">
                      {funnel.map((s, i) => (
                        <div key={i} className="refFunnelStep">
                          <div className="refFunnelLbl">{s.step}</div>
                          <div className="refFunnelVal">{s.value}</div>
                          <div className="refFunnelMini">
                            {i>0 ? <>Conv: <b>{pct(s.value, funnel[i-1].value)}</b></> : <span className="sg-muted">—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="refCard">
                <div className="refCardHead refCardHeadRow">
                  <div>
                    <div className="refCardTitle">Последние referrals</div>
                    <div className="refCardSub">быстрый обзор + фильтры</div>
                  </div>

                  <div className="refFilters">
                    <Input value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="поиск tg / имя / метка" />
                    <Input value={minSum} onChange={(e:any)=>setMinSum(e.target.value)} placeholder="min sum" />
                    <div className="sg-tabs refRiskTabs">
                      <button className={'sg-tab ' + (risk==='all'?'is-active':'')} onClick={()=>setRisk('all')}>All</button>
                      <button className={'sg-tab ' + (risk==='ok'?'is-active':'')} onClick={()=>setRisk('ok')}>OK</button>
                      <button className={'sg-tab ' + (risk==='mid'?'is-active':'')} onClick={()=>setRisk('mid')}>RISK</button>
                      <button className={'sg-tab ' + (risk==='bad'?'is-active':'')} onClick={()=>setRisk('bad')}>BAD</button>
                    </div>
                  </div>
                </div>

                <div className="refTableWrap">
                  <table className="sg-table">
                    <thead>
                      <tr>
                        <th>TS</th>
                        <th>Referrer</th>
                        <th>Referred</th>
                        <th>Status</th>
                        <th>1st sum</th>
                        <th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.slice(0, 12).map((r, i) => (
                        <tr key={i}>
                          <td>{r.ts}</td>
                          <td><b>{r.referrer_tg}</b></td>
                          <td>{r.referred_tg}</td>
                          <td>{r.status}</td>
                          <td>{r.first_purchase_sum ?? '—'}</td>
                          <td>
                            <span className={'refRiskPill ' + (r.risk || 'ok')}>{(r.risk || 'ok').toUpperCase()}</span>
                          </td>
                        </tr>
                      ))}
                      {!list.length && !qList.isLoading && (
                        <tr><td colSpan={6} style={{ opacity:.7, padding:14 }}>Пока пусто</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {seg === 'funnel' && (
            <Card className="refCard">
              <div className="refCardHead">
                <div className="refCardTitle">Funnel details</div>
                <div className="refCardSub">сюда потом добавим breakdown по каналам, времени до активации и т.п.</div>
              </div>
              <div className="sg-muted">TODO: breakdown (source/channel), time-to-activation, cohorts.</div>
            </Card>
          )}

          {seg === 'referrers' && (
            <Card className="refCard">
              <div className="refCardHead">
                <div className="refCardTitle">Top referrers</div>
                <div className="refCardSub">рейтинги и качество</div>
              </div>

              <div className="refTableWrap">
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>Referrer</th>
                      <th>Signups</th>
                      <th>Activated</th>
                      <th>Purchases</th>
                      <th>Revenue</th>
                      <th>Bonus</th>
                      <th>ROI%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrers.map((r, i) => (
                      <tr key={i}>
                        <td><b>{r.name || r.referrer_tg}</b></td>
                        <td>{r.signups}</td>
                        <td>{r.activated}</td>
                        <td>{r.purchases}</td>
                        <td>{money(r.revenue)}</td>
                        <td>{money(r.bonus_cost)}</td>
                        <td>{Number.isFinite(r.roi as any) ? r.roi : '—'}</td>
                      </tr>
                    ))}
                    {!referrers.length && !qReferrers.isLoading && (
                      <tr><td colSpan={7} style={{ opacity:.7, padding:14 }}>Нет данных</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {seg === 'list' && (
            <Card className="refCard">
              <div className="refCardHead refCardHeadRow">
                <div>
                  <div className="refCardTitle">Referrals list</div>
                  <div className="refCardSub">полный список + фильтры</div>
                </div>

                <div className="refFilters">
                  <Input value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="поиск tg / имя / метка" />
                  <Input value={minSum} onChange={(e:any)=>setMinSum(e.target.value)} placeholder="min sum" />
                  <div className="sg-tabs refRiskTabs">
                    <button className={'sg-tab ' + (risk==='all'?'is-active':'')} onClick={()=>setRisk('all')}>All</button>
                    <button className={'sg-tab ' + (risk==='ok'?'is-active':'')} onClick={()=>setRisk('ok')}>OK</button>
                    <button className={'sg-tab ' + (risk==='mid'?'is-active':'')} onClick={()=>setRisk('mid')}>RISK</button>
                    <button className={'sg-tab ' + (risk==='bad'?'is-active':'')} onClick={()=>setRisk('bad')}>BAD</button>
                  </div>
                </div>
              </div>

              <div className="refTableWrap">
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>TS</th>
                      <th>Referrer</th>
                      <th>Referred</th>
                      <th>Status</th>
                      <th>1st sum</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r, i) => (
                      <tr key={i}>
                        <td>{r.ts}</td>
                        <td><b>{r.referrer_tg}</b></td>
                        <td>{r.referred_tg}</td>
                        <td>{r.status}</td>
                        <td>{r.first_purchase_sum ?? '—'}</td>
                        <td><span className={'refRiskPill ' + (r.risk || 'ok')}>{(r.risk || 'ok').toUpperCase()}</span></td>
                      </tr>
                    ))}
                    {!list.length && !qList.isLoading && (
                      <tr><td colSpan={6} style={{ opacity:.7, padding:14 }}>Нет записей</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {seg === 'rewards' && (
            <Card className="refCard">
              <div className="refCardHead">
                <div className="refCardTitle">Rewards</div>
                <div className="refCardSub">pending/available/redeemed + правила холда</div>
              </div>
              <div className="sg-muted">TODO: список выплат, холды, отмены, ручные корректировки.</div>
            </Card>
          )}

          {seg === 'antifraud' && (
            <Card className="refCard">
              <div className="refCardHead">
                <div className="refCardTitle">Anti-fraud</div>
                <div className="refCardSub">сигналы, флаги, hold, лимиты</div>
              </div>
              <div className="sg-muted">TODO: risk rules + flagged list + reason codes.</div>
            </Card>
          )}

          {seg === 'rules' && (
            <Card className="refCard">
              <div className="refCardHead">
                <div className="refCardTitle">Rules</div>
                <div className="refCardSub">настройка бонусов и условий</div>
              </div>
              <div className="sg-muted">TODO: конструктор правил (bonus on signup/purchase, min check, hold days, caps).</div>
              <div style={{ marginTop: 12, display:'flex', gap: 10, flexWrap:'wrap' }}>
                <Button variant="primary" disabled>Сохранить правила</Button>
                <Button variant="secondary" disabled>Симуляция ROI</Button>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT (sticky sidebar) */}
        <div className="refRight">
          <Card className="refCard refSticky">
            <div className="refCardHead">
              <div className="refCardTitle">Summary</div>
              <div className="refCardSub">качество + экономика</div>
            </div>

            <div className="refSummaryTiles">
              <div className="refTile">
                <div className="refTileLbl">Activation</div>
                <div className="refTileVal">{actRate}</div>
                <div className="refTileMini">Activated: <b>{kpi.activated}</b></div>
              </div>
              <div className="refTile">
                <div className="refTileLbl">1st purchase</div>
                <div className="refTileVal">{p1Rate}</div>
                <div className="refTileMini">First: <b>{kpi.first_purchase}</b></div>
              </div>
              <div className="refTile is-strong">
                <div className="refTileLbl">Fraud</div>
                <div className="refTileVal">{fraudRate}</div>
                <div className="refTileMini">Flagged: <b>{kpi.fraud_flagged}</b></div>
              </div>
            </div>

            <div className="refRoiBox">
              <div className="refRoiTop">
                <div className="refRoiName">ROI estimate</div>
                <span className={'refBadge ' + (kpi.bonus_cost > kpi.revenue ? 'bad' : 'ok')}>{roi}%</span>
              </div>
              <div className="refRoiMeta">
                <span className="sg-muted">Revenue: <b>{money(kpi.revenue)}</b></span>
                <span className="sg-muted">Bonus: <b>{money(kpi.bonus_cost)}</b></span>
              </div>
              <div className="refBarTrack">
                <div className="refBarFill" style={{ width: `${Math.max(0, Math.min(100, (kpi.revenue && kpi.bonus_cost) ? (kpi.revenue / Math.max(1,kpi.bonus_cost))*50 : 0))}%` }} />
              </div>
            </div>
          </Card>

          <Card className="refCard refSticky2">
            <div className="refCardHead refCardHeadRow">
              <div>
                <div className="refCardTitle">Top referrers</div>
                <div className="refCardSub">лучшие по качеству</div>
              </div>
              <div className="refHintPill">quick</div>
            </div>

            <div className="refTopList">
              {referrers.slice(0, 7).map((r, i) => (
                <div key={i} className={'refTopRow ' + (i<3 ? 'is-top':'')}>
                  <div className={'refMedal m' + (i+1)}>{i+1}</div>
                  <div className="refTopMid">
                    <div className="refTopTitle">{r.name || r.referrer_tg}</div>
                    <div className="refTopMini">rev: {money(r.revenue)} · act: {r.activated}</div>
                    <div className="refTopBar"><div className="refTopBarFill" style={{ width: `${Math.min(100, Math.round((r.revenue / Math.max(1, referrers[0]?.revenue || 1))*100))}%` }} /></div>
                  </div>
                  <div className="refTopRight">
                    <div className="refTopCount">{money(r.revenue)}</div>
                  </div>
                </div>
              ))}
              {!referrers.length && <div className="sg-muted">Нет данных.</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
