// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';

/**
 * SALES — PRO++ (Apple/Stripe)
 *
 * v2 additions:
 * - Dynamic scales/domains based on visible series (day + cum axis)
 * - Better tick formatting (k / M) with currency
 * - “Pill” overlay buttons like Wheel (premium segmented)
 * - Funnel visualization (premium) for sales pipeline
 *
 * DEV NOTE endpoints (future):
 * - GET /api/cabinet/apps/:appId/sales/timeseries?from&to
 * - GET /api/cabinet/apps/:appId/sales/kpi?from&to
 * - GET /api/cabinet/apps/:appId/sales/funnel?from&to
 * - GET /api/cabinet/apps/:appId/sales/top?kind=buyers|products&metric=revenue&from&to
 */

type SalesTimeseriesDay = {
  date: string; // YYYY-MM-DD
  orders: number;
  customers: number;

  revenue_cents: number;
  cogs_cents: number;
  ops_cents: number;
  profit_cents: number;

  aov_cents?: number;
};

type SalesKpi = {
  revenue_cents: number;
  profit_cents: number;
  cogs_cents: number;
  ops_cents: number;

  orders: number;
  customers: number;

  aov_cents: number;
  profit_margin_pct: number;

  alerts?: Array<{ code: string; title: string; severity: 'warn' | 'bad' }>;
};

type TopRow = {
  title: string;
  value_cents: number;
  sub?: string;
};

type FunnelStage = {
  key: string;
  title: string;
  count: number;        // events/users
  value_cents?: number; // optional money
};

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmtDDMM(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function currencySymbol(currency: string) {
  const c = String(currency || 'RUB').toUpperCase();
  if (c === 'RUB') return '₽';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  return c;
}

function moneyFromCent(cent: number | null | undefined, currency = 'RUB') {
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';
  const c = String(currency || 'RUB').toUpperCase();
  const sym = currencySymbol(c);

  if (c === 'USD' || c === 'EUR') return `${sym}${(v / 100).toFixed(2)}`;
  if (c === 'RUB') return `${(v / 100).toFixed(2)} ₽`;
  return `${(v / 100).toFixed(2)} ${sym}`;
}

function compactMoneyFromCents(cents: number, currency: string) {
  const sym = currencySymbol(currency);
  const v = Number(cents);
  if (!Number.isFinite(v)) return '—';

  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';

  // cents -> units
  const units = abs / 100;

  if (units >= 1_000_000) return `${sign}${sym}${(units / 1_000_000).toFixed(1)}M`;
  if (units >= 1_000) return `${sign}${sym}${(units / 1_000).toFixed(1)}k`;
  if (units >= 100) return `${sign}${sym}${Math.round(units)}`;
  return `${sign}${sym}${units.toFixed(0)}`;
}

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${Number(x).toFixed(1)}%`;
}

function ShimmerRow({ w1 = 46, w2 = 24 }: { w1?: number; w2?: number }) {
  return (
    <div className="sgShimmerRow" aria-hidden="true">
      <span className="sgShimmerBar" style={{ width: `${w1}%` }} />
      <span className="sgShimmerBar" style={{ width: `${w2}%` }} />
    </div>
  );
}

function Collapsible({
  title,
  right,
  defaultOpen,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);

  return (
    <div className={'sgColl ' + (open ? 'is-open' : 'is-closed')}>
      <button
        type="button"
        className="sgCollHead"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="sgCollTitle">{title}</div>
        <div className="sgCollRight">
          {right}
          <span className={'sgChevron ' + (open ? 'is-open' : '')} aria-hidden="true" />
        </div>
      </button>

      <div className="sgCollBody" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="sgCollBodyInner">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Mock data until worker ---------- */
function mockTimeseries(fromISO: string, toISO: string): SalesTimeseriesDay[] {
  const out: SalesTimeseriesDay[] = [];
  const a = new Date(fromISO + 'T00:00:00Z');
  const b = new Date(toISO + 'T00:00:00Z');
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return out;

  const cur = new Date(a);
  let lastCustomers = 24 + Math.random() * 30;

  for (let i = 0; i < 400; i++) {
    if (cur.getTime() > b.getTime()) break;

    const orders = Math.max(1, Math.round(40 + Math.random() * 80));
    const customers = Math.max(1, Math.round(lastCustomers + (Math.random() - 0.5) * 10));
    lastCustomers = customers;

    const revenue = Math.round((orders * (900 + Math.random() * 700)) * 100);
    const cogs = Math.round(revenue * (0.35 + Math.random() * 0.10));
    const ops = Math.round(revenue * (0.10 + Math.random() * 0.08));
    const profit = revenue - cogs - ops;

    const aov = orders > 0 ? Math.round(revenue / orders) : 0;

    out.push({
      date: cur.toISOString().slice(0, 10),
      orders,
      customers,
      revenue_cents: revenue,
      cogs_cents: cogs,
      ops_cents: ops,
      profit_cents: profit,
      aov_cents: aov,
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return out;
}

function mockTop(kind: 'buyers' | 'products'): TopRow[] {
  const base = kind === 'buyers'
    ? ['Антон', 'Мария', 'Илья', 'Саша', 'Денис', 'Оля', 'Вика', 'Павел']
    : ['Капучино', 'Латте', 'Эспрессо', 'Круассан', 'Сэндвич', 'Матча', 'Американо', 'Торт'];

  return base.slice(0, 7).map((t, idx) => {
    const v = Math.round((65000 + Math.random() * 120000) * 100);
    return {
      title: t,
      value_cents: v,
      sub: kind === 'buyers' ? `заказов: ${12 + idx * 3}` : `шт: ${40 + idx * 7}`,
    };
  });
}

function mockFunnel(): FunnelStage[] {
  // DEV NOTE: заменить реальными событиями (пример):
  // views -> opens -> add_to_cart -> checkout -> paid
  return [
    { key: 'views', title: 'Просмотры', count: 18420 },
    { key: 'opens', title: 'Открыли', count: 6120 },
    { key: 'cart', title: 'Добавили', count: 2190 },
    { key: 'checkout', title: 'Оформление', count: 980 },
    { key: 'paid', title: 'Оплата', count: 640, value_cents: 4_220_000 },
  ];
}

/* ---------- Dynamic scale helpers ---------- */
function domainFrom(values: number[], padRatio = 0.08): [number, number] {
  const finite = values.filter((x) => Number.isFinite(x));
  if (!finite.length) return [0, 1];

  let min = Math.min(...finite);
  let max = Math.max(...finite);

  if (min === max) {
    const delta = Math.max(1, Math.abs(min) * 0.12);
    return [min - delta, max + delta];
  }

  const span = max - min;
  const pad = span * padRatio;

  min = min - pad;
  max = max + pad;

  // nicer around zero if signs mixed
  if (min < 0 && max > 0) {
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    return [-absMax * 1.02, absMax * 1.02];
  }

  return [min, max];
}

export default function Sales() {
  const { appId, range } = useAppState() as any;

  // chart layers
  const [showRevenue, setShowRevenue] = React.useState(true);
  const [showCosts, setShowCosts] = React.useState(false);
  const [showProfitBars, setShowProfitBars] = React.useState(true);
  const [showCumProfit, setShowCumProfit] = React.useState(false);

  // under tabs
  const [tab, setTab] = React.useState<'live' | 'customers' | 'cashiers' | 'funnel'>('live');

  // UI controls (placeholder)
  const [currency, setCurrency] = React.useState<'RUB' | 'USD' | 'EUR'>('RUB');
  const [costThresholdDraft, setCostThresholdDraft] = React.useState<string>('35');
  const costThresholdPct = clampN(Number(String(costThresholdDraft).replace(',', '.')), 0, 95);

  const qTs = useQuery({
    enabled: !!appId,
    queryKey: ['sales_ts', appId, range?.from, range?.to],
    queryFn: async () => {
      // DEV NOTE: replace with real
      // return apiFetch<{ ok:true; days: SalesTimeseriesDay[] }>(`/api/cabinet/apps/${appId}/sales/timeseries?${qs(range)}`);
      return { ok: true, days: mockTimeseries(range.from, range.to) };
    },
    staleTime: 10_000,
  });

  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['sales_kpi', appId, range?.from, range?.to, costThresholdPct],
    queryFn: async () => {
      const days = qTs.data?.days || [];
      const revenue = days.reduce((s, d) => s + (Number(d.revenue_cents) || 0), 0);
      const cogs = days.reduce((s, d) => s + (Number(d.cogs_cents) || 0), 0);
      const ops = days.reduce((s, d) => s + (Number(d.ops_cents) || 0), 0);
      const profit = revenue - cogs - ops;

      const orders = days.reduce((s, d) => s + (Number(d.orders) || 0), 0);
      const customers = days.reduce((s, d) => s + (Number(d.customers) || 0), 0);
      const aov = orders > 0 ? Math.round(revenue / orders) : 0;

      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const cogsPct = revenue > 0 ? (cogs / revenue) * 100 : 0;

      const alerts: SalesKpi['alerts'] = [];
      if (profit < 0) alerts.push({ code: 'sales.profit.negative', title: 'Период в минусе', severity: 'bad' });
      if (cogsPct > costThresholdPct) alerts.push({ code: 'sales.cogs.high', title: `Себестоимость > ${costThresholdPct}%`, severity: 'warn' });

      return {
        ok: true,
        kpi: {
          revenue_cents: revenue,
          profit_cents: profit,
          cogs_cents: cogs,
          ops_cents: ops,
          orders,
          customers,
          aov_cents: aov,
          profit_margin_pct: margin,
          alerts,
        },
      };
    },
    staleTime: 10_000,
  });

  const qTopBuyers = useQuery({
    enabled: !!appId,
    queryKey: ['sales_top_buyers', appId, range?.from, range?.to],
    queryFn: async () => ({ ok: true, items: mockTop('buyers') }),
    staleTime: 10_000,
  });

  const qTopProducts = useQuery({
    enabled: !!appId,
    queryKey: ['sales_top_products', appId, range?.from, range?.to],
    queryFn: async () => ({ ok: true, items: mockTop('products') }),
    staleTime: 10_000,
  });

  const qFunnel = useQuery({
    enabled: !!appId,
    queryKey: ['sales_funnel', appId, range?.from, range?.to],
    queryFn: async () => {
      // DEV NOTE: replace with:
      // return apiFetch<{ ok:true; stages: FunnelStage[] }>(`/api/cabinet/apps/${appId}/sales/funnel?${qs(range)}`);
      return { ok: true, stages: mockFunnel() };
    },
    staleTime: 10_000,
  });

  const isLoading = qTs.isLoading || qKpi.isLoading;
  const isError = qTs.isError || qKpi.isError;

  const days = qTs.data?.days || [];
  const kpi = qKpi.data?.kpi;

  const alerts = kpi?.alerts || [];
  const hasAlert = alerts.some(a => a.severity === 'bad');
  const hasWarn = !hasAlert && alerts.some(a => a.severity === 'warn');

  // Chart series (cum optional)
  const chartSeries = React.useMemo(() => {
    let cum = 0;
    return (days || []).map((d) => {
      const revenue = Number(d.revenue_cents) || 0;
      const costs = (Number(d.cogs_cents) || 0) + (Number(d.ops_cents) || 0);
      const profit = Number(d.profit_cents);
      const p = Number.isFinite(profit) ? profit : (revenue - costs);
      cum += p;

      return {
        date: d.date,
        revenue,
        costs,
        profit: p,
        cum_profit: cum,
        orders: Number(d.orders) || 0,
        customers: Number(d.customers) || 0,
      };
    });
  }, [days]);

  // Dynamic domains based on visible layers
  const dayDomain = React.useMemo<[number, number]>(() => {
    const vals: number[] = [];
    for (const r of chartSeries) {
      if (showRevenue) vals.push(Number(r.revenue));
      if (showCosts) vals.push(Number(r.costs));
      if (showProfitBars) vals.push(Number(r.profit));
    }
    return domainFrom(vals, 0.10);
  }, [chartSeries, showRevenue, showCosts, showProfitBars]);

  const cumDomain = React.useMemo<[number, number]>(() => {
    if (!showCumProfit) return [0, 1];
    const vals = chartSeries.map(r => Number(r.cum_profit));
    return domainFrom(vals, 0.06);
  }, [chartSeries, showCumProfit]);

  // KPI tiles
  const tiles = React.useMemo(() => {
    const revenue = Number(kpi?.revenue_cents) || 0;
    const profit = Number(kpi?.profit_cents) || 0;
    const cogs = Number(kpi?.cogs_cents) || 0;
    const ops = Number(kpi?.ops_cents) || 0;

    const orders = Number(kpi?.orders) || 0;
    const customers = Number(kpi?.customers) || 0;
    const aov = Number(kpi?.aov_cents) || 0;

    const margin = Number(kpi?.profit_margin_pct) || 0;
    const cogsPct = revenue > 0 ? (cogs / revenue) * 100 : 0;

    return { revenue, profit, cogs, ops, orders, customers, aov, margin, cogsPct };
  }, [kpi]);

  const topBuyers = qTopBuyers.data?.items || [];
  const topProducts = qTopProducts.data?.items || [];
  const funnel = qFunnel.data?.stages || [];

  const badgeLabel = React.useMemo(() => {
    if (hasAlert) return { text: 'АЛЕРТ', cls: 'is-bad' };
    if (hasWarn) return { text: 'РИСК', cls: 'is-warn' };
    return { text: 'ОК', cls: 'is-good' };
  }, [hasAlert, hasWarn]);

  const funnelStats = React.useMemo(() => {
    if (!funnel.length) return { from: 0, to: 0, conv: 0 };
    const from = funnel[0]?.count || 0;
    const to = funnel[funnel.length - 1]?.count || 0;
    const conv = from > 0 ? (to / from) * 100 : 0;
    return { from, to, conv };
  }, [funnel]);

  return (
    <div className="sg-page salesPage">
      <style>{`
/* =========================================
   SALES PRO++ — palette closer to “first”
   (ink + muted ink + soft fill)
   ========================================= */
:root{
  --s-ink: rgba(15,23,42,.92);
  --s-ink2: rgba(15,23,42,.62);
  --s-ink3: rgba(15,23,42,.38);
  --s-fill: rgba(15,23,42,.14);
  --s-fill2: rgba(15,23,42,.09);

  --sl-r-xl: 20px;
  --sl-r-lg: 18px;

  --sl-bd: rgba(15,23,42,.10);
  --sl-bd2: rgba(15,23,42,.08);

  --sl-bg: rgba(255,255,255,.62);
  --sl-bg2: rgba(255,255,255,.78);

  --sl-sh1: 0 14px 34px rgba(15,23,42,.08);
  --sl-sh2: 0 22px 60px rgba(15,23,42,.10);
  --sl-in1: inset 0 1px 0 rgba(255,255,255,.55);

  --sl-ok-bg: rgba(34,197,94,.10);
  --sl-ok-bd: rgba(34,197,94,.22);

  --sl-warn-bg: rgba(245,158,11,.10);
  --sl-warn-bd: rgba(245,158,11,.22);

  --sl-bad-bg: rgba(239,68,68,.09);
  --sl-bad-bd: rgba(239,68,68,.22);
}

.salesPage{ position:relative; }
.salesPage::before{
  content:"";
  position:absolute;
  inset:-40px -40px auto -40px;
  height:340px;
  background:
    radial-gradient(900px 240px at 20% 20%, rgba(15,23,42,.06), rgba(255,255,255,0) 60%),
    radial-gradient(720px 260px at 80% 0%, rgba(15,23,42,.04), rgba(255,255,255,0) 65%);
  pointer-events:none;
  z-index:0;
}
.salesPage > *{ position:relative; z-index:1; }

.salesGrid{
  display:grid;
  grid-template-columns: 1fr 380px;
  gap:12px;
}
@media (max-width: 1100px){
  .salesGrid{ grid-template-columns: 1fr; }
}

.salesCard{
  border:1px solid var(--sl-bd2) !important;
  border-radius: var(--sl-r-xl) !important;
  background: var(--sl-bg) !important;
  box-shadow: var(--sl-sh1), var(--sl-in1) !important;
  overflow:hidden;
}
.salesCard.is-hover{
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, filter .16s ease;
}
.salesCard.is-hover:hover{
  transform: translateY(-1px);
  box-shadow: var(--sl-sh2), var(--sl-in1) !important;
  border-color: rgba(15,23,42,.14) !important;
  filter: saturate(1.02);
}

.sgAlertBadge{
  position:absolute;
  top:12px;
  right:12px;
  width:22px;
  height:22px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  font-size:13px;
  background: var(--sl-bad-bg);
  border:1px solid var(--sl-bad-bd);
}

.salesHead{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  margin-bottom:12px;
}
.salesSub{ opacity:.78; }

.salesChartWrap{
  position:relative;
  width:100%;
  height:340px;
}
.salesChartOverlay{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-direction:column;
  gap:10px;
  pointer-events:none;
}
.salesChartOverlayText{
  font-weight:900;
  opacity:.78;
}
.salesSpinner{
  width:26px;
  height:26px;
  border-radius:999px;
  border:3px solid rgba(15,23,42,.16);
  border-top-color: rgba(15,23,42,.55);
  animation: salesSpin .8s linear infinite;
}
@keyframes salesSpin{
  from{ transform: rotate(0deg); }
  to{ transform: rotate(360deg); }
}

/* Pill overlay controls (Wheel-like) */
.salesPills{
  display:inline-flex;
  gap:8px;
  padding:4px;
  border-radius:16px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.62);
  box-shadow: var(--sl-in1);
}
.salesPill{
  height:32px;
  padding:0 12px;
  border-radius:12px;
  border:1px solid transparent;
  background: transparent;
  cursor:pointer;
  font-weight:900;
  font-size:12px;
  opacity:.88;
  display:inline-flex;
  align-items:center;
  gap:8px;
  color: var(--s-ink);
}
.salesPill:hover{ opacity:1; }
.salesPill.is-active{
  background: rgba(15,23,42,.05);
  border-color: rgba(15,23,42,.12);
  box-shadow: 0 12px 22px rgba(15,23,42,.06), var(--sl-in1);
  opacity:1;
}

.salesTabs{
  display:inline-flex;
  gap:8px;
  padding:4px;
  border-radius:16px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.60);
  box-shadow: var(--sl-in1);
}
.salesTab{
  height:32px;
  padding:0 12px;
  border-radius:12px;
  border:1px solid transparent;
  background:transparent;
  cursor:pointer;
  font-weight:900;
  font-size:12px;
  opacity:.9;
}
.salesTab:hover{ opacity:1; }
.salesTab.is-active{
  background: rgba(15,23,42,.05);
  border-color: rgba(15,23,42,.12);
  box-shadow: 0 12px 22px rgba(15,23,42,.06), var(--sl-in1);
  opacity:1;
}

.salesTiles{
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap:10px;
}
@media (max-width: 900px){
  .salesTiles{ grid-template-columns: 1fr; }
}
.salesTile{
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.74);
  border-radius: var(--sl-r-lg);
  box-shadow: var(--sl-in1);
  padding:12px 12px;
}
.salesTileLbl{
  font-weight:900;
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  opacity:.72;
}
.salesTileVal{
  font-weight:950;
  font-size:22px;
  margin-top:6px;
  letter-spacing:-.02em;
}
.salesTileSub{
  margin-top:6px;
  font-size:12px;
  opacity:.78;
  line-height:1.25;
}

.salesBadge{
  display:inline-flex;
  align-items:center;
  height:22px;
  padding:0 10px;
  border-radius:999px;
  font-weight:900;
  font-size:12px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.72);
  box-shadow: var(--sl-in1);
}
.salesBadge.is-good{ background: var(--sl-ok-bg); border-color: var(--sl-ok-bd); }
.salesBadge.is-warn{ background: var(--sl-warn-bg); border-color: var(--sl-warn-bd); }
.salesBadge.is-bad{  background: var(--sl-bad-bg); border-color: var(--sl-bad-bd); }
.salesBadge.is-neutral{ background: rgba(15,23,42,.05); border-color: rgba(15,23,42,.10); }

.sgShimmerRow{ display:flex; gap:12px; align-items:center; }
.sgShimmerBar{
  height:12px;
  border-radius:999px;
  background: linear-gradient(90deg, rgba(15,23,42,.06) 0%, rgba(15,23,42,.12) 40%, rgba(15,23,42,.06) 80%);
  background-size: 200% 100%;
  animation: sgShimmer 1.6s linear infinite;
}
@keyframes sgShimmer{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

.salesRows{ display:flex; flex-direction:column; gap:8px; }
.salesRow{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  padding:10px 10px;
  border-radius: 16px;
  border:1px solid rgba(15,23,42,.07);
  background: rgba(255,255,255,.72);
  box-shadow: var(--sl-in1);
}
.salesRowLeft{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.salesRowTitle{ font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.salesRowSub{ font-size:12px; opacity:.78; }
.salesRowRight{ text-align:right; display:flex; flex-direction:column; gap:2px; flex:0 0 auto; }
.salesRowVal{ font-weight:900; }
.salesRowMeta{ font-size:12px; opacity:.74; }

.sgColl{
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.62);
  border-radius: var(--sl-r-xl);
  box-shadow: var(--sl-in1);
  overflow:hidden;
}
.sgCollHead{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px 12px;
  border:0;
  background: transparent;
  cursor:pointer;
}
.sgCollTitle{ font-weight:900; }
.sgCollRight{ display:flex; align-items:center; gap:10px; }
.sgChevron{
  width:10px; height:10px;
  border-right:2px solid rgba(15,23,42,.55);
  border-bottom:2px solid rgba(15,23,42,.55);
  transform: rotate(45deg);
  transition: transform .16s ease;
  opacity:.7;
}
.sgChevron.is-open{ transform: rotate(225deg); }
.sgCollBody{ display:grid; transition: grid-template-rows .18s ease; }
.sgCollBodyInner{ overflow:hidden; padding:0 12px 12px 12px; }

.salesSticky{
  position: sticky;
  top: 14px;
  display:flex;
  flex-direction:column;
  gap:12px;
}
@media (max-width:1100px){
  .salesSticky{ position: static; }
}

/* Funnel premium */
.funnelWrap{
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.74);
  border-radius: 18px;
  box-shadow: var(--sl-in1);
  padding:12px;
}
.funnelTop{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
}
.funnelKPIs{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-top:10px;
}
.funnelKPI{
  height:26px;
  padding:0 10px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
  box-shadow: var(--sl-in1);
  font-weight:900;
  font-size:12px;
  opacity:.92;
}
.funnelBars{
  display:flex;
  flex-direction:column;
  gap:8px;
  margin-top:12px;
}
.fbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.fbarLeft{
  min-width:0;
}
.fbarTitle{
  font-weight:900;
  font-size:12px;
  opacity:.86;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.fbarTrack{
  height:10px;
  border-radius:999px;
  background: rgba(15,23,42,.06);
  border:1px solid rgba(15,23,42,.08);
  overflow:hidden;
  margin-top:6px;
}
.fbarFill{
  height:100%;
  border-radius:999px;
  background: rgba(15,23,42,.22);
}
      `}</style>

      {/* HEADER */}
      <div className="salesHead">
        <div>
          <h1 className="sg-h1">Продажи</h1>
          <div className="salesSub">Факт + воронка (UI). Воркер подключим позже.</div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={currency}
            onChange={(e: any) => setCurrency(String(e.target.value || 'RUB') as any)}
            className="sg-input"
            style={{ height: 36 }}
          >
            <option value="RUB">RUB (₽)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="sg-muted" style={{ fontWeight: 900 }}>COGS threshold</span>
            <Input
              value={costThresholdDraft}
              onChange={(e: any) => setCostThresholdDraft(e.target.value)}
              style={{ width: 80 }}
            />
            <span className="sg-muted" style={{ fontWeight: 900 }}>%</span>
          </div>
        </div>
      </div>

      <div className="salesGrid">
        {/* LEFT */}
        <div>
          <Card className="salesCard is-hover" style={{ padding: 14, position: 'relative' }}>
            {(hasAlert || hasWarn) ? (
              <div className="sgAlertBadge" title={alerts.map(a => a.title).join('\n')}>!</div>
            ) : null}

            {/* Chart header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 950, letterSpacing: '-.01em' }}>
                  Факт: выручка / расходы / прибыль
                </div>
                <div className="sg-muted">
                  {range?.from} — {range?.to}
                  <span className="sg-muted"> · </span>
                  <span className={'salesBadge ' + badgeLabel.cls}>{badgeLabel.text}</span>
                </div>
              </div>

              <div className="salesPills" aria-label="chart layers">
                <button
                  type="button"
                  className={'salesPill ' + (showRevenue ? 'is-active' : '')}
                  onClick={() => setShowRevenue(v => !v)}
                  title="Линия: выручка/день"
                >
                  <span className="salesBadge is-neutral">Revenue</span>
                </button>
                <button
                  type="button"
                  className={'salesPill ' + (showCosts ? 'is-active' : '')}
                  onClick={() => setShowCosts(v => !v)}
                  title="Линия: расходы/день (COGS + Ops)"
                >
                  <span className="salesBadge is-neutral">Costs</span>
                </button>
                <button
                  type="button"
                  className={'salesPill ' + (showProfitBars ? 'is-active' : '')}
                  onClick={() => setShowProfitBars(v => !v)}
                  title="Цилиндры: прибыль/день"
                >
                  <span className="salesBadge is-neutral">Profit</span>
                </button>
                <button
                  type="button"
                  className={'salesPill ' + (showCumProfit ? 'is-active' : '')}
                  onClick={() => setShowCumProfit(v => !v)}
                  title="Линия: кумулятивная прибыль"
                >
                  <span className="salesBadge is-neutral">Cum</span>
                </button>
              </div>
            </div>

            {/* CHART */}
            <div className="salesChartWrap" style={{ marginTop: 12 }}>
              {!isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartSeries}
                    margin={{ top: 8, right: 18, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.28} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                    />

                    <YAxis
                      yAxisId="day"
                      domain={dayDomain as any}
                      tick={{ fontSize: 12 }}
                      width={66}
                      tickFormatter={(v: any) => compactMoneyFromCents(Number(v), currency)}
                    />

                    <YAxis
                      yAxisId="cum"
                      orientation="right"
                      domain={showCumProfit ? (cumDomain as any) : (['auto', 'auto'] as any)}
                      tick={{ fontSize: 12 }}
                      width={66}
                      tickFormatter={(v: any) => compactMoneyFromCents(Number(v), currency)}
                      hide={!showCumProfit}
                    />

                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'profit') return [moneyFromCent(val, currency), 'Прибыль/день'];
                        if (name === 'revenue') return [moneyFromCent(val, currency), 'Выручка/день'];
                        if (name === 'costs') return [moneyFromCent(val, currency), 'Расход/день'];
                        if (name === 'cum_profit') return [moneyFromCent(val, currency), 'Кум. прибыль'];
                        return [val, name];
                      }}
                      labelFormatter={(_: any, payload: any) => {
                        const d = payload?.[0]?.payload?.date;
                        return d ? `Дата ${d}` : 'Дата';
                      }}
                    />

                    {showProfitBars && (
                      <Bar
                        yAxisId="day"
                        dataKey="profit"
                        name="profit"
                        fill="var(--s-fill)"
                        fillOpacity={0.22}
                        radius={[10, 10, 10, 10]}
                      />
                    )}

                    {showRevenue && (
                      <Line
                        yAxisId="day"
                        type="monotone"
                        dataKey="revenue"
                        name="revenue"
                        stroke="var(--s-ink)"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}

                    {showCosts && (
                      <Line
                        yAxisId="day"
                        type="monotone"
                        dataKey="costs"
                        name="costs"
                        stroke="var(--s-ink2)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    )}

                    {showCumProfit && (
                      <Line
                        yAxisId="cum"
                        type="monotone"
                        dataKey="cum_profit"
                        name="cum_profit"
                        stroke="var(--s-ink3)"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {isLoading && (
                <div className="salesChartOverlay">
                  <div className="salesSpinner" />
                  <div className="salesChartOverlayText">Загрузка…</div>
                </div>
              )}

              {isError && (
                <div className="salesChartOverlay">
                  <div className="salesChartOverlayText">
                    Ошибка: {String((qTs.error as any)?.message || (qKpi.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              )}
            </div>

            {/* KPI Tiles */}
            <div style={{ marginTop: 12 }}>
              <div className="salesTiles">
                <div className="salesTile">
                  <div className="salesTileLbl">Выручка</div>
                  <div className="salesTileVal">{moneyFromCent(tiles.revenue, currency)}</div>
                  <div className="salesTileSub">
                    Заказы: <b>{tiles.orders}</b> · Клиенты: <b>{tiles.customers}</b>
                  </div>
                </div>

                <div className="salesTile">
                  <div className="salesTileLbl">Прибыль</div>
                  <div className="salesTileVal">{moneyFromCent(tiles.profit, currency)}</div>
                  <div className="salesTileSub">
                    Маржа: <b>{fmtPct(tiles.margin)}</b> · AOV: <b>{moneyFromCent(tiles.aov, currency)}</b>
                  </div>
                </div>

                <div className="salesTile">
                  <div className="salesTileLbl">COGS + Ops</div>
                  <div className="salesTileVal">{moneyFromCent(tiles.cogs + tiles.ops, currency)}</div>
                  <div className="salesTileSub">
                    COGS: <b>{moneyFromCent(tiles.cogs, currency)}</b> · Ops: <b>{moneyFromCent(tiles.ops, currency)}</b>
                  </div>
                </div>
              </div>
            </div>

            {/* Under-chart tabs */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="salesTabs">
                <button type="button" className={'salesTab ' + (tab === 'live' ? 'is-active' : '')} onClick={() => setTab('live')}>Live</button>
                <button type="button" className={'salesTab ' + (tab === 'funnel' ? 'is-active' : '')} onClick={() => setTab('funnel')}>Воронка</button>
                <button type="button" className={'salesTab ' + (tab === 'customers' ? 'is-active' : '')} onClick={() => setTab('customers')}>Клиенты</button>
                <button type="button" className={'salesTab ' + (tab === 'cashiers' ? 'is-active' : '')} onClick={() => setTab('cashiers')}>Кассиры</button>
              </div>

              <div className="sg-muted">DEV NOTE: табы подключим к endpoints</div>
            </div>

            <div style={{ marginTop: 10 }}>
              {tab === 'live' && (
                <Collapsible title="Live: что происходит сейчас" defaultOpen right={<span className="salesBadge is-neutral">UI</span>}>
                  {isLoading ? (
                    <>
                      <ShimmerRow />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={52} w2={18} />
                    </>
                  ) : (
                    <div className="salesRows">
                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Средний чек (AOV)</div>
                          <div className="salesRowSub">подсказка: апсейл на кассе</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">{moneyFromCent(tiles.aov, currency)}</div>
                          <div className="salesRowMeta">по периоду</div>
                        </div>
                      </div>

                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Маржа</div>
                          <div className="salesRowSub">profit / revenue</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">{fmtPct(tiles.margin)}</div>
                          <div className="salesRowMeta">контроль порога</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Collapsible>
              )}

              {tab === 'funnel' && (
                <Collapsible
                  title="Воронка продаж"
                  defaultOpen
                  right={<span className="salesBadge is-neutral">PRO</span>}
                >
                  {qFunnel.isLoading ? (
                    <>
                      <ShimmerRow />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={56} w2={14} />
                    </>
                  ) : (
                    <div className="funnelWrap">
                      <div className="funnelTop">
                        <div>
                          <div style={{ fontWeight: 950 }}>Конверсия</div>
                          <div className="sg-muted" style={{ marginTop: 4 }}>
                            {funnelStats.from} → {funnelStats.to} · <b>{fmtPct(funnelStats.conv)}</b>
                          </div>
                        </div>
                        <span className="salesBadge is-neutral">pipeline</span>
                      </div>

                      <div className="funnelKPIs">
                        <span className="funnelKPI">Stages: {funnel.length}</span>
                        {funnel?.[funnel.length - 1]?.value_cents ? (
                          <span className="funnelKPI">Paid: {moneyFromCent(funnel[funnel.length - 1].value_cents!, currency)}</span>
                        ) : (
                          <span className="funnelKPI">Paid: —</span>
                        )}
                      </div>

                      {/* Premium bars (Stripe-like) */}
                      <div className="funnelBars">
                        {(() => {
                          const max = Math.max(1, ...funnel.map(s => Number(s.count) || 0));
                          return funnel.map((s, i) => {
                            const w = Math.round(((Number(s.count) || 0) / max) * 100);
                            const prev = i > 0 ? funnel[i - 1].count : s.count;
                            const conv = prev > 0 ? (s.count / prev) * 100 : 0;

                            return (
                              <div key={s.key} className="fbar">
                                <div className="fbarLeft" style={{ flex: 1 }}>
                                  <div className="fbarTitle">{s.title} · {s.count} <span style={{ opacity: .65 }}>({fmtPct(conv)})</span></div>
                                  <div className="fbarTrack">
                                    <div className="fbarFill" style={{ width: `${w}%` }} />
                                  </div>
                                </div>
                                <div style={{ width: 140, height: 72 }}>
                                  {/* mini funnel visualization (recharts) */}
                                  <ResponsiveContainer width="100%" height="100%">
                                    <FunnelChart>
                                      <Tooltip />
                                      <Funnel
                                        data={[{ name: s.title, value: s.count }]}
                                        dataKey="value"
                                        isAnimationActive={false}
                                        fill="rgba(15,23,42,.20)"
                                        stroke="rgba(15,23,42,.10)"
                                      >
                                        <LabelList
                                          position="center"
                                          fill="rgba(15,23,42,.85)"
                                          stroke="none"
                                          dataKey="name"
                                        />
                                      </Funnel>
                                    </FunnelChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div className="sg-muted" style={{ marginTop: 10 }}>
                        DEV NOTE: реальные стадии можно сделать под твою модель:
                        <b> views → opens → add_to_cart → checkout → paid</b>
                        или для офлайна:
                        <b> scanned → cashier_confirm → paid</b>.
                      </div>
                    </div>
                  )}
                </Collapsible>
              )}

              {tab === 'customers' && (
                <Collapsible title="Клиенты: удержание и повторные" defaultOpen right={<span className="salesBadge is-neutral">UI</span>}>
                  <div className="salesRows">
                    <div className="salesRow">
                      <div className="salesRowLeft">
                        <div className="salesRowTitle">Повторные покупки</div>
                        <div className="salesRowSub">DEV NOTE: cohort/retention endpoint</div>
                      </div>
                      <div className="salesRowRight">
                        <div className="salesRowVal">DEV</div>
                        <div className="salesRowMeta">позже</div>
                      </div>
                    </div>
                  </div>
                </Collapsible>
              )}

              {tab === 'cashiers' && (
                <Collapsible title="Кассиры: эффективность" defaultOpen right={<span className="salesBadge is-neutral">UI</span>}>
                  <div className="salesRows">
                    <div className="salesRow">
                      <div className="salesRowLeft">
                        <div className="salesRowTitle">Выручка по кассирам</div>
                        <div className="salesRowSub">DEV NOTE: /sales/cashiers endpoint</div>
                      </div>
                      <div className="salesRowRight">
                        <div className="salesRowVal">DEV</div>
                        <div className="salesRowMeta">позже</div>
                      </div>
                    </div>
                  </div>
                </Collapsible>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="salesSticky">
          <Card className="salesCard is-hover" style={{ padding: 14, position: 'relative' }}>
            {(hasAlert || hasWarn) ? <div className="sgAlertBadge">!</div> : null}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Сводка PRO</div>
              <span className={'salesBadge ' + badgeLabel.cls}>{badgeLabel.text}</span>
            </div>

            <div style={{ marginTop: 10 }} className="salesRows">
              {isLoading ? (
                <>
                  <ShimmerRow />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={50} w2={18} />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={42} w2={22} />
                </>
              ) : (
                <>
                  <div className="salesRow">
                    <div className="salesRowLeft">
                      <div className="salesRowTitle">Выручка</div>
                      <div className="salesRowSub">sum(order_total)</div>
                    </div>
                    <div className="salesRowRight">
                      <div className="salesRowVal">{moneyFromCent(tiles.revenue, currency)}</div>
                      <div className="salesRowMeta">{tiles.orders} заказов</div>
                    </div>
                  </div>

                  <div className="salesRow">
                    <div className="salesRowLeft">
                      <div className="salesRowTitle">Расходы</div>
                      <div className="salesRowSub">COGS + Ops</div>
                    </div>
                    <div className="salesRowRight">
                      <div className="salesRowVal">{moneyFromCent(tiles.cogs + tiles.ops, currency)}</div>
                      <div className="salesRowMeta">COGS {fmtPct(tiles.cogsPct)}</div>
                    </div>
                  </div>

                  <div className="salesRow">
                    <div className="salesRowLeft">
                      <div className="salesRowTitle">Прибыль</div>
                      <div className="salesRowSub">revenue - costs</div>
                    </div>
                    <div className="salesRowRight">
                      <div className="salesRowVal">{moneyFromCent(tiles.profit, currency)}</div>
                      <div className="salesRowMeta">маржа {fmtPct(tiles.margin)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className="salesCard is-hover" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Топ покупателей</div>
              <span className="salesBadge is-neutral">по выручке</span>
            </div>

            <div style={{ marginTop: 10 }}>
              {qTopBuyers.isLoading ? (
                <>
                  <ShimmerRow />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={55} w2={16} />
                </>
              ) : (
                <div className="salesRows">
                  {topBuyers.map((r, idx) => (
                    <div key={idx} className="salesRow">
                      <div className="salesRowLeft">
                        <div className="salesRowTitle">{r.title}</div>
                        <div className="salesRowSub">{r.sub || '—'}</div>
                      </div>
                      <div className="salesRowRight">
                        <div className="salesRowVal">{moneyFromCent(r.value_cents, currency)}</div>
                        <div className="salesRowMeta">DEV</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="salesCard is-hover" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Топ товаров</div>
              <span className="salesBadge is-neutral">по выручке</span>
            </div>

            <div style={{ marginTop: 10 }}>
              {qTopProducts.isLoading ? (
                <>
                  <ShimmerRow />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={52} w2={18} />
                </>
              ) : (
                <div className="salesRows">
                  {topProducts.map((r, idx) => (
                    <div key={idx} className="salesRow">
                      <div className="salesRowLeft">
                        <div className="salesRowTitle">{r.title}</div>
                        <div className="salesRowSub">{r.sub || '—'}</div>
                      </div>
                      <div className="salesRowRight">
                        <div className="salesRowVal">{moneyFromCent(r.value_cents, currency)}</div>
                        <div className="salesRowMeta">DEV</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Compact funnel summary on the right (nice as “executive glance”) */}
          <Card className="salesCard is-hover" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Воронка (кратко)</div>
              <span className="salesBadge is-neutral">{fmtPct(funnelStats.conv)}</span>
            </div>

            <div className="sg-muted" style={{ marginTop: 8 }}>
              {funnelStats.from} → {funnelStats.to} · конверсия по воронке
            </div>

            <div style={{ marginTop: 10 }}>
              {qFunnel.isLoading ? (
                <>
                  <ShimmerRow />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={58} w2={14} />
                </>
              ) : (
                <div className="salesRows">
                  {funnel.slice(0, 4).map((s) => (
                    <div key={s.key} className="salesRow">
                      <div className="salesRowLeft">
                        <div className="salesRowTitle">{s.title}</div>
                        <div className="salesRowSub">count</div>
                      </div>
                      <div className="salesRowRight">
                        <div className="salesRowVal">{s.count}</div>
                        <div className="salesRowMeta">{s.value_cents ? moneyFromCent(s.value_cents, currency) : '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sg-muted" style={{ marginTop: 10 }}>
              DEV NOTE: это станет реально “дорого”, когда стадии будут из событий мини-аппа/кассы.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
