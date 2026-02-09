// src/pages/Profit.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
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

/** ===== Types ===== */
type ProfitKpi = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;

  coins_issued: number;
  coins_redeemed: number;
  outstanding_coins: number;

  coin_value: number; // money per coin (например 1.0)
  issued_cost: number;   // coins_issued * coin_value
  redeemed_cost: number; // coins_redeemed * coin_value
  liability_value: number; // outstanding_coins * coin_value

  net_profit: number; // gross_profit - redeemed_cost - other_costs(optional)
  reward_rate_pct: number; // redeemed_cost / revenue * 100

  avg_check: number;
  checks: number;
};

type ProfitPoint = {
  d: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  net_profit: number;
  redeemed_cost: number;
  issued_cost: number;
  liability_value: number;
};

type ProfitAlert = {
  id: string;
  severity: 'ok'|'risk'|'bad';
  title: string;
  desc: string;
  action?: { label: string; on?: 'cashback'|'coinValue'|'limits'|'message' };
};

type ProfitEvent = {
  ts: string;
  type: string;
  label: string;
};

type ProfitResponse = {
  ok: true;
  kpi: ProfitKpi;
  series: ProfitPoint[];
  live: ProfitEvent[];
  alerts: ProfitAlert[];

  top_drivers?: Array<{ id: string; title: string; value: number; sub?: string }>; // что ест прибыль
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}
function n0(v:any){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function fmt(n:number){ return n0(n).toLocaleString('ru-RU'); }

/** ===== SVG icons (same as Wheel/Overview) ===== */
function IcoBars(){ return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }
function IcoLine(){ return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function IcoArea(){ return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18"/><path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }

function SegTabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: React.ReactNode }>;
  className?: string;
}){
  return (
    <div className={props.className || ''}>
      <div className="sg-tabs">
        {props.items.map(it => (
          <button
            key={it.key}
            type="button"
            className={'sg-tab' + (props.value === it.key ? ' is-active' : '')}
            onClick={() => props.onChange(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Profit(){
  const { appId, range } = useAppState();

  const [mode, setMode] = React.useState<'pl'|'loyalty'|'unit'|'todo'>('pl');
  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');
  const [metric, setMetric] = React.useState<'net'|'gross'|'revenue'|'reward'|'liability'>('net');
  const [under, setUnder] = React.useState<'live'|'alerts'>('live');

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['profit', appId, range.from, range.to],
    queryFn: () => apiFetch<ProfitResponse>(`/api/cabinet/apps/${appId}/profit?${qs(range)}`),
    staleTime: 10_000,
    refetchInterval: under === 'live' ? 10_000 : false,
    retry: 0,
  });

  const kpi = q.data?.kpi;
  const series = q.data?.series || [];
  const live = q.data?.live || [];
  const alerts = q.data?.alerts || [];
  const drivers = q.data?.top_drivers || [];

  const chartData = series.map(p => ({ name: p.d, ...p }));

  function metricKey(){
    if (metric === 'net') return 'net_profit';
    if (metric === 'gross') return 'gross_profit';
    if (metric === 'revenue') return 'revenue';
    if (metric === 'reward') return 'redeemed_cost';
    return 'liability_value';
  }

  return (
    <div className="sg-page pfPage">
      {/* Header */}
      <div className="pfHead">
        <div>
          <h1 className="sg-h1">Profit</h1>
          <div className="sg-sub">P&L + стоимость лояльности + рекомендации.</div>
        </div>

        <SegTabs
          value={mode}
          onChange={(v) => setMode(v as any)}
          items={[
            { key: 'pl', label: 'P&L' },
            { key: 'loyalty', label: 'Loyalty cost' },
            { key: 'unit', label: 'Unit econ' },
            { key: 'todo', label: 'What to do' },
          ]}
        />
      </div>

      <div className="pfGrid">
        {/* LEFT */}
        <div className="pfLeft">
          {/* KPI row */}
          <Card className="pfCard">
            <div className="pfKpiRow">
              <div className="pfKpi">
                <div className="pfKpiLbl">Net profit</div>
                <div className="pfKpiVal">{kpi ? fmt(kpi.net_profit) : '—'}</div>
              </div>
              <div className="pfKpi">
                <div className="pfKpiLbl">Gross profit</div>
                <div className="pfKpiVal">{kpi ? fmt(kpi.gross_profit) : '—'}</div>
              </div>
              <div className="pfKpi">
                <div className="pfKpiLbl">Margin</div>
                <div className="pfKpiVal">{kpi ? `${Math.round(n0(kpi.gross_margin_pct))}%` : '—'}</div>
              </div>
              <div className="pfKpi">
                <div className="pfKpiLbl">Reward cost</div>
                <div className="pfKpiVal">{kpi ? fmt(kpi.redeemed_cost) : '—'}</div>
              </div>
              <div className="pfKpi">
                <div className="pfKpiLbl">Reward rate</div>
                <div className="pfKpiVal">{kpi ? `${Math.round(n0(kpi.reward_rate_pct))}%` : '—'}</div>
              </div>
              <div className="pfKpi">
                <div className="pfKpiLbl">Liability</div>
                <div className="pfKpiVal">{kpi ? fmt(kpi.liability_value) : '—'}</div>
              </div>
            </div>
          </Card>

          {/* Chart always visible */}
          <Card className="pfCard">
            <div className="pfChartHead">
              <div>
                <div className="pfTitle">Dynamics</div>
                <div className="pfSub">{range.from} — {range.to}</div>
              </div>

              {/* metric switch */}
              <SegTabs
                className="pfMetricSeg"
                value={metric}
                onChange={(v) => setMetric(v as any)}
                items={[
                  { key: 'net', label: 'Net' },
                  { key: 'gross', label: 'Gross' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'reward', label: 'Reward' },
                  { key: 'liability', label: 'Liability' },
                ]}
              />

              {/* chart-mode svg btns */}
              <div className="pfChartBtns">
                <button className={'pfChartBtn ' + (chartMode==='bar' ? 'is-active' : '')} onClick={() => setChartMode('bar')} aria-label="Bars"><IcoBars/></button>
                <button className={'pfChartBtn ' + (chartMode==='line' ? 'is-active' : '')} onClick={() => setChartMode('line')} aria-label="Line"><IcoLine/></button>
                <button className={'pfChartBtn ' + (chartMode==='area' ? 'is-active' : '')} onClick={() => setChartMode('area')} aria-label="Area"><IcoArea/></button>
              </div>
            </div>

            <div className="pfChart">
              {!appId && <div className="sg-muted">Выбери проект.</div>}
              {appId && q.isLoading && <div className="sg-muted">Загрузка…</div>}
              {appId && q.isError && <div className="sg-muted">Ошибка: {(q.error as Error).message}</div>}

              {appId && !q.isLoading && !q.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <BarChart data={chartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey={metricKey()} fill="var(--pf-chart-1)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={metricKey()} stroke="var(--pf-chart-1)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey={metricKey()} stroke="var(--pf-chart-1)" fill="var(--pf-chart-1)" fillOpacity={0.14} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* under: live/alerts */}
            <div className="pfUnder">
              <div className="sg-tabs pfUnderTabs">
                <button className={'sg-tab ' + (under==='live' ? 'is-active' : '')} onClick={() => setUnder('live')}>Live</button>
                <button className={'sg-tab ' + (under==='alerts' ? 'is-active' : '')} onClick={() => setUnder('alerts')}>Alerts</button>
              </div>

              {under === 'live' && (
                <div className="pfUnderPanel">
                  {!live.length ? <div className="sg-muted">Пока пусто.</div> : (
                    <div className="pfFeed">
                      {live.slice(0, 14).map((e, i) => (
                        <div className="pfFeedRow" key={i}>
                          <div className="pfFeedType">{e.type}</div>
                          <div className="pfFeedLabel">{e.label}</div>
                          <div className="pfFeedTs">{e.ts}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {under === 'alerts' && (
                <div className="pfUnderPanel">
                  {!alerts.length ? <div className="sg-muted">Нет алертов.</div> : (
                    <div className="pfAlerts">
                      {alerts.slice(0, 10).map(a => (
                        <div className={'pfAlert ' + a.severity} key={a.id}>
                          <div className="pfAlertTop">
                            <div className="pfAlertTitle">{a.title}</div>
                            <div className={'pfBadge ' + a.severity}>{a.severity.toUpperCase()}</div>
                          </div>
                          <div className="pfAlertDesc">{a.desc}</div>
                          {a.action?.label && (
                            <div className="pfAlertAct">
                              <Button variant="primary">{a.action.label}</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Mode content area (below chart card if you want) */}
          <Card className="pfCard">
            {mode === 'pl' && (
              <div className="pfBlock">
                <div className="pfTitle">P&L breakdown</div>
                <div className="pfRows">
                  <div className="pfRow"><span className="sg-muted">Revenue</span><b>{kpi ? fmt(kpi.revenue) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">COGS</span><b>{kpi ? fmt(kpi.cogs) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Gross profit</span><b>{kpi ? fmt(kpi.gross_profit) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Reward cost</span><b>{kpi ? fmt(kpi.redeemed_cost) : '—'}</b></div>
                  <div className="pfRow is-strong"><span className="sg-muted">Net profit</span><b>{kpi ? fmt(kpi.net_profit) : '—'}</b></div>
                </div>
              </div>
            )}

            {mode === 'loyalty' && (
              <div className="pfBlock">
                <div className="pfTitle">Loyalty cost</div>
                <div className="pfRows">
                  <div className="pfRow"><span className="sg-muted">Coin value</span><b>{kpi ? fmt(kpi.coin_value) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Issued (cost)</span><b>{kpi ? fmt(kpi.issued_cost) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Redeemed (cost)</span><b>{kpi ? fmt(kpi.redeemed_cost) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Outstanding (liability)</span><b>{kpi ? fmt(kpi.liability_value) : '—'}</b></div>
                </div>
              </div>
            )}

            {mode === 'unit' && (
              <div className="pfBlock">
                <div className="pfTitle">Unit economics</div>
                <div className="pfRows">
                  <div className="pfRow"><span className="sg-muted">Checks</span><b>{kpi ? fmt(kpi.checks) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Avg check</span><b>{kpi ? fmt(kpi.avg_check) : '—'}</b></div>
                  <div className="pfRow"><span className="sg-muted">Net / check</span><b>{kpi ? fmt(kpi.checks ? (kpi.net_profit / Math.max(1, kpi.checks)) : 0) : '—'}</b></div>
                </div>
              </div>
            )}

            {mode === 'todo' && (
              <div className="pfBlock">
                <div className="pfTitle">What to do</div>
                <div className="pfTodo">
                  <div className="pfTodoItem"><span>• Если reward rate &gt; 8–12% → урезай cashback/веса призов</span></div>
                  <div className="pfTodoItem"><span>• Если redeem rate низкий → сделай “ближайший приз” проще (паспорт)</span></div>
                  <div className="pfTodoItem"><span>• Если liability растёт → лимиты на выдачу монет + срок действия</span></div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT sticky */}
        <div className="pfRight">
          <div className="pfSticky">
            <Card className="pfCard">
              <div className="pfCardHead">
                <div className="pfTitle">Profit health</div>
              </div>

              <div className="pfHealth">
                <div className="pfHealthRow">
                  <span className="sg-muted">Reward rate</span>
                  <b>{kpi ? `${Math.round(n0(kpi.reward_rate_pct))}%` : '—'}</b>
                </div>
                <div className="pfTrack">
                  <div
                    className="pfFill"
                    style={{ width: `${Math.round(Math.min(100, Math.max(0, n0(kpi?.reward_rate_pct))))}%` }}
                  />
                </div>

                <div className="pfQuick">
                  <Button variant="primary">Cashback settings</Button>
                  <Button variant="primary">Coin value</Button>
                </div>
              </div>
            </Card>

            <Card className="pfCard">
              <div className="pfCardHead">
                <div className="pfTitle">Top drivers</div>
              </div>

              {!drivers.length ? (
                <div className="sg-muted">Нет данных.</div>
              ) : (
                <div className="pfDrivers">
                  {drivers.slice(0, 8).map((d) => (
                    <div className="pfDriverRow" key={d.id}>
                      <div className="pfDriverTitle">{d.title}</div>
                      <div className="pfDriverVal">{fmt(d.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="pfCard">
              <div className="pfCardHead">
                <div className="pfTitle">Quick actions</div>
              </div>
              <div className="pfActions">
                <Button variant="primary">Set limits</Button>
                <Button variant="primary">Tune wheel weights</Button>
                <Button variant="primary">Promo for dormant</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
