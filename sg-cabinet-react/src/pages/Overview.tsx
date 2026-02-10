// src/pages/Overview.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
import { useI18n } from '../i18n';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/** ===================== Types ===================== */

type OverviewKpi = {
  revenue: number;
  revenue_prev?: number;
  sales_count: number;
  sales_count_prev?: number;
  avg_check: number;
  avg_check_prev?: number;

  coins_issued: number;
  coins_issued_prev?: number;
  coins_redeemed: number;
  coins_redeemed_prev?: number;

  active_30d: number;
  new_customers: number;

  liability_coins?: number; // суммарный баланс монет (обязательство)
};

type OverviewPoint = {
  d: string; // date label or hour label
  revenue: number;
  sales_count: number;
  avg_check: number;
  new_customers: number;
  active_customers: number;
  coins_issued: number;
  coins_redeemed: number;
  qr_scans?: number;
};

type OverviewEvent = {
  ts: string;
  type: 'sale'|'qr'|'coins_issued'|'coins_redeemed'|'wheel_win'|'wheel_redeem'|'passport_done'|'error'|'info';
  label: string;
  meta?: Record<string, any>;
};

type OverviewAlert = {
  id: string;
  severity: 'ok'|'risk'|'bad';
  title: string;
  desc: string;
  action?: { label: string; href?: string; on?: 'weights'|'cashback'|'message'|'settings' };
};

type TopCustomer = { id: string; title: string; value: number; sub?: string };
type TopPrize = { prize_code: string; title: string; wins: number; redeemed: number };
type TopCashier = { id: string; title: string; value: number; sub?: string };

type OverviewResponse = {
  ok: true;
  kpi: OverviewKpi;
  series: OverviewPoint[];
  live: OverviewEvent[];
  alerts: OverviewAlert[];
  top_customers: TopCustomer[];
  top_prizes: TopPrize[];
  top_cashiers?: TopCashier[];
};

/** ===================== Utils ===================== */

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}
function n0(v: any){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function pctDelta(cur: number, prev?: number){
  const p = n0(prev);
  if (!p) return null;
  return Math.round(((n0(cur) - p) / p) * 100);
}

/** ===================== SVG Icons ===================== */

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

function IcoBolt(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 1L3 9h4l-1 6 7-9H9l0-5z" fill="currentColor" opacity="0.18"/>
      <path d="M9 1L3 9h4l-1 6 7-9H9V1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoBell(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2z" fill="currentColor" opacity="0.18"/>
      <path d="M8 2a3 3 0 0 1 3 3v2.3c0 .5.2 1 .6 1.4l.7.7V11H3V9.4l.7-.7c.4-.4.6-.9.6-1.4V5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}

/** ===================== Small UI pieces ===================== */

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

function KpiTile(props: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  strong?: boolean;
  hint?: string;
}){
  const d = props.delta;
  return (
    <div className={'ov-kpi' + (props.strong ? ' is-strong' : '')}>
      <div className="ov-kpiTop">
        <div className="ov-kpiLbl">{props.label}</div>
        {typeof d === 'number' && (
          <div className={'ov-kpiDelta ' + (d >= 0 ? 'up' : 'down')}>
            {d >= 0 ? '+' : ''}{d}%
          </div>
        )}
      </div>
      <div className="ov-kpiVal">{props.value}</div>
      {props.hint && <div className="ov-kpiHint">{props.hint}</div>}
    </div>
  );
}

function SeverityBadge({ s }: { s: 'ok'|'risk'|'bad' }){
  const { t } = useI18n();
  return (
    <div className={'ov-badge ' + s}>
      {s === 'ok' ? t('sev.ok') : s === 'risk' ? t('sev.risk') : t('sev.bad')}
    </div>
  );
}

/** ===================== Page ===================== */

export default function Overview(){
  const { appId, range } = useAppState();
  const { t, lang } = useI18n();

  const [metric, setMetric] = React.useState<'sales'|'customers'|'loyalty'|'funnel'>('sales');
  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');
  const [under, setUnder] = React.useState<'live'|'alerts'>('live');
  const [topTab, setTopTab] = React.useState<'customers'|'prizes'|'cashiers'>('customers');

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const fmtNum = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const fmtMoney = React.useMemo(() => new Intl.NumberFormat(locale), [locale]); // если потом нужна валюта — сделаем currency

  const q = useQuery({
    enabled: !!appId,
    queryKey: ['overview', appId, range.from, range.to],
    queryFn: () => apiFetch<OverviewResponse>(
      `/api/cabinet/apps/${appId}/overview?${qs(range)}`
    ),
    staleTime: 10_000,
    refetchInterval: under === 'live' ? 10_000 : false,
    retry: 0,
  });

  const data = q.data;
  const kpi = data?.kpi;
  const series = data?.series || [];
  const live = data?.live || [];
  const alerts = data?.alerts || [];

  const topCustomers = data?.top_customers || [];
  const topPrizes = data?.top_prizes || [];
  const topCashiers = data?.top_cashiers || [];

  const chartData = React.useMemo(() => {
    return series.map(p => ({
      name: p.d,
      revenue: n0(p.revenue),
      sales_count: n0(p.sales_count),
      avg_check: n0(p.avg_check),
      new_customers: n0(p.new_customers),
      active_customers: n0(p.active_customers),
      coins_issued: n0(p.coins_issued),
      coins_redeemed: n0(p.coins_redeemed),
      qr_scans: n0(p.qr_scans),
    }));
  }, [series]);

  const chartCfg = React.useMemo(() => {
    if (metric === 'sales') {
      return { aKey: 'revenue', bKey: 'sales_count', aLabel: t('ov.kpi.revenue'), bLabel: t('ov.kpi.checks') };
    }
    if (metric === 'customers') {
      return { aKey: 'new_customers', bKey: 'active_customers', aLabel: t('ov.kpi.newCustomers'), bLabel: t('ov.kpi.activeCustomers') };
    }
    if (metric === 'loyalty') {
      return { aKey: 'coins_issued', bKey: 'coins_redeemed', aLabel: t('ov.kpi.coinsIssued'), bLabel: t('ov.kpi.coinsRedeemed') };
    }
    return { aKey: 'qr_scans', bKey: 'sales_count', aLabel: t('ov.metric.qrScans'), bLabel: t('ov.metric.sales') };
  }, [metric, t]);

  const dRevenue = kpi ? pctDelta(kpi.revenue, kpi.revenue_prev) : null;
  const dSales = kpi ? pctDelta(kpi.sales_count, kpi.sales_count_prev) : null;
  const dAvg = kpi ? pctDelta(kpi.avg_check, kpi.avg_check_prev) : null;
  const dIssued = kpi ? pctDelta(kpi.coins_issued, kpi.coins_issued_prev) : null;
  const dRedeemed = kpi ? pctDelta(kpi.coins_redeemed, kpi.coins_redeemed_prev) : null;

  const redemptionRate = React.useMemo(() => {
    const issued = n0(kpi?.coins_issued);
    const red = n0(kpi?.coins_redeemed);
    if (!issued) return 0;
    return Math.round((red / issued) * 100);
  }, [kpi]);

  const metricSub = React.useMemo(() => {
    if (metric === 'sales') return t('ov.metric.sales');
    if (metric === 'customers') return t('ov.metric.customers');
    if (metric === 'loyalty') return t('ov.metric.loyalty');
    return t('ov.metric.funnel');
  }, [metric, t]);

  return (
    <div className="sg-page ovPage">
      {/* Header */}
      <div className="ovHead">
        <div>
          <h1 className="sg-h1">{t('ov.title')}</h1>
          <div className="sg-sub">{t('ov.subtitle')}</div>
        </div>

        <div className="ovHeadRight">
          <div className="sg-pill ovPill">
            <span className="ovPillBold">{t('ov.range')}</span>
            <span className="ovPillMuted">{range.from} — {range.to}</span>
          </div>
        </div>
      </div>

      {/* Grid: left main + right sticky */}
      <div className="ovGrid">
        {/* LEFT */}
        <div className="ovLeft">
          {/* KPI row */}
          <Card className="ovCard">
            <div className="ovKpiRow">
              <KpiTile
                label={t('ov.kpi.revenue')}
                value={kpi ? fmtMoney.format(n0(kpi.revenue)) : '—'}
                delta={dRevenue}
                strong
                hint={t('ov.kpi.hint.period')}
              />
              <KpiTile
                label={t('ov.kpi.checks')}
                value={kpi ? fmtNum.format(n0(kpi.sales_count)) : '—'}
                delta={dSales}
              />
              <KpiTile
                label={t('ov.kpi.avgCheck')}
                value={kpi ? fmtMoney.format(n0(kpi.avg_check)) : '—'}
                delta={dAvg}
              />
              <KpiTile
                label={t('ov.kpi.coinsIssued')}
                value={kpi ? fmtNum.format(n0(kpi.coins_issued)) : '—'}
                delta={dIssued}
              />
              <KpiTile
                label={t('ov.kpi.coinsRedeemed')}
                value={kpi ? fmtNum.format(n0(kpi.coins_redeemed)) : '—'}
                delta={dRedeemed}
              />
              <KpiTile
                label={t('ov.kpi.redeemRate')}
                value={kpi ? `${redemptionRate}%` : '—'}
                strong={redemptionRate >= 70}
              />
            </div>
          </Card>

          {/* Main chart card always visible */}
          <Card className="ovCard">
            <div className="ovChartHead">
              <div>
                <div className="ovTitle">{t('ov.dynamics')}</div>
                <div className="ovSub">{metricSub}</div>
              </div>

              {/* metric segmented */}
              <SegTabs
                className="ovSeg"
                value={metric}
                onChange={(v) => setMetric(v as any)}
                items={[
                  { key: 'sales', label: <span className="ovSegLbl">{t('ov.metric.sales')}</span> },
                  { key: 'customers', label: <span className="ovSegLbl">{t('ov.metric.customers')}</span> },
                  { key: 'loyalty', label: <span className="ovSegLbl">{t('ov.metric.loyalty')}</span> },
                  { key: 'funnel', label: <span className="ovSegLbl">{t('ov.metric.funnel')}</span> },
                ]}
              />

              {/* svg chart-mode buttons */}
              <div className="ovChartBtns" role="tablist" aria-label={t('ov.chartType')}>
                <button type="button" className={'ovChartBtn ' + (chartMode==='bar' ? 'is-active' : '')} onClick={() => setChartMode('bar')} title={t('ov.chart.bars')} aria-label={t('ov.chart.bars')}><IcoBars/></button>
                <button type="button" className={'ovChartBtn ' + (chartMode==='line' ? 'is-active' : '')} onClick={() => setChartMode('line')} title={t('ov.chart.line')} aria-label={t('ov.chart.line')}><IcoLine/></button>
                <button type="button" className={'ovChartBtn ' + (chartMode==='area' ? 'is-active' : '')} onClick={() => setChartMode('area')} title={t('ov.chart.area')} aria-label={t('ov.chart.area')}><IcoArea/></button>
              </div>
            </div>

            <div className="ovChart">
              {!appId && <div className="sg-muted">{t('ov.pickProject')}</div>}
              {appId && q.isLoading && <div className="sg-muted">{t('common.loading')}</div>}
              {appId && q.isError && <div className="sg-muted">{t('ov.error', { msg: (q.error as Error).message })}</div>}

              {appId && !q.isLoading && !q.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <BarChart data={chartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey={chartCfg.aKey} fill="var(--ov-chart-1)" radius={[10,10,4,4]} />
                      <Bar dataKey={chartCfg.bKey} fill="var(--ov-chart-2)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={chartCfg.aKey} stroke="var(--ov-chart-1)" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey={chartCfg.bKey} stroke="var(--ov-chart-2)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey={chartCfg.aKey} stroke="var(--ov-chart-1)" fill="var(--ov-chart-1)" fillOpacity={0.16} strokeWidth={3} />
                      <Area type="monotone" dataKey={chartCfg.bKey} stroke="var(--ov-chart-2)" fill="var(--ov-chart-2)" fillOpacity={0.12} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* under-chart tabs: live / alerts */}
            <div className="ovUnder">
              <div className="sg-tabs ovUnderTabs">
                <button type="button" className={'sg-tab ' + (under==='live' ? 'is-active' : '')} onClick={() => setUnder('live')}>
                  <span className="ovTabIco"><IcoBolt/></span> {t('ov.live')}
                </button>
                <button type="button" className={'sg-tab ' + (under==='alerts' ? 'is-active' : '')} onClick={() => setUnder('alerts')}>
                  <span className="ovTabIco"><IcoBell/></span> {t('ov.alerts')}
                  {!!alerts.length && <span className="ovTabCount">{alerts.length}</span>}
                </button>
              </div>

              {/* Live panel */}
              {under === 'live' && (
                <div className="ovUnderPanel">
                  <div className="ovUnderHead">
                    <div>
                      <div className="ovTitle">{t('ov.liveFeed')}</div>
                      <div className="ovSub">{t('ov.liveFeedSub')}</div>
                    </div>
                    <div className="sg-pill ovMiniPill">{q.isFetching ? t('ov.refreshing') : t('ov.ready')}</div>
                  </div>

                  {!live.length ? (
                    <div className="sg-muted">{t('ov.empty')}</div>
                  ) : (
                    <div className="ovFeed">
                      {live.slice(0, 18).map((e, i) => (
                        <div className="ovFeedRow" key={i}>
                          <div className={'ovFeedType t-' + e.type}>{e.type}</div>
                          <div className="ovFeedLabel">{e.label}</div>
                          <div className="ovFeedTs">{e.ts}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Alerts panel */}
              {under === 'alerts' && (
                <div className="ovUnderPanel">
                  <div className="ovUnderHead">
                    <div>
                      <div className="ovTitle">{t('ov.alertsTitle')}</div>
                      <div className="ovSub">{t('ov.alertsSub')}</div>
                    </div>
                    <div className="sg-pill ovMiniPill">
                      {alerts.length ? t('ov.items', { n: alerts.length }) : t('ov.items0')}
                    </div>
                  </div>

                  {!alerts.length ? (
                    <div className="sg-muted">{t('ov.noAlerts')}</div>
                  ) : (
                    <div className="ovAlerts">
                      {alerts.slice(0, 10).map((a) => (
                        <div className={'ovAlert ' + a.severity} key={a.id}>
                          <div className="ovAlertTop">
                            <div className="ovAlertTitle">{a.title}</div>
                            <SeverityBadge s={a.severity}/>
                          </div>
                          <div className="ovAlertDesc">{a.desc}</div>
                          {a.action?.label && (
                            <div className="ovAlertActions">
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
        </div>

        {/* RIGHT sticky */}
        <div className="ovRight">
          <div className="ovSticky">
            {/* Quick actions */}
            <Card className="ovCard">
              <div className="ovCardHead">
                <div className="ovTitle">{t('ov.quickActions')}</div>
              </div>

              <div className="ovActions">
                <Button variant="primary">{t('ov.action.sendMessage')}</Button>
                <Button variant="primary">{t('ov.action.createPromo')}</Button>
                <Button variant="primary">{t('ov.action.cashbackSettings')}</Button>
              </div>

              <div className="ovActionHint">
                <span className="sg-muted">{t('ov.tip')}:</span> {t('ov.tipText')}
              </div>
            </Card>

            {/* Top lists with tabs */}
            <Card className="ovCard">
              <div className="ovCardHead ovTopHead">
                <div className="ovTitle">{t('ov.top')}</div>

                <div className="sg-tabs ovMiniTabs">
                  <button type="button" className={'sg-tab ' + (topTab==='customers' ? 'is-active' : '')} onClick={() => setTopTab('customers')}>
                    {t('ov.top.customers')}
                  </button>
                  <button type="button" className={'sg-tab ' + (topTab==='prizes' ? 'is-active' : '')} onClick={() => setTopTab('prizes')}>
                    {t('ov.top.prizes')}
                  </button>
                  <button type="button" className={'sg-tab ' + (topTab==='cashiers' ? 'is-active' : '')} onClick={() => setTopTab('cashiers')}>
                    {t('ov.top.cashiers')}
                  </button>
                </div>
              </div>

              <div className="ovTopList">
                {topTab === 'customers' && (
                  <>
                    {!topCustomers.length
                      ? <div className="sg-muted">{t('ov.noData')}</div>
                      : topCustomers.slice(0, 8).map((x, i) => (
                        <div className={'ovTopRow' + (i < 3 ? ' is-top' : '')} key={x.id}>
                          <div className={'ovMedal m' + (i+1)}>{i+1}</div>
                          <div className="ovTopMid">
                            <div className="ovTopTitle">{x.title}</div>
                            <div className="ovTopSub">{x.sub || '—'}</div>
                            <div className="ovTopBar">
                              <div
                                className="ovTopBarFill"
                                style={{ width: `${Math.round((x.value / Math.max(1, topCustomers[0]?.value || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="ovTopVal">{fmtNum.format(n0(x.value))}</div>
                        </div>
                      ))
                    }
                  </>
                )}

                {topTab === 'prizes' && (
                  <>
                    {!topPrizes.length
                      ? <div className="sg-muted">{t('ov.noData')}</div>
                      : topPrizes.slice(0, 8).map((p, i) => {
                        const val = n0(p.wins);
                        const max = Math.max(1, n0(topPrizes[0]?.wins));
                        const w = Math.round((val / max) * 100);
                        return (
                          <div className={'ovTopRow' + (i < 3 ? ' is-top' : '')} key={p.prize_code}>
                            <div className={'ovMedal m' + (i+1)}>{i+1}</div>
                            <div className="ovTopMid">
                              <div className="ovTopTitle">{p.title}</div>
                              <div className="ovTopSub">
                                {t('ov.redeemed')}: {fmtNum.format(n0(p.redeemed))}
                              </div>
                              <div className="ovTopBar"><div className="ovTopBarFill" style={{ width: `${w}%` }} /></div>
                            </div>
                            <div className="ovTopVal">{fmtNum.format(val)}</div>
                          </div>
                        );
                      })
                    }
                  </>
                )}

                {topTab === 'cashiers' && (
                  <>
                    {!topCashiers.length
                      ? <div className="sg-muted">{t('ov.noData')}</div>
                      : topCashiers.slice(0, 8).map((x, i) => (
                        <div className={'ovTopRow' + (i < 3 ? ' is-top' : '')} key={x.id}>
                          <div className={'ovMedal m' + (i+1)}>{i+1}</div>
                          <div className="ovTopMid">
                            <div className="ovTopTitle">{x.title}</div>
                            <div className="ovTopSub">{x.sub || '—'}</div>
                            <div className="ovTopBar">
                              <div
                                className="ovTopBarFill"
                                style={{ width: `${Math.round((x.value / Math.max(1, topCashiers[0]?.value || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="ovTopVal">{fmtNum.format(n0(x.value))}</div>
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
            </Card>

            {/* Health card */}
            <Card className="ovCard">
              <div className="ovCardHead">
                <div className="ovTitle">{t('ov.health')}</div>
              </div>

              <div className="ovHealth">
                <div className="ovHealthRow">
                  <span className="sg-muted">{t('ov.kpi.redeemRate')}</span>
                  <span className="ovHealthStrong">{redemptionRate}%</span>
                </div>
                <div className="ovHealthRow">
                  <span className="sg-muted">{t('ov.liabilityCoins')}</span>
                  <span className="ovHealthStrong">{fmtNum.format(n0(kpi?.liability_coins))}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

