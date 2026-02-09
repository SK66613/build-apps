// src/pages/Game.tsx
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
type GameSeriesPoint = {
  d: string; // day/hour label
  plays: number;
  players: number;
  score_total: number;
  score_avg: number;
  coins_earned: number;
  coins_spent: number;
  conv_purchase: number; // optional %
};

type GameKpi = {
  plays: number;
  players: number;
  avg_score: number;
  top_score: number;
  coins_earned: number;
  coins_spent: number;
  tournaments_active: number;
  fraud_risk_pct: number;
};

type Tournament = {
  id: string;
  title: string;
  status: 'draft'|'active'|'ended';
  starts_at?: string;
  ends_at?: string;
  entry_cost_coins?: number;
  prize_pool?: string; // text or JSON later
  players?: number;
};

type LeaderRow = {
  rank: number;
  tg_id?: string;
  name?: string;
  score: number;
  plays?: number;
  coins?: number;
  last_ts?: string;
  flagged?: boolean;
};

type GameEvent = {
  ts: string;
  type: string;
  label: string;
  user?: string;
};

type GameAlert = {
  id: string;
  severity: 'ok'|'risk'|'bad';
  title: string;
  desc: string;
  action?: { label: string };
};

type GameResponse = {
  ok: true;
  kpi: GameKpi;
  series: GameSeriesPoint[];
  tournaments: Tournament[];
  leaderboard: LeaderRow[];
  live: GameEvent[];
  alerts: GameAlert[];
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

/** ===== SVG icons ===== */
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

export default function Game(){
  const { appId, range } = useAppState();

  const [mode, setMode] = React.useState<'overview'|'tournaments'|'leaderboard'|'fraud'|'economy'>('overview');
  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');
  const [metric, setMetric] = React.useState<'plays'|'players'|'coins'|'score'|'conv'>('plays');
  const [under, setUnder] = React.useState<'live'|'alerts'>('live');

  const [tournamentId, setTournamentId] = React.useState<string>('');
  const [lbMetric, setLbMetric] = React.useState<'score'|'coins'|'plays'>('score');

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['game', appId, range.from, range.to, tournamentId, lbMetric],
    queryFn: () => apiFetch<GameResponse>(
      `/api/cabinet/apps/${appId}/game/dashboard?${qs({ ...range, tournament_id: tournamentId, lb: lbMetric })}`
    ),
    staleTime: 10_000,
    refetchInterval: under === 'live' ? 10_000 : false,
    retry: 0,
  });

  const kpi = q.data?.kpi;
  const series = q.data?.series || [];
  const tournaments = q.data?.tournaments || [];
  const leaderboard = q.data?.leaderboard || [];
  const live = q.data?.live || [];
  const alerts = q.data?.alerts || [];

  React.useEffect(() => {
    if (!tournamentId && tournaments.length){
      const active = tournaments.find(t => t.status === 'active') || tournaments[0];
      if (active?.id) setTournamentId(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments.length]);

  const chartData = series.map(p => ({
    name: p.d,
    plays: n0(p.plays),
    players: n0(p.players),
    coins: n0(p.coins_earned),
    score: n0(p.score_total),
    conv: n0(p.conv_purchase),
  }));

  function chartKey(){
    if (metric === 'plays') return 'plays';
    if (metric === 'players') return 'players';
    if (metric === 'coins') return 'coins';
    if (metric === 'score') return 'score';
    return 'conv';
  }

  return (
    <div className="sg-page gmPage">
      <div className="gmHead">
        <div>
          <h1 className="sg-h1">Game</h1>
          <div className="sg-sub">Игры, турниры, лидерборды, антифрод, экономика.</div>
        </div>

        <SegTabs
          value={mode}
          onChange={(v) => setMode(v as any)}
          items={[
            { key: 'overview', label: 'Overview' },
            { key: 'tournaments', label: 'Tournaments' },
            { key: 'leaderboard', label: 'Leaderboard' },
            { key: 'fraud', label: 'Anti-fraud' },
            { key: 'economy', label: 'Economy' },
          ]}
        />
      </div>

      <div className="gmGrid">
        {/* LEFT */}
        <div className="gmLeft">
          {/* KPI */}
          <Card className="gmCard">
            <div className="gmKpiRow">
              <div className="gmKpi">
                <div className="gmKpiLbl">Plays</div>
                <div className="gmKpiVal">{kpi ? fmt(kpi.plays) : '—'}</div>
              </div>
              <div className="gmKpi">
                <div className="gmKpiLbl">Players</div>
                <div className="gmKpiVal">{kpi ? fmt(kpi.players) : '—'}</div>
              </div>
              <div className="gmKpi">
                <div className="gmKpiLbl">Avg score</div>
                <div className="gmKpiVal">{kpi ? fmt(kpi.avg_score) : '—'}</div>
              </div>
              <div className="gmKpi">
                <div className="gmKpiLbl">Top score</div>
                <div className="gmKpiVal">{kpi ? fmt(kpi.top_score) : '—'}</div>
              </div>
              <div className="gmKpi">
                <div className="gmKpiLbl">Coins earned</div>
                <div className="gmKpiVal">{kpi ? fmt(kpi.coins_earned) : '—'}</div>
              </div>
              <div className="gmKpi">
                <div className="gmKpiLbl">Fraud risk</div>
                <div className="gmKpiVal">{kpi ? `${Math.round(n0(kpi.fraud_risk_pct))}%` : '—'}</div>
              </div>
            </div>
          </Card>

          {/* Chart always visible */}
          <Card className="gmCard">
            <div className="gmChartHead">
              <div>
                <div className="gmTitle">Activity</div>
                <div className="gmSub">{range.from} — {range.to}</div>
              </div>

              <SegTabs
                className="gmMetricSeg"
                value={metric}
                onChange={(v) => setMetric(v as any)}
                items={[
                  { key: 'plays', label: 'Plays' },
                  { key: 'players', label: 'Players' },
                  { key: 'score', label: 'Score' },
                  { key: 'coins', label: 'Coins' },
                  { key: 'conv', label: 'Conv' },
                ]}
              />

              <div className="gmChartBtns">
                <button className={'gmChartBtn ' + (chartMode==='bar' ? 'is-active' : '')} onClick={() => setChartMode('bar')} aria-label="Bars"><IcoBars/></button>
                <button className={'gmChartBtn ' + (chartMode==='line' ? 'is-active' : '')} onClick={() => setChartMode('line')} aria-label="Line"><IcoLine/></button>
                <button className={'gmChartBtn ' + (chartMode==='area' ? 'is-active' : '')} onClick={() => setChartMode('area')} aria-label="Area"><IcoArea/></button>
              </div>
            </div>

            <div className="gmChart">
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
                      <Bar dataKey={chartKey()} fill="var(--gm-chart-1)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={chartKey()} stroke="var(--gm-chart-1)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey={chartKey()} stroke="var(--gm-chart-1)" fill="var(--gm-chart-1)" fillOpacity={0.14} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            <div className="gmUnder">
              <div className="sg-tabs gmUnderTabs">
                <button className={'sg-tab ' + (under==='live' ? 'is-active' : '')} onClick={() => setUnder('live')}>Live</button>
                <button className={'sg-tab ' + (under==='alerts' ? 'is-active' : '')} onClick={() => setUnder('alerts')}>Alerts</button>
              </div>

              {under === 'live' && (
                <div className="gmUnderPanel">
                  {!live.length ? <div className="sg-muted">Пока пусто.</div> : (
                    <div className="gmFeed">
                      {live.slice(0, 14).map((e, i) => (
                        <div className="gmFeedRow" key={i}>
                          <div className="gmFeedType">{e.type}</div>
                          <div className="gmFeedLabel">{e.label}</div>
                          <div className="gmFeedTs">{e.ts}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {under === 'alerts' && (
                <div className="gmUnderPanel">
                  {!alerts.length ? <div className="sg-muted">Нет алертов.</div> : (
                    <div className="gmAlerts">
                      {alerts.slice(0, 10).map(a => (
                        <div className={'gmAlert ' + a.severity} key={a.id}>
                          <div className="gmAlertTop">
                            <div className="gmAlertTitle">{a.title}</div>
                            <div className={'gmBadge ' + a.severity}>{a.severity.toUpperCase()}</div>
                          </div>
                          <div className="gmAlertDesc">{a.desc}</div>
                          {a.action?.label && (
                            <div className="gmAlertAct">
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

          {/* Mode content */}
          <Card className="gmCard">
            {mode === 'tournaments' && (
              <div className="gmBlock">
                <div className="gmTitle">Tournaments</div>

                <div className="gmRow2">
                  <div className="gmField">
                    <div className="gmFieldLbl">Active / Selected</div>
                    <select
                      className="gmSelect"
                      value={tournamentId}
                      onChange={(e) => setTournamentId(e.target.value)}
                    >
                      {tournaments.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.status === 'active' ? '🟢 ' : t.status === 'ended' ? '⚪ ' : '🟡 '}
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="gmField">
                    <div className="gmFieldLbl">Create</div>
                    <Button variant="primary">Создать турнир</Button>
                  </div>
                </div>

                <div className="gmTourList">
                  {tournaments.map(t => (
                    <div className={'gmTourRow ' + t.status} key={t.id}>
                      <div className="gmTourMain">
                        <div className="gmTourTitle">{t.title}</div>
                        <div className="gmTourSub">
                          {t.starts_at ? `с ${t.starts_at}` : '—'} · {t.ends_at ? `до ${t.ends_at}` : '—'}
                        </div>
                      </div>
                      <div className="gmTourMeta">
                        <div className="gmPill">{t.status}</div>
                        <div className="gmTourNums">
                          <span>players: <b>{t.players ?? 0}</b></span>
                          <span>entry: <b>{t.entry_cost_coins ?? 0}</b></span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!tournaments.length && <div className="sg-muted">Нет турниров.</div>}
                </div>
              </div>
            )}

            {mode === 'leaderboard' && (
              <div className="gmBlock">
                <div className="gmTitle">Leaderboard</div>

                <div className="gmRow2">
                  <SegTabs
                    value={lbMetric}
                    onChange={(v) => setLbMetric(v as any)}
                    items={[
                      { key: 'score', label: 'Score' },
                      { key: 'coins', label: 'Coins' },
                      { key: 'plays', label: 'Plays' },
                    ]}
                  />
                  <div />
                </div>

                <div className="gmLb">
                  {leaderboard.map(r => (
                    <div className={'gmLbRow ' + (r.flagged ? 'flag' : '')} key={r.rank}>
                      <div className="gmLbRank">{r.rank}</div>
                      <div className="gmLbName">{r.name || r.tg_id || '—'}</div>
                      <div className="gmLbVal">{fmt(r.score)}</div>
                    </div>
                  ))}
                  {!leaderboard.length && <div className="sg-muted">Пока пусто.</div>}
                </div>
              </div>
            )}

            {mode === 'overview' && (
              <div className="gmBlock">
                <div className="gmTitle">Overview</div>
                <div className="gmRows">
                  <div className="gmRow"><span className="sg-muted">Coins earned</span><b>{kpi ? fmt(kpi.coins_earned) : '—'}</b></div>
                  <div className="gmRow"><span className="sg-muted">Coins spent</span><b>{kpi ? fmt(kpi.coins_spent) : '—'}</b></div>
                  <div className="gmRow"><span className="sg-muted">Active tournaments</span><b>{kpi ? fmt(kpi.tournaments_active) : '—'}</b></div>
                </div>
              </div>
            )}

            {mode === 'fraud' && (
              <div className="gmBlock">
                <div className="gmTitle">Anti-fraud</div>
                <div className="gmRows">
                  <div className="gmRow"><span className="sg-muted">Подозрительные игроки</span><b>—</b></div>
                  <div className="gmRow"><span className="sg-muted">Пики очков</span><b>—</b></div>
                  <div className="gmRow"><span className="sg-muted">Мультиакки</span><b>—</b></div>
                </div>
              </div>
            )}

            {mode === 'economy' && (
              <div className="gmBlock">
                <div className="gmTitle">Economy</div>
                <div className="gmRows">
                  <div className="gmRow"><span className="sg-muted">Cost of rewards</span><b>—</b></div>
                  <div className="gmRow"><span className="sg-muted">ROI from game</span><b>—</b></div>
                  <div className="gmRow"><span className="sg-muted">Conversion to sales</span><b>—</b></div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT sticky */}
        <div className="gmRight">
          <div className="gmSticky">
            <Card className="gmCard">
              <div className="gmCardHead">
                <div className="gmTitle">Tournament</div>
              </div>

              <div className="gmSideBlock">
                <div className="gmRow"><span className="sg-muted">Selected</span><b>{tournaments.find(t=>t.id===tournamentId)?.title || '—'}</b></div>
                <div className="gmRow"><span className="sg-muted">Status</span><b>{tournaments.find(t=>t.id===tournamentId)?.status || '—'}</b></div>
                <div className="gmRow"><span className="sg-muted">Entry</span><b>{tournaments.find(t=>t.id===tournamentId)?.entry_cost_coins ?? 0}</b></div>
                <div className="gmActions">
                  <Button variant="primary">Edit rules</Button>
                  <Button variant="primary">End tournament</Button>
                </div>
              </div>
            </Card>

            <Card className="gmCard">
              <div className="gmCardHead">
                <div className="gmTitle">Health</div>
              </div>

              <div className="gmSideBlock">
                <div className="gmRow"><span className="sg-muted">Fraud risk</span><b>{kpi ? `${Math.round(n0(kpi.fraud_risk_pct))}%` : '—'}</b></div>
                <div className="gmTrack"><div className="gmFill" style={{ width: `${Math.min(100, Math.max(0, n0(kpi?.fraud_risk_pct)))}%` }} /></div>
                <div className="gmActions">
                  <Button variant="primary">Review flagged</Button>
                  <Button variant="primary">Limits</Button>
                </div>
              </div>
            </Card>

            <Card className="gmCard">
              <div className="gmCardHead">
                <div className="gmTitle">Quick</div>
              </div>

              <div className="gmActions">
                <Button variant="primary">Create tournament</Button>
                <Button variant="primary">Prize pool</Button>
                <Button variant="primary">Push message</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
