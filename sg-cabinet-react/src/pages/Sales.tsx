// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/**
 * SALES page — structure like Wheel:
 * - Left: main chart + KPI tiles + under-chart segmented panels (Live / Customers / Cashiers)
 * - Right: sticky sidebar (Summary PRO + Top lists + Insights)
 *
 * Endpoints placeholders (replace with your worker routes):
 *  - GET /api/cabinet/apps/:appId/sales/kpi?from&to
 *  - GET /api/cabinet/apps/:appId/sales/timeseries?metric=revenue&from&to
 *  - GET /api/cabinet/apps/:appId/sales/live?from&to
 *  - GET /api/cabinet/apps/:appId/sales/top?kind=buyers&metric=revenue&from&to
 *  - GET /api/cabinet/apps/:appId/sales/customers?from&to
 *  - GET /api/cabinet/apps/:appId/sales/cashiers?from&to
 */

type KpiResp = {
  ok: true;
  revenue: number;
  orders: number;
  buyers: number;
  aov: number;
  coins_issued?: number;
  coins_redeemed?: number;
  redeem_rate?: number; // 0..100
  returning_share?: number; // 0..100
};

type SeriesPoint = {
  ts: string; // "2026-02-09" or "2026-02-09 12:00"
  revenue?: number;
  orders?: number;
  buyers?: number;
  aov?: number;
  coins_issued?: number;
  coins_redeemed?: number;
};

type LiveItem = {
  ts?: string;
  user?: string;
  cashier?: string;
  amount?: number;
  coins?: number;
  label?: string;
};

type TopItem = {
  id: string;
  title: string;
  metric: number;
  extra?: string; // subtitle
};

type CustomerRow = {
  tg_id: string;
  name?: string;
  last_purchase?: string;
  orders?: number;
  revenue?: number;
  recency_days?: number;
};

type CashierRow = {
  tg_id: string;
  name?: string;
  orders?: number;
  revenue?: number;
  aov?: number;
  suspicious?: number;
};

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtInt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return Math.round(x).toLocaleString('ru-RU');
}
function fmtMoney(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return Math.round(x).toLocaleString('ru-RU');
}
function fmtPct(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0%';
  return Math.round(x) + '%';
}

/* ===== Minimal SVG icons (no libs) ===== */
function IcoBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcoLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 11l4-4 3 3 5-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IcoArea() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18" />
      <path
        d="M2 11l4-4 3 3 5-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SegTabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ key: string; label: React.ReactNode; title?: string }>;
  className?: string;
}) {
  return (
    <div className={props.className || ''}>
      <div className="sg-tabs">
        {props.items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={'sg-tab' + (props.value === it.key ? ' is-active' : '')}
            onClick={() => props.onChange(it.key)}
            title={it.title || ''}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Sales() {
  const { appId, range } = useAppState();

  // left: chart metric + chart type
  const [metric, setMetric] = React.useState<
    'revenue' | 'orders' | 'buyers' | 'aov' | 'coins_issued' | 'coins_redeemed'
  >('revenue');
  const [chartType, setChartType] = React.useState<'bar' | 'line' | 'area'>('bar');

  // under-chart panel
  const [panel, setPanel] = React.useState<'live' | 'customers' | 'cashiers'>('live');

  // right: top list controls
  const [topKind, setTopKind] = React.useState<'buyers' | 'cashiers'>('buyers');
  const [topMetric, setTopMetric] = React.useState<'revenue' | 'orders' | 'aov' | 'coins_issued'>(
    'revenue'
  );

  // customers search
  const [q, setQ] = React.useState('');

  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['sales.kpi', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<KpiResp>(`/api/cabinet/apps/${appId}/sales/kpi?${qs(range)}`),
    staleTime: 10_000,
  });

  const qSeries = useQuery({
    enabled: !!appId,
    queryKey: ['sales.series', appId, metric, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: SeriesPoint[] }>(
        `/api/cabinet/apps/${appId}/sales/timeseries?${qs({ ...range, metric })}`
      ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && panel === 'live',
    queryKey: ['sales.live', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: LiveItem[] }>(
        `/api/cabinet/apps/${appId}/sales/live?${qs(range)}`
      ),
    staleTime: 2_000,
    refetchInterval: 6_000,
    retry: 0,
  });

  const qCustomers = useQuery({
    enabled: !!appId && panel === 'customers',
    queryKey: ['sales.customers', appId, range.from, range.to, q],
    queryFn: () =>
      apiFetch<{ ok: true; items: CustomerRow[] }>(
        `/api/cabinet/apps/${appId}/sales/customers?${qs({ ...range, q })}`
      ),
    staleTime: 10_000,
  });

  const qCashiers = useQuery({
    enabled: !!appId && panel === 'cashiers',
    queryKey: ['sales.cashiers', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: CashierRow[] }>(
        `/api/cabinet/apps/${appId}/sales/cashiers?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  const qTop = useQuery({
    enabled: !!appId,
    queryKey: ['sales.top', appId, topKind, topMetric, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: TopItem[] }>(
        `/api/cabinet/apps/${appId}/sales/top?${qs({ ...range, kind: topKind, metric: topMetric })}`
      ),
    staleTime: 10_000,
  });

  const kpi = qKpi.data || ({} as KpiResp);
  const series = qSeries.data?.items || [];
  const top = qTop.data?.items || [];

  const chartTitle =
    metric === 'revenue'
      ? 'Выручка'
      : metric === 'orders'
      ? 'Чеки'
      : metric === 'buyers'
      ? 'Покупатели'
      : metric === 'aov'
      ? 'Средний чек'
      : metric === 'coins_issued'
      ? 'Монеты выдано'
      : 'Монеты списано';

  // max for top bar width
  const topMax = Math.max(1, ...top.map((x) => Number(x.metric) || 0));

  return (
    <div className="sg-page salesPage">
      <div className="salesHead">
        <div>
          <h1 className="sg-h1">Sales</h1>
          <div className="sg-sub">
            QR-чеки → выручка, клиенты, кассиры, лояльность.
          </div>
        </div>
      </div>

      <div className="salesGrid">
        {/* LEFT */}
        <div className="salesLeft">
          {/* Chart card always visible */}
          <Card className="salesCard">
            <div className="salesCardHead salesCardHeadRow">
              <div>
                <div className="salesCardTitle">{chartTitle}</div>
                <div className="salesCardSub">
                  {range.from} — {range.to}
                </div>
              </div>

              {/* metric segmented */}
              <SegTabs
                className="salesMetricTabs"
                value={metric}
                onChange={(v) => setMetric(v as any)}
                items={[
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'orders', label: 'Orders' },
                  { key: 'buyers', label: 'Buyers' },
                  { key: 'aov', label: 'AOV' },
                  { key: 'coins_issued', label: 'Issued' },
                  { key: 'coins_redeemed', label: 'Redeemed' },
                ]}
              />

              {/* chart type icons on card */}
              <div className="salesChartBtns" role="tablist" aria-label="Chart type">
                <button
                  type="button"
                  className={'salesChartBtn ' + (chartType === 'bar' ? 'is-active' : '')}
                  onClick={() => setChartType('bar')}
                  title="Столбцы"
                  aria-label="Столбцы"
                >
                  <IcoBars />
                </button>
                <button
                  type="button"
                  className={'salesChartBtn ' + (chartType === 'line' ? 'is-active' : '')}
                  onClick={() => setChartType('line')}
                  title="Линия"
                  aria-label="Линия"
                >
                  <IcoLine />
                </button>
                <button
                  type="button"
                  className={'salesChartBtn ' + (chartType === 'area' ? 'is-active' : '')}
                  onClick={() => setChartType('area')}
                  title="Area"
                  aria-label="Area"
                >
                  <IcoArea />
                </button>
              </div>
            </div>

            <div className="salesChart">
              {qSeries.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qSeries.isError && (
                <div className="sg-muted">Ошибка: {(qSeries.error as Error).message}</div>
              )}

              {!qSeries.isLoading && !qSeries.isError && (
                <div style={{ height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={series} barCategoryGap={18}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="ts" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey={metric} fill="var(--accent)" radius={[10, 10, 4, 4]} />
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="ts" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey={metric}
                          stroke="var(--accent)"
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    ) : (
                      <AreaChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="ts" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey={metric}
                          stroke="var(--accent)"
                          fill="var(--accent)"
                          fillOpacity={0.14}
                          strokeWidth={3}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* KPI tiles */}
            <div className="salesKpiRow">
              <div className="salesKpi">
                <div className="salesKpiLbl">Revenue</div>
                <div className="salesKpiVal">{fmtMoney(kpi.revenue)}</div>
              </div>
              <div className="salesKpi">
                <div className="salesKpiLbl">Orders</div>
                <div className="salesKpiVal">{fmtInt(kpi.orders)}</div>
              </div>
              <div className="salesKpi">
                <div className="salesKpiLbl">Buyers</div>
                <div className="salesKpiVal">{fmtInt(kpi.buyers)}</div>
              </div>
              <div className="salesKpi">
                <div className="salesKpiLbl">AOV</div>
                <div className="salesKpiVal">{fmtMoney(kpi.aov)}</div>
              </div>
            </div>

            {/* Under-chart panel switcher */}
            <div className="salesUnderTabs">
              <SegTabs
                className="salesUnderTabs__seg"
                value={panel}
                onChange={(v) => setPanel(v as any)}
                items={[
                  { key: 'live', label: 'Live' },
                  { key: 'customers', label: 'Customers' },
                  { key: 'cashiers', label: 'Cashiers' },
                ]}
              />

              {/* LIVE */}
              {panel === 'live' && (
                <div className="salesUnderPanel">
                  <div className="salesUnderHead">
                    <div>
                      <div className="salesCardTitle">Live</div>
                      <div className="salesCardSub">auto refresh</div>
                    </div>
                    <div className="sg-pill" style={{ padding: '8px 12px' }}>
                      {qLive.isFetching ? 'обновляю…' : 'готово'}
                    </div>
                  </div>

                  {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qLive.isError && (
                    <div className="sg-muted">Ошибка: {(qLive.error as Error).message}</div>
                  )}

                  {qLive.data?.items?.length ? (
                    <div className="salesLiveList">
                      {qLive.data.items.slice(0, 16).map((e, i) => (
                        <div className="salesLiveRow" key={i}>
                          <div className="salesLiveTs">{e.ts || ''}</div>
                          <div className="salesLiveMid">
                            <div className="salesLiveTitle">{e.label || e.user || 'Покупка'}</div>
                            <div className="salesLiveSub">
                              {e.cashier ? `кассир: ${e.cashier}` : ''}
                            </div>
                          </div>
                          <div className="salesLiveRight">
                            <div className="salesLiveAmt">{fmtMoney(e.amount)}</div>
                            <div className="salesLiveCoins">{e.coins ? `+${e.coins}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !qLive.isLoading && !qLive.isError ? (
                    <div className="sg-muted">Пока пусто</div>
                  ) : null}
                </div>
              )}

              {/* CUSTOMERS */}
              {panel === 'customers' && (
                <div className="salesUnderPanel">
                  <div className="salesUnderHead">
                    <div>
                      <div className="salesCardTitle">Customers</div>
                      <div className="salesCardSub">RFM-lite: recency / frequency / money</div>
                    </div>
                    <div style={{ width: 280 }}>
                      <Input
                        value={q}
                        onChange={(e: any) => setQ(e.target.value)}
                        placeholder="поиск: имя / tg_id"
                      />
                    </div>
                  </div>

                  {qCustomers.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qCustomers.isError && (
                    <div className="sg-muted">Ошибка: {(qCustomers.error as Error).message}</div>
                  )}

                  <div className="salesTableWrap">
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Last</th>
                          <th>Orders</th>
                          <th>Revenue</th>
                          <th>Recency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(qCustomers.data?.items || []).slice(0, 30).map((r) => (
                          <tr key={r.tg_id}>
                            <td style={{ fontWeight: 900 }}>
                              {r.name || r.tg_id}
                            </td>
                            <td>{r.last_purchase || '—'}</td>
                            <td>{fmtInt(r.orders)}</td>
                            <td>{fmtMoney(r.revenue)}</td>
                            <td>{r.recency_days ?? '—'}</td>
                          </tr>
                        ))}
                        {!qCustomers.isLoading && !(qCustomers.data?.items || []).length && (
                          <tr>
                            <td colSpan={5} style={{ opacity: 0.7, padding: 14 }}>
                              Нет данных
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CASHIERS */}
              {panel === 'cashiers' && (
                <div className="salesUnderPanel">
                  <div className="salesUnderHead">
                    <div>
                      <div className="salesCardTitle">Cashiers</div>
                      <div className="salesCardSub">эффективность + аномалии</div>
                    </div>
                  </div>

                  {qCashiers.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qCashiers.isError && (
                    <div className="sg-muted">Ошибка: {(qCashiers.error as Error).message}</div>
                  )}

                  <div className="salesTableWrap">
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>Cashier</th>
                          <th>Orders</th>
                          <th>Revenue</th>
                          <th>AOV</th>
                          <th>Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(qCashiers.data?.items || []).slice(0, 30).map((r) => (
                          <tr key={r.tg_id}>
                            <td style={{ fontWeight: 900 }}>{r.name || r.tg_id}</td>
                            <td>{fmtInt(r.orders)}</td>
                            <td>{fmtMoney(r.revenue)}</td>
                            <td>{fmtMoney(r.aov)}</td>
                            <td>{r.suspicious ? `⚠ ${r.suspicious}` : '—'}</td>
                          </tr>
                        ))}
                        {!qCashiers.isLoading && !(qCashiers.data?.items || []).length && (
                          <tr>
                            <td colSpan={5} style={{ opacity: 0.7, padding: 14 }}>
                              Нет данных
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT (sticky) */}
        <div className="salesRight">
          <Card className="salesCard salesSticky">
            <div className="salesCardHead">
              <div className="salesCardTitle">Сводка</div>
            </div>

            <div className="salesSummaryPro">
              <div className="salesSummaryTiles">
                <div className="salesSumTile">
                  <div className="salesSumLbl">Issued</div>
                  <div className="salesSumVal">{fmtInt(kpi.coins_issued ?? 0)}</div>
                </div>
                <div className="salesSumTile">
                  <div className="salesSumLbl">Redeemed</div>
                  <div className="salesSumVal">{fmtInt(kpi.coins_redeemed ?? 0)}</div>
                </div>
                <div className="salesSumTile is-strong">
                  <div className="salesSumLbl">Redeem rate</div>
                  <div className="salesSumVal">{fmtPct(kpi.redeem_rate ?? 0)}</div>
                </div>
              </div>

              <div className="salesBarBox">
                <div className="salesBarTop">
                  <div className="salesBarName">Returning share</div>
                  <div className="salesBadge">
                    {fmtPct(kpi.returning_share ?? 0)}
                  </div>
                </div>

                <div className="salesTrack" aria-hidden="true">
                  <div
                    className="salesFill"
                    style={{ width: `${clamp(Number(kpi.returning_share || 0), 0, 100)}%` }}
                  />
                </div>

                <div className="salesBarMeta">
                  <span className="sg-muted">
                    Buyers: <b>{fmtInt(kpi.buyers)}</b>
                  </span>
                  <span className="sg-muted">
                    Orders: <b>{fmtInt(kpi.orders)}</b>
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="salesCard salesStickyTop">
            <div className="salesCardHead salesTopHead">
              <div className="salesCardTitle">Топ</div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <SegTabs
                  className="salesMiniTabs"
                  value={topKind}
                  onChange={(v) => setTopKind(v as any)}
                  items={[
                    { key: 'buyers', label: 'Buyers' },
                    { key: 'cashiers', label: 'Cashiers' },
                  ]}
                />
                <SegTabs
                  className="salesMiniTabs"
                  value={topMetric}
                  onChange={(v) => setTopMetric(v as any)}
                  items={[
                    { key: 'revenue', label: 'Revenue' },
                    { key: 'orders', label: 'Orders' },
                    { key: 'aov', label: 'AOV' },
                    { key: 'coins_issued', label: 'Coins' },
                  ]}
                />
              </div>
            </div>

            <div className="salesTopList">
              {top.map((p, idx) => {
                const w = Math.round(((Number(p.metric) || 0) / topMax) * 100);
                return (
                  <div className={'salesTopRow ' + (idx < 3 ? 'is-top' : '')} key={p.id}>
                    <div className={'salesMedal m' + (idx + 1)}>{idx + 1}</div>

                    <div className="salesTopMid">
                      <div className="salesTopTitle">{p.title}</div>
                      <div className="salesTopMini">{p.extra || ''}</div>
                      <div className="salesTopBar">
                        <div className="salesTopBarFill" style={{ width: `${w}%` }} />
                      </div>
                    </div>

                    <div className="salesTopRight">
                      <div className="salesTopCount">{fmtInt(p.metric)}</div>
                    </div>
                  </div>
                );
              })}
              {!top.length && !qTop.isLoading && <div className="sg-muted">Пока пусто</div>}
              {qTop.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qTop.isError && (
                <div className="sg-muted">Ошибка: {(qTop.error as Error).message}</div>
              )}
            </div>
          </Card>

          <Card className="salesCard">
            <div className="salesCardHead">
              <div className="salesCardTitle">Insights</div>
            </div>
            <div className="salesIdeas">
              <div className="sg-muted">• RFM сегменты + “уснувшие” клиенты</div>
              <div className="sg-muted">• ROI акций (мультипликаторы/миссии)</div>
              <div className="sg-muted">• Аномалии кассиров (дубли/частые чеки)</div>
              <div className="sg-muted">• Liability монет (непогашенные)</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
