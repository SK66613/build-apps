// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
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

/**
 * SALES (Premium Apple/Stripe)
 *
 * Цель: UI как у Wheel, но дороже:
 * - “glass” карточки с правильным светом/глубиной
 * - shimmer строки в списках
 * - умные подсказки на hover
 * - alert badge (!) на карточках
 * - overlay loader в зоне графика (без blur всей страницы)
 * - кнопки слоёв графика (bar/line) как в Wheel
 * - collapsible секции с плавной анимацией
 *
 * DEV NOTE: Воркер потом:
 *  - GET /api/cabinet/apps/:appId/sales/timeseries?from&to
 *  - GET /api/cabinet/apps/:appId/sales/kpi?from&to
 *  - GET /api/cabinet/apps/:appId/sales/top?kind=buyers&metric=revenue&from&to
 *  - GET /api/cabinet/apps/:appId/sales/top?kind=products&metric=revenue&from&to
 *  - GET /api/cabinet/apps/:appId/sales/insights?from&to
 */

type SalesTimeseriesDay = {
  date: string; // YYYY-MM-DD
  orders: number;
  customers: number;

  revenue_cents: number;
  cogs_cents: number;      // себестоимость товаров (COGS)
  ops_cents: number;       // операционные расходы (фикс/переменные)
  profit_cents: number;    // revenue - cogs - ops

  // optional: for “Apple-like” overlays
  aov_cents?: number;      // average order value
};

type SalesKpi = {
  revenue_cents: number;
  profit_cents: number;
  cogs_cents: number;
  ops_cents: number;

  orders: number;
  customers: number;

  aov_cents: number;
  profit_margin_pct: number; // 0..100

  alerts?: Array<{ code: string; title: string; severity: 'warn' | 'bad' }>;
};

type TopRow = {
  title: string;
  value_cents: number;
  sub?: string;
};

function qs(obj: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function toInt(v: any, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

function fmtDDMM(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function moneyFromCent(cent: number | null | undefined, currency = 'RUB') {
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';
  const c = String(currency || 'RUB').toUpperCase();

  const sym =
    c === 'RUB' ? '₽' :
    c === 'USD' ? '$' :
    c === 'EUR' ? '€' : c;

  if (c === 'USD' || c === 'EUR') return `${sym}${(v / 100).toFixed(2)}`;
  if (c === 'RUB') return `${(v / 100).toFixed(2)} ₽`;
  return `${(v / 100).toFixed(2)} ${sym}`;
}

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${Number(x).toFixed(1)}%`;
}

/* Icons for chart buttons (minimal, premium) */
function IcoRevenue() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 11V5m0 6h10M13 11V4" stroke="currentColor" strokeWidth="2" opacity=".85" strokeLinecap="round"/>
      <path d="M5 9l2-2 2 2 3-4" stroke="currentColor" strokeWidth="2" opacity=".9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoCost() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".9"/>
      <path d="M4 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
      <path d="M6 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".35"/>
    </svg>
  );
}
function IcoProfit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      <path d="M5 12V8m3 4V5m3 7V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".9"/>
    </svg>
  );
}
function IcoCumulative() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      <path d="M4 10l2-3 2 2 3-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
    </svg>
  );
}

function ShimmerRow({ w1 = 46, w2 = 24 }: { w1?: number; w2?: number }) {
  return (
    <div className="sgShimmerRow" aria-hidden="true">
      <span className="sgShimmerBar" style={{ width: `${w1}%` }} />
      <span className="sgShimmerBar" style={{ width: `${w2}%` }} />
    </div>
  );
}

function HoverTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="sgTip" data-tip={tip}>
      {children}
    </span>
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

// ---------- Mock data (until worker) ----------
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

    const revenue = Math.round((orders * (900 + Math.random() * 700)) * 100); // cents
    const cogs = Math.round(revenue * (0.35 + Math.random() * 0.08));
    const ops = Math.round(revenue * (0.12 + Math.random() * 0.06));
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

function mockInsights(): Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string }> {
  return [
    {
      tone: 'good',
      title: 'Выручка держится стабильно',
      body: 'Если цель — рост, усилить оффер в часы пик и поднять конверсию повторных покупок.',
    },
    {
      tone: 'warn',
      title: 'Маржа чувствительна к COGS',
      body: 'Проверь топ-товары по выручке: иногда 1 позиция “съедает” прибыль из-за себестоимости.',
    },
    {
      tone: 'warn',
      title: 'Проседание по повторным',
      body: 'Добавь триггеры: бонус за 2-й визит, “кэшбэк” монетами, пуш в TG на следующий день.',
    },
    {
      tone: 'bad',
      title: 'Риск отрицательной прибыли в отдельные дни',
      body: 'Если видишь минус — обычно причина в высоких издержках/акциях. Нужен контроль threshold.',
    },
  ];
}

// -----------------------------------------------

export default function Sales() {
  const { appId, range } = useAppState() as any;

  // Chart layers
  const [showRevenue, setShowRevenue] = React.useState(true);
  const [showCosts, setShowCosts] = React.useState(false);
  const [showProfitBars, setShowProfitBars] = React.useState(true);
  const [showCumProfit, setShowCumProfit] = React.useState(false);

  // Under-chart tabs
  const [tab, setTab] = React.useState<'live' | 'customers' | 'cashiers'>('live');

  // UI controls (placeholder until worker)
  const [currency, setCurrency] = React.useState<'RUB' | 'USD' | 'EUR'>('RUB');
  const [costThresholdDraft, setCostThresholdDraft] = React.useState<string>('35'); // % cogs threshold (for alerts)
  const costThresholdPct = clampN(Number(String(costThresholdDraft).replace(',', '.')), 0, 95);

  // DEV NOTE: when worker returns real KPI and alerts, replace mock
  const qTs = useQuery({
    enabled: !!appId,
    queryKey: ['sales_ts', appId, range?.from, range?.to],
    queryFn: async () => {
      // DEV NOTE: replace with:
      // return apiFetch<{ ok:true; days: SalesTimeseriesDay[] }>(`/api/cabinet/apps/${appId}/sales/timeseries?${qs(range)}`);
      return { ok: true, days: mockTimeseries(range.from, range.to) };
    },
    staleTime: 10_000,
  });

  const qKpi = useQuery({
    enabled: !!appId,
    queryKey: ['sales_kpi', appId, range?.from, range?.to],
    queryFn: async () => {
      // DEV NOTE: replace with:
      // return apiFetch<{ ok:true; kpi: SalesKpi }>(`/api/cabinet/apps/${appId}/sales/kpi?${qs(range)}`);
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
      if (profit < 0) {
        alerts.push({ code: 'sales.profit.negative', title: 'Период в минусе', severity: 'bad' });
      }
      if (cogsPct > costThresholdPct) {
        alerts.push({ code: 'sales.cogs.high', title: `Себестоимость > ${costThresholdPct}%`, severity: 'warn' });
      }

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
    queryFn: async () => {
      // DEV NOTE: replace with:
      // return apiFetch<{ ok:true; items: TopRow[] }>(`/api/cabinet/apps/${appId}/sales/top?kind=buyers&metric=revenue&${qs(range)}`);
      return { ok: true, items: mockTop('buyers') };
    },
    staleTime: 10_000,
  });

  const qTopProducts = useQuery({
    enabled: !!appId,
    queryKey: ['sales_top_products', appId, range?.from, range?.to],
    queryFn: async () => {
      // DEV NOTE: replace with:
      // return apiFetch<{ ok:true; items: TopRow[] }>(`/api/cabinet/apps/${appId}/sales/top?kind=products&metric=revenue&${qs(range)}`);
      return { ok: true, items: mockTop('products') };
    },
    staleTime: 10_000,
  });

  const qInsights = useQuery({
    enabled: !!appId,
    queryKey: ['sales_insights', appId, range?.from, range?.to, costThresholdPct],
    queryFn: async () => {
      // DEV NOTE: replace with worker insights endpoint
      return { ok: true, items: mockInsights() };
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

  // Build chart series (with cumulative optional)
  const chartSeries = React.useMemo(() => {
    let cum = 0;

    return (days || []).map((d) => {
      const revenue = Number(d.revenue_cents) || 0;
      const costs = (Number(d.cogs_cents) || 0) + (Number(d.ops_cents) || 0);
      const profit = Number(d.profit_cents) || (revenue - costs);
      cum += profit;

      return {
        date: d.date,
        revenue,
        costs,
        profit,
        cum_profit: cum,
        orders: Number(d.orders) || 0,
        customers: Number(d.customers) || 0,
      };
    });
  }, [days]);

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

    const profitTone =
      revenue <= 0 ? 'neutral' :
      profit > 0 ? 'good' :
      profit === 0 ? 'warn' : 'bad';

    const marginTone =
      revenue <= 0 ? 'neutral' :
      margin >= 25 ? 'good' :
      margin >= 10 ? 'warn' : 'bad';

    const cogsTone =
      revenue <= 0 ? 'neutral' :
      cogsPct <= Math.max(5, costThresholdPct - 6) ? 'good' :
      cogsPct <= costThresholdPct ? 'warn' : 'bad';

    return {
      revenue, profit, cogs, ops,
      orders, customers, aov,
      margin, cogsPct,
      profitTone, marginTone, cogsTone,
    };
  }, [kpi, costThresholdPct]);

  const topBuyers = qTopBuyers.data?.items || [];
  const topProducts = qTopProducts.data?.items || [];
  const insights = qInsights.data?.items || [];

  function toneCls(t: string) {
    if (t === 'good') return 'is-good';
    if (t === 'warn') return 'is-warn';
    if (t === 'bad') return 'is-bad';
    return 'is-neutral';
  }

  const badgeLabel = React.useMemo(() => {
    if (hasAlert) return { text: 'АЛЕРТ', cls: 'is-bad' };
    if (hasWarn) return { text: 'РИСК', cls: 'is-warn' };
    return { text: 'ОК', cls: 'is-good' };
  }, [hasAlert, hasWarn]);

  return (
    <div className="sg-page salesPage">

      <style>{`
/* =========================================
   SALES — Apple/Stripe Premium Layer
   (self-contained)
   ========================================= */

:root{
  --sl-r-xl: 20px;
  --sl-r-lg: 18px;
  --sl-r-md: 14px;
  --sl-r-sm: 12px;

  --sl-bd: rgba(15,23,42,.10);
  --sl-bd2: rgba(15,23,42,.08);

  --sl-bg: rgba(255,255,255,.62);
  --sl-bg2: rgba(255,255,255,.78);
  --sl-bg3: rgba(15,23,42,.03);

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

/* page background subtle premium depth */
.salesPage{
  position:relative;
}
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

/* layout similar to Wheel */
.salesGrid{
  display:grid;
  grid-template-columns: 1fr 380px;
  gap:12px;
}
@media (max-width: 1100px){
  .salesGrid{ grid-template-columns: 1fr; }
}

/* Premium card base */
.salesCard{
  border:1px solid var(--sl-bd2) !important;
  border-radius: var(--sl-r-xl) !important;
  background: var(--sl-bg) !important;
  box-shadow: var(--sl-sh1), var(--sl-in1) !important;
  overflow:hidden;
}

/* premium hover lift */
.salesCard.is-hover{
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, filter .16s ease;
}
.salesCard.is-hover:hover{
  transform: translateY(-1px);
  box-shadow: var(--sl-sh2), var(--sl-in1) !important;
  border-color: rgba(15,23,42,.14) !important;
  filter: saturate(1.02);
}

/* Alert badge (!) */
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

/* Head */
.salesHead{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  margin-bottom:12px;
}
.salesSub{
  opacity:.78;
}

/* Chart */
.salesChartWrap{
  position:relative;
  width:100%;
  height:340px;
}
.salesChart{
  height:100%;
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

/* Chart buttons like Wheel */
.salesChartBtns{
  display:flex;
  gap:8px;
  align-items:center;
  flex-wrap:wrap;
}
.salesChartBtn{
  height:32px;
  width:34px;
  border-radius:12px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
  box-shadow: var(--sl-in1);
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease, opacity .12s ease;
  opacity:.92;
}
.salesChartBtn:hover{ opacity:1; transform: translateY(-1px); }
.salesChartBtn.is-active{
  box-shadow: 0 14px 26px rgba(15,23,42,.08), var(--sl-in1);
  border-color: rgba(15,23,42,.14);
  opacity:1;
}
.salesChartBtn--text{
  width:auto;
  padding:0 12px;
  font-weight:900;
  font-size:12px;
}

/* under tabs segmented */
.salesTabs{
  display:inline-flex;
  gap:8px;
  padding:4px;
  border-radius:14px;
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
  background: rgba(15,23,42,.04);
  border-color: rgba(15,23,42,.12);
  box-shadow: 0 12px 22px rgba(15,23,42,.06), var(--sl-in1);
  opacity:1;
}

/* KPI tiles like Wheel summary tiles but more premium */
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
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
}
.salesTile:hover{
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(15,23,42,.08), var(--sl-in1);
  border-color: rgba(15,23,42,.12);
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

/* badges */
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

/* Tip tooltip hover-only */
.sgTip{
  position:relative;
  display:inline-flex;
}
.sgTip::after{
  content: attr(data-tip);
  position:absolute;
  left:50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%);
  padding:8px 10px;
  border-radius: 14px;
  border:1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.98);
  box-shadow: 0 18px 40px rgba(15,23,42,.14);
  font-weight:800;
  font-size:12px;
  white-space:nowrap;
  opacity:0;
  pointer-events:none;
  transition: opacity .12s ease;
  z-index:9999;
}
.sgTip:hover::after{ opacity:1; }
.sgTip:focus-within::after{ opacity:0; } /* no sticky */

/* shimmer rows */
.sgShimmerRow{
  display:flex;
  gap:12px;
  align-items:center;
}
.sgShimmerBar{
  height:12px;
  border-radius:999px;
  background:
    linear-gradient(90deg,
      rgba(15,23,42,.06) 0%,
      rgba(15,23,42,.12) 40%,
      rgba(15,23,42,.06) 80%);
  background-size: 200% 100%;
  animation: sgShimmer 1.6s linear infinite;
}
@keyframes sgShimmer{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

/* rows list (Stripe-ish) */
.salesRows{
  display:flex;
  flex-direction:column;
  gap:8px;
}
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
  transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
}
.salesRow:hover{
  transform: translateY(-1px);
  border-color: rgba(15,23,42,.12);
  box-shadow: 0 16px 30px rgba(15,23,42,.08), var(--sl-in1);
}
.salesRowLeft{
  display:flex;
  flex-direction:column;
  gap:4px;
  min-width:0;
}
.salesRowTitle{
  font-weight:900;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.salesRowSub{
  font-size:12px;
  opacity:.78;
}
.salesRowRight{
  text-align:right;
  display:flex;
  flex-direction:column;
  gap:2px;
  flex:0 0 auto;
}
.salesRowVal{ font-weight:900; }
.salesRowMeta{ font-size:12px; opacity:.74; }

/* collapsible */
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
.sgCollTitle{
  font-weight:900;
}
.sgCollRight{
  display:flex;
  align-items:center;
  gap:10px;
}
.sgChevron{
  width:10px; height:10px;
  border-right:2px solid rgba(15,23,42,.55);
  border-bottom:2px solid rgba(15,23,42,.55);
  transform: rotate(45deg);
  transition: transform .16s ease;
  opacity:.7;
}
.sgChevron.is-open{
  transform: rotate(225deg);
}
.sgCollBody{
  display:grid;
  transition: grid-template-rows .18s ease;
}
.sgCollBodyInner{
  overflow:hidden;
  padding:0 12px 12px 12px;
}

/* right sidebar sticky */
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

/* insight cards */
.insGrid{
  display:grid;
  grid-template-columns: 1fr;
  gap:10px;
}
.insCard{
  border-radius: 16px;
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.70);
  box-shadow: var(--sl-in1);
  padding:10px 12px;
}
.insCard.is-good{ background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.16); }
.insCard.is-warn{ background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.18); }
.insCard.is-bad{  background: rgba(239,68,68,.07); border-color: rgba(239,68,68,.18); }
.insTitle{ font-weight:900; margin-bottom:6px; }
.insBody{ font-size:13px; opacity:.86; line-height:1.3; }

/* inputs unify */
.sg-input, input, select{
  border-radius: 12px !important;
}
      `}</style>

      {/* HEADER */}
      <div className="salesHead">
        <div>
          <h1 className="sg-h1">Продажи</h1>
          <div className="salesSub">
            Факт по продажам за период. UI готов — воркер подключим позже.
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <HoverTip tip="DEV NOTE: валюта будет из app_settings / sales_settings">
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
          </HoverTip>

          <HoverTip tip="DEV NOTE: порог для алертов (cogs% от выручки)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sg-muted" style={{ fontWeight: 900 }}>COGS threshold</span>
              <Input
                value={costThresholdDraft}
                onChange={(e: any) => setCostThresholdDraft(e.target.value)}
                style={{ width: 80 }}
              />
              <span className="sg-muted" style={{ fontWeight: 900 }}>%</span>
            </div>
          </HoverTip>
        </div>
      </div>

      <div className="salesGrid">
        {/* LEFT */}
        <div>
          <Card className="salesCard is-hover" style={{ padding: 14, position: 'relative' }}>
            {(hasAlert || hasWarn) ? (
              <div className="sgAlertBadge" title={alerts.map(a => a.title).join('\n')}>
                !
              </div>
            ) : null}

            {/* Chart head */}
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

              <div className="salesChartBtns">
                <button
                  type="button"
                  className={'salesChartBtn ' + (showRevenue ? 'is-active' : '')}
                  onClick={() => setShowRevenue(v => !v)}
                  title="Выручка (линия)"
                  aria-label="Выручка"
                >
                  <IcoRevenue />
                </button>

                <button
                  type="button"
                  className={'salesChartBtn ' + (showCosts ? 'is-active' : '')}
                  onClick={() => setShowCosts(v => !v)}
                  title="Расходы (линия): COGS + Ops"
                  aria-label="Расходы"
                >
                  <IcoCost />
                </button>

                <button
                  type="button"
                  className={'salesChartBtn ' + (showProfitBars ? 'is-active' : '')}
                  onClick={() => setShowProfitBars(v => !v)}
                  title="Прибыль/день (цилиндры)"
                  aria-label="Прибыль"
                >
                  <IcoProfit />
                </button>

                <button
                  type="button"
                  className={'salesChartBtn ' + (showCumProfit ? 'is-active' : '')}
                  onClick={() => setShowCumProfit(v => !v)}
                  title="Кумулятивная прибыль (линия)"
                  aria-label="Кумулятивная прибыль"
                >
                  <IcoCumulative />
                </button>
              </div>
            </div>

            {/* CHART */}
            <div className="salesChartWrap" style={{ marginTop: 12 }}>
              <div className="salesChart">
                {!isError && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartSeries}
                      margin={{ top: 8, right: 18, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                        tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                      />

                      {/* Day scale */}
                      <YAxis
                        yAxisId="day"
                        tick={{ fontSize: 12 }}
                        width={54}
                        tickFormatter={(v: any) => {
                          const n = Number(v);
                          if (!Number.isFinite(n)) return '';
                          // show in “thousands”
                          return String(Math.round(n / 100_00)); // 100.00 RUB steps-ish
                        }}
                      />

                      {/* Cum scale (right) */}
                      <YAxis
                        yAxisId="cum"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        width={60}
                        tickFormatter={(v: any) => {
                          const n = Number(v);
                          if (!Number.isFinite(n)) return '';
                          return String(Math.round(n / 100_00));
                        }}
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
                          fill="rgba(15,23,42,.18)"
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
                          stroke="rgba(15,23,42,.92)"
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
                          stroke="rgba(15,23,42,.45)"
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
                          stroke="rgba(15,23,42,.65)"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

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
                  <div className="salesTileLbl">
                    Выручка
                    <span style={{ marginLeft: 8 }}>
                      <HoverTip tip="DEV NOTE: формула = sum(order_total)">
                        <span className={'salesBadge is-neutral'}>?</span>
                      </HoverTip>
                    </span>
                  </div>
                  <div className="salesTileVal">{moneyFromCent(tiles.revenue, currency)}</div>
                  <div className="salesTileSub">
                    Заказы: <b>{tiles.orders}</b> · Клиенты: <b>{tiles.customers}</b>
                  </div>
                </div>

                <div className="salesTile">
                  <div className="salesTileLbl">
                    Прибыль
                    <span style={{ marginLeft: 8 }}>
                      <span className={'salesBadge ' + toneCls(tiles.profitTone)}>
                        {tiles.profitTone === 'good' ? 'ОК' : tiles.profitTone === 'warn' ? 'РИСК' : tiles.profitTone === 'bad' ? 'АЛЕРТ' : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="salesTileVal">{moneyFromCent(tiles.profit, currency)}</div>
                  <div className="salesTileSub">
                    Маржа: <b>{fmtPct(tiles.margin)}</b> · AOV: <b>{moneyFromCent(tiles.aov, currency)}</b>
                  </div>
                </div>

                <div className="salesTile">
                  <div className="salesTileLbl">
                    Себестоимость (COGS)
                    <span style={{ marginLeft: 8 }}>
                      <span className={'salesBadge ' + toneCls(tiles.cogsTone)}>
                        {tiles.cogsTone === 'good' ? 'ОК' : tiles.cogsTone === 'warn' ? 'РИСК' : tiles.cogsTone === 'bad' ? 'АЛЕРТ' : '—'}
                      </span>
                    </span>
                  </div>
                  <div className="salesTileVal">{moneyFromCent(tiles.cogs, currency)}</div>
                  <div className="salesTileSub">
                    Доля COGS: <b>{fmtPct(tiles.cogsPct)}</b> · Ops: <b>{moneyFromCent(tiles.ops, currency)}</b>
                  </div>
                </div>
              </div>
            </div>

            {/* Under-chart segmented tabs */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="salesTabs">
                <button
                  type="button"
                  className={'salesTab ' + (tab === 'live' ? 'is-active' : '')}
                  onClick={() => setTab('live')}
                >
                  Live
                </button>
                <button
                  type="button"
                  className={'salesTab ' + (tab === 'customers' ? 'is-active' : '')}
                  onClick={() => setTab('customers')}
                >
                  Клиенты
                </button>
                <button
                  type="button"
                  className={'salesTab ' + (tab === 'cashiers' ? 'is-active' : '')}
                  onClick={() => setTab('cashiers')}
                >
                  Кассиры
                </button>
              </div>

              <div className="sg-muted">
                DEV NOTE: табы подключим к /sales/live /sales/customers /sales/cashiers
              </div>
            </div>

            {/* Under panel content */}
            <div style={{ marginTop: 10 }}>
              {tab === 'live' && (
                <Collapsible
                  title="Live: что происходит сейчас"
                  defaultOpen
                  right={<span className="salesBadge is-neutral">UI готов</span>}
                >
                  {isLoading ? (
                    <>
                      <ShimmerRow />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={52} w2={18} />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={40} w2={26} />
                    </>
                  ) : (
                    <div className="salesRows">
                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Пик по выручке сегодня</div>
                          <div className="salesRowSub">подсказка: усилить оффер в этот интервал</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">DEV</div>
                          <div className="salesRowMeta">endpoint позже</div>
                        </div>
                      </div>

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
                          <div className="salesRowSub">подсказка: держать выше целевого порога</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">{fmtPct(tiles.margin)}</div>
                          <div className="salesRowMeta">profit/revenue</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Collapsible>
              )}

              {tab === 'customers' && (
                <Collapsible
                  title="Клиенты: удержание и повторные"
                  defaultOpen
                  right={<span className="salesBadge is-neutral">UI готов</span>}
                >
                  {isLoading ? (
                    <>
                      <ShimmerRow />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={48} w2={20} />
                    </>
                  ) : (
                    <div className="salesRows">
                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Повторные покупки</div>
                          <div className="salesRowSub">DEV NOTE: нужен cohort/retention endpoint</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">DEV</div>
                          <div className="salesRowMeta">позже</div>
                        </div>
                      </div>

                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Сегменты</div>
                          <div className="salesRowSub">VIP / новые / спящие</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">DEV</div>
                          <div className="salesRowMeta">позже</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Collapsible>
              )}

              {tab === 'cashiers' && (
                <Collapsible
                  title="Кассиры: эффективность"
                  defaultOpen
                  right={<span className="salesBadge is-neutral">UI готов</span>}
                >
                  {isLoading ? (
                    <>
                      <ShimmerRow />
                      <div style={{ height: 8 }} />
                      <ShimmerRow w1={44} w2={22} />
                    </>
                  ) : (
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

                      <div className="salesRow">
                        <div className="salesRowLeft">
                          <div className="salesRowTitle">Апсейл (средний чек)</div>
                          <div className="salesRowSub">подсказка: скрипты апсейла</div>
                        </div>
                        <div className="salesRowRight">
                          <div className="salesRowVal">{moneyFromCent(tiles.aov, currency)}</div>
                          <div className="salesRowMeta">по периоду</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Collapsible>
              )}
            </div>

            {/* Developer note */}
            <div className="sg-muted" style={{ marginTop: 12 }}>
              DEV NOTE: когда подключим воркер — KPI/alerts должны приходить сервером (чтобы UI не “угадывал”).
              Также можно отдавать breakdown: revenue_by_channel, cogs_by_product, ops_fixed/variable.
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="salesSticky">
          {/* Summary PRO */}
          <Card className="salesCard is-hover" style={{ padding: 14, position: 'relative' }}>
            {(hasAlert || hasWarn) ? (
              <div className="sgAlertBadge" title={alerts.map(a => a.title).join('\n')}>!</div>
            ) : null}

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
                      <div className="salesRowMeta">cogs {fmtPct(tiles.cogsPct)} · ops</div>
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

                  {alerts.length ? (
                    <Collapsible
                      title="Алерты и риски"
                      defaultOpen
                      right={<span className={'salesBadge ' + (hasAlert ? 'is-bad' : 'is-warn')}>{alerts.length}</span>}
                    >
                      <div className="salesRows">
                        {alerts.map((a) => (
                          <div key={a.code} className="salesRow">
                            <div className="salesRowLeft">
                              <div className="salesRowTitle">{a.title}</div>
                              <div className="salesRowSub">код: {a.code}</div>
                            </div>
                            <div className="salesRowRight">
                              <span className={'salesBadge ' + (a.severity === 'bad' ? 'is-bad' : 'is-warn')}>
                                {a.severity === 'bad' ? 'АЛЕРТ' : 'РИСК'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Collapsible>
                  ) : (
                    <div className="sg-muted" style={{ marginTop: 10 }}>
                      Пока алертов нет. (DEV NOTE: воркер будет отдавать alerts[])
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Top buyers */}
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
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={48} w2={18} />
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
                        <div className="salesRowMeta">DEV NOTE: uid позже</div>
                      </div>
                    </div>
                  ))}
                  {!topBuyers.length && <div className="sg-muted">Пока пусто</div>}
                </div>
              )}
            </div>
          </Card>

          {/* Top products */}
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
                        <div className="salesRowMeta">DEV NOTE: sku позже</div>
                      </div>
                    </div>
                  ))}
                  {!topProducts.length && <div className="sg-muted">Пока пусто</div>}
                </div>
              )}
            </div>
          </Card>

          {/* Insights */}
          <Card className="salesCard is-hover" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Insights</div>
              <span className="salesBadge is-neutral">умные подсказки</span>
            </div>

            <div style={{ marginTop: 10 }}>
              {qInsights.isLoading ? (
                <>
                  <ShimmerRow />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={58} w2={14} />
                  <div style={{ height: 8 }} />
                  <ShimmerRow w1={44} w2={22} />
                </>
              ) : (
                <div className="insGrid">
                  {insights.slice(0, 4).map((x, i) => (
                    <div key={i} className={'insCard ' + (x.tone ? `is-${x.tone}` : '')}>
                      <div className="insTitle">{x.title}</div>
                      <div className="insBody">{x.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sg-muted" style={{ marginTop: 12 }}>
              DEV NOTE: позже воркер будет отдавать insights на основе
              динамики выручки, маржи, COGS, повторных покупок и сегментов.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
