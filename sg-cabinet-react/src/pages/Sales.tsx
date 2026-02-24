// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

/**
 * SALES — “one-to-one” по ощущению с Wheel:
 * - мягкие карточки/бордеры/hover как в “Складе”
 * - график: Area + Line(штрих) + Bar(цилиндры) + такие же кнопки накладкой
 * - без “лишних” осей/кумулятивов (только дневные значения)
 * - цвета оставляем “как у тебя в оригинале” (var(--accent), var(--accent2))
 *
 * DEV: сейчас данные mock, потом просто заменить queryFn на реальные роуты воркера.
 */

type SalesRange = { from: string; to: string };

type SalesSettings = {
  coin_value_cents?: number;
  currency?: string; // RUB|USD|EUR
  cashback_pct?: number;
};

type SalesKPI = {
  revenue_cents: number;
  orders: number;
  buyers: number;
  repeat_rate: number; // 0..1
  cashback_issued_coins: number;
  redeem_confirmed_coins: number;

  pending_confirms?: number;
  cancel_rate?: number; // 0..1
};

type SalesDay = {
  date: string; // YYYY-MM-DD
  revenue_cents: number;
  orders: number;
  buyers: number;
  cashback_coins: number;
  redeem_coins: number;
  net_cents: number; // redeem(₽) - cashback(₽)
};

type SalesFunnel = {
  scanned: number;
  recorded: number;
  cashback_confirmed: number;
  redeem_confirmed: number;
  pin_issued: number;
  pin_used: number;
  median_confirm_minutes?: number;
};

type CashierRow = {
  cashier_label: string;
  orders: number;
  revenue_cents: number;
  confirm_rate: number; // 0..1
  cancel_rate: number; // 0..1
  median_confirm_minutes: number;
  alerts?: string[];
};

type CustomerRow = {
  customer_label: string;
  orders: number;
  revenue_cents: number;
  ltv_cents: number;
  last_seen: string;
  segment: 'new' | 'repeat' | 'saver' | 'spender';
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

function isoAddDays(iso: string, deltaDays: number) {
  try {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (_) {
    return iso;
  }
}

function daysBetweenISO(fromISO: string, toISO: string) {
  try {
    const a = new Date(fromISO + 'T00:00:00Z').getTime();
    const b = new Date(toISO + 'T00:00:00Z').getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    const diff = Math.abs(b - a);
    const days = Math.floor(diff / (24 * 3600 * 1000)) + 1;
    return Math.max(1, days);
  } catch (_) {
    return 1;
  }
}

function listDaysISO(fromISO: string, toISO: string) {
  const out: string[] = [];
  if (!fromISO || !toISO) return out;
  let cur = fromISO;
  for (let i = 0; i < 400; i++) {
    out.push(cur);
    if (cur === toISO) break;
    cur = isoAddDays(cur, 1);
  }
  return out;
}

function fmtDDMM(iso: string) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

function currencyLabel(cur: string) {
  const c = String(cur || '').toUpperCase();
  if (c === 'RUB') return '₽';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  return c || 'RUB';
}

function moneyFromCent(cent: number | null | undefined, currency = 'RUB') {
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';
  const c = String(currency || 'RUB').toUpperCase();
  const sym = currencyLabel(c);
  if (c === 'RUB') return `${(v / 100).toFixed(2)} ₽`;
  if (c === 'USD') return `${sym}${(v / 100).toFixed(2)}`;
  if (c === 'EUR') return `${sym}${(v / 100).toFixed(2)}`;
  return `${(v / 100).toFixed(2)} ${sym}`;
}

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function niceMoneyTick(vCents: number) {
  const v = Number(vCents);
  if (!Number.isFinite(v)) return '';
  const x = Math.round(v / 100); // rub
  const ax = Math.abs(x);
  if (ax >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (ax >= 10_000) return `${(x / 1000).toFixed(0)}k`;
  return String(x);
}

/* ===== Premium UI helpers ===== */

function AlertDot({ title }: { title: string }) {
  return (
    <div className="sgAlertDot" title={title} aria-label={title}>
      <span className="sgAlertDot__bang">!</span>
    </div>
  );
}

function Tip({
  text,
  side = 'top',
  dev,
}: {
  text: string;
  side?: 'top' | 'bottom';
  dev?: boolean;
}) {
  return (
    <span
      className={'sgTip ' + (dev ? 'is-dev' : '') + ' is-' + side}
      data-tip={text}
      aria-hidden="true"
    />
  );
}

function ShimmerLine({ w }: { w?: number }) {
  const width = Math.max(18, Math.min(100, Number.isFinite(Number(w)) ? Number(w) : 72));
  return (
    <div className="sgShimmerLine" style={{ width: `${width}%` }}>
      <div className="sgShimmerLine__shine" />
    </div>
  );
}

function IconBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={'sgIconBtn ' + (active ? 'is-active' : '')}
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
    >
      {children}
    </button>
  );
}

/* ===== Mock data (fallback) ===== */

function mkMock(range: SalesRange, settings: SalesSettings) {
  const dates = listDaysISO(range.from, range.to);
  const coinCents = Math.max(1, toInt(settings.coin_value_cents ?? 100, 100));
  let buyersBase = 40;

  const days: SalesDay[] = dates.map((d, i) => {
    const wave = Math.sin(i / 3.2) * 0.25 + 0.85;
    const orders = Math.max(8, Math.round((18 + (i % 5) * 3) * wave));
    buyersBase = Math.max(18, buyersBase + (i % 2 === 0 ? 1 : -1));
    const buyers = Math.max(10, Math.round(buyersBase * wave));
    const avg = 52000 + Math.round(14000 * Math.sin(i / 2.8)); // cents
    const revenue = Math.max(0, orders * avg);
    const cashbackCoins = Math.round((revenue / 100) * 0.06);
    const redeemCoins = Math.round((revenue / 100) * 0.045);
    const net = Math.round(redeemCoins * coinCents - cashbackCoins * coinCents);
    return {
      date: d,
      revenue_cents: revenue,
      orders,
      buyers,
      cashback_coins: cashbackCoins,
      redeem_coins: redeemCoins,
      net_cents: net,
    };
  });

  const kpi: SalesKPI = {
    revenue_cents: days.reduce((s, x) => s + x.revenue_cents, 0),
    orders: days.reduce((s, x) => s + x.orders, 0),
    buyers: Math.max(1, Math.round(days.reduce((s, x) => s + x.buyers, 0) / Math.max(1, days.length))),
    repeat_rate: 0.36 + Math.sin(days.length / 4) * 0.05,
    cashback_issued_coins: days.reduce((s, x) => s + x.cashback_coins, 0),
    redeem_confirmed_coins: days.reduce((s, x) => s + x.redeem_coins, 0),
    pending_confirms: Math.round(3 + (days.length % 4)),
    cancel_rate: 0.06 + Math.sin(days.length / 3) * 0.01,
  };

  const funnel: SalesFunnel = {
    scanned: Math.round(kpi.orders * 1.35),
    recorded: kpi.orders,
    cashback_confirmed: Math.round(kpi.orders * 0.92),
    redeem_confirmed: Math.round(kpi.orders * 0.58),
    pin_issued: Math.round(kpi.orders * 0.48),
    pin_used: Math.round(kpi.orders * 0.32),
    median_confirm_minutes: 3.6,
  };

  const cashiers: CashierRow[] = [
    {
      cashier_label: 'Кассир #1',
      orders: Math.round(kpi.orders * 0.46),
      revenue_cents: Math.round(kpi.revenue_cents * 0.49),
      confirm_rate: 0.93,
      cancel_rate: 0.05,
      median_confirm_minutes: 2.4,
    },
    {
      cashier_label: 'Кассир #2',
      orders: Math.round(kpi.orders * 0.33),
      revenue_cents: Math.round(kpi.revenue_cents * 0.31),
      confirm_rate: 0.88,
      cancel_rate: 0.09,
      median_confirm_minutes: 4.2,
      alerts: ['Высокие отмены'],
    },
    {
      cashier_label: 'Кассир #3',
      orders: Math.round(kpi.orders * 0.21),
      revenue_cents: Math.round(kpi.revenue_cents * 0.20),
      confirm_rate: 0.90,
      cancel_rate: 0.06,
      median_confirm_minutes: 3.1,
    },
  ];

  const customers: CustomerRow[] = [
    { customer_label: 'Покупатель A', orders: 7, revenue_cents: 410000, ltv_cents: 690000, last_seen: dates[dates.length - 1], segment: 'repeat' },
    { customer_label: 'Покупатель B', orders: 1, revenue_cents: 58000, ltv_cents: 58000, last_seen: dates[Math.max(0, dates.length - 2)], segment: 'new' },
    { customer_label: 'Покупатель C', orders: 5, revenue_cents: 260000, ltv_cents: 510000, last_seen: dates[Math.max(0, dates.length - 3)], segment: 'spender' },
    { customer_label: 'Покупатель D', orders: 4, revenue_cents: 210000, ltv_cents: 420000, last_seen: dates[Math.max(0, dates.length - 6)], segment: 'saver' },
  ];

  return { kpi, days, funnel, cashiers, customers, settings };
}

/* ===== Collapsible ===== */

function Collapsible({
  title,
  sub,
  right,
  open,
  onToggle,
  children,
  alert,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  alert?: { on: boolean; title: string };
}) {
  return (
    <div className={'sgColl ' + (open ? 'is-open' : 'is-closed')}>
      <button type="button" className="sgColl__head" onClick={onToggle}>
        <div className="sgColl__left">
          <div className="sgColl__title">
            {title}
            <span className="sgColl__chev" aria-hidden="true" />
          </div>
          {sub ? <div className="sgColl__sub">{sub}</div> : null}
        </div>
        <div className="sgColl__right">
          {right}
          {alert?.on ? <AlertDot title={alert.title} /> : null}
        </div>
      </button>
      <div className="sgColl__body">{children}</div>
    </div>
  );
}

/* ===== Page ===== */

export default function Sales() {
  const { appId, range, setRange }: any = useAppState();

  const [tab, setTab] = React.useState<'summary' | 'funnel' | 'cashiers' | 'customers' | 'live'>('summary');

  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  const [openKpi, setOpenKpi] = React.useState(true);
  const [openInsights, setOpenInsights] = React.useState(true);
  const [openTop, setOpenTop] = React.useState(true);

  // как в wheel: confirmed/issued
  const [basis, setBasis] = React.useState<'confirmed' | 'issued'>('confirmed');

  // overlay кнопки “как в колесе” (3 штуки)
  const [showBars, setShowBars] = React.useState(true);  // “цилиндры”
  const [showNet, setShowNet] = React.useState(true);    // “П” (profit/net)
  const [showArea, setShowArea] = React.useState(true);  // “заливка”

  // settings draft (UI only)
  const [currencyDraft, setCurrencyDraft] = React.useState('RUB');
  const [coinValueDraft, setCoinValueDraft] = React.useState('1.00');

  React.useEffect(() => {
    setCustomFrom(range?.from || '');
    setCustomTo(range?.to || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  function applyRange(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    if (typeof setRange === 'function') setRange({ from: nextFrom, to: nextTo });
  }

  function pickQuick(kind: 'day' | 'week' | 'month' | 'custom') {
    setQuick(kind);
    if (kind === 'custom') return;

    const anchor = range?.to || new Date().toISOString().slice(0, 10);
    if (kind === 'day') return applyRange(anchor, anchor);
    if (kind === 'week') return applyRange(isoAddDays(anchor, -6), anchor);
    if (kind === 'month') return applyRange(isoAddDays(anchor, -29), anchor);
  }

  const settings: SalesSettings = React.useMemo(() => {
    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor((Number.isFinite(units) ? units : 1) * 100);
    return {
      coin_value_cents: Math.max(1, cents),
      currency: String(currencyDraft || 'RUB').toUpperCase(),
      cashback_pct: 5,
    };
  }, [coinValueDraft, currencyDraft]);

  const qAll = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['sales_mock', appId, range?.from, range?.to, settings.currency, settings.coin_value_cents, basis],
    queryFn: async () => {
      // позже:
      // const kpi = await apiFetch(`/api/cabinet/apps/${appId}/sales/kpi?${qs(range)}`);
      // const ts  = await apiFetch(`/api/cabinet/apps/${appId}/sales/timeseries?${qs(range)}`);
      // ...
      // basis учитывать на бэке
      return mkMock(range as SalesRange, settings);
    },
    staleTime: 10_000,
  });

  const isLoading = qAll.isLoading;
  const isError = qAll.isError;

  const data = qAll.data;
  const currency = String(data?.settings?.currency || settings.currency || 'RUB').toUpperCase();
  const coinCents = Math.max(1, toInt(data?.settings?.coin_value_cents ?? settings.coin_value_cents ?? 100, 100));

  const kpi = data?.kpi;
  const days = data?.days || [];
  const funnel = data?.funnel;
  const cashiers = data?.cashiers || [];
  const customers = data?.customers || [];

  const totals = React.useMemo(() => {
    const rev = Number(kpi?.revenue_cents || 0);
    const orders = Number(kpi?.orders || 0);
    const buyers = Number(kpi?.buyers || 0);
    const repeat = Number(kpi?.repeat_rate || 0);

    const cashbackCoins = Number(kpi?.cashback_issued_coins || 0);
    const redeemCoins = Number(kpi?.redeem_confirmed_coins || 0);

    const cashbackCent = Math.round(cashbackCoins * coinCents);
    const redeemCent = Math.round(redeemCoins * coinCents);
    const net = redeemCent - cashbackCent;

    const avgCheck = orders > 0 ? Math.round(rev / orders) : 0;

    const pending = Number(kpi?.pending_confirms || 0);
    const cancelRate = Number(kpi?.cancel_rate || 0);

    const daysCount = daysBetweenISO(range?.from, range?.to);
    const revPerDay = daysCount > 0 ? Math.round(rev / daysCount) : 0;

    return {
      rev,
      orders,
      buyers,
      repeat,
      cashbackCoins,
      redeemCoins,
      cashbackCent,
      redeemCent,
      net,
      avgCheck,
      pending,
      cancelRate,
      daysCount,
      revPerDay,
    };
  }, [kpi, coinCents, range?.from, range?.to]);

  const alerts = React.useMemo(() => {
    const out: Array<{ key: string; title: string; sev: 'warn' | 'bad' }> = [];
    if (totals.pending >= 8) out.push({ key: 'pending', title: 'Много неподтверждённых операций', sev: 'bad' });
    else if (totals.pending >= 4) out.push({ key: 'pending', title: 'Есть неподтверждённые операции', sev: 'warn' });

    if (totals.cancelRate >= 0.12) out.push({ key: 'cancel', title: 'Высокий процент отмен', sev: 'bad' });
    else if (totals.cancelRate >= 0.08) out.push({ key: 'cancel', title: 'Отмены выше нормы', sev: 'warn' });

    if (totals.repeat < 0.22 && totals.orders > 20) out.push({ key: 'repeat', title: 'Низкая повторяемость', sev: 'warn' });

    return out;
  }, [totals.pending, totals.cancelRate, totals.repeat, totals.orders]);

  const primaryAlert = alerts.find((a) => a.sev === 'bad') || alerts[0] || null;

  const insights = React.useMemo(() => {
    const out: Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string; dev?: string }> = [];

    out.push({
      tone: totals.net >= 0 ? 'good' : 'warn',
      title: totals.net >= 0 ? 'Net эффект положительный' : 'Net эффект отрицательный',
      body:
        totals.net >= 0
          ? `Списание покрывает кэшбэк: ${moneyFromCent(totals.net, currency)} за период.`
          : `Кэшбэк “тяжелее” списаний: ${moneyFromCent(totals.net, currency)}. Подумай о промо на списание / правилах.`,
      dev: 'DEV: net = redeem_confirmed_coins*coin_value - cashback_issued_coins*coin_value',
    });

    if (totals.pending > 0) {
      out.push({
        tone: totals.pending >= 6 ? 'bad' : 'warn',
        title: 'Есть зависшие подтверждения',
        body: `Сейчас зависло: ~${totals.pending}. Это бьёт по доверию (клиент не видит результат).`,
        dev: 'DEV: нужно sales_events + авто-напоминания кассиру',
      });
    }

    out.push({
      tone: totals.repeat >= 0.35 ? 'good' : 'warn',
      title: totals.repeat >= 0.35 ? 'Повторяемость норм' : 'Повторяемость можно поднять',
      body:
        totals.repeat >= 0.35
          ? `Repeat rate: ${fmtPct(totals.repeat)}. Можно аккуратно повышать списания без потери маржи.`
          : `Repeat rate: ${fmtPct(totals.repeat)}. Дай “сладкий” повод вернуться: авто-пуш “у вас накопилось N монет”.`,
      dev: 'DEV: repeat_rate считать по customer_tg_id',
    });

    return out.slice(0, 4);
  }, [totals.net, totals.pending, totals.repeat, currency]);

  const topCashiers = [...cashiers]
    .sort((a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0))
    .slice(0, 6);

  const topCustomers = [...customers]
    .sort((a, b) => (b.ltv_cents || 0) - (a.ltv_cents || 0))
    .slice(0, 6);

  // чтобы Tooltip и серия “orders” не ломали “денежный” форматтер
  const chartData = React.useMemo(() => {
    return (days || []).map((d: SalesDay) => ({
      ...d,
      // orders bars на отдельной оси, но tooltip покажем красиво
      orders_count: d.orders,
    }));
  }, [days]);

  return (
    <div className="sg-page salesPage">
      <style>{`
:root{
  /* чуть мягче, ближе к Wheel/Склад */
  --sg-r-xl: 22px;
  --sg-r-lg: 18px;
  --sg-r-md: 14px;
  --sg-r-sm: 12px;

  --sg-bd: rgba(15,23,42,.10);
  --sg-bd2: rgba(15,23,42,.08);

  --sg-card: rgba(255,255,255,.88);
  --sg-card2: rgba(255,255,255,.96);
  --sg-soft: rgba(15,23,42,.03);

  --sg-shadow: 0 10px 26px rgba(15,23,42,.06);
  --sg-shadow2: 0 16px 40px rgba(15,23,42,.10);
  --sg-in: inset 0 1px 0 rgba(255,255,255,.70);

  --sg-warnTint: rgba(245,158,11,.08); /* как “Склад” */
  --sg-warnBd: rgba(245,158,11,.18);

  --sg-dangerTint: rgba(239,68,68,.08);
  --sg-dangerBd: rgba(239,68,68,.18);

  --sg-glow: 0 0 0 1px rgba(15,23,42,.10), 0 18px 42px rgba(15,23,42,.10);
}

.salesPage .wheelHead{ display:flex; gap:14px; align-items:flex-start; }
.salesPage .sg-h1{ margin:0; }
.salesPage .sg-sub{ opacity:.78; margin-top:6px; }

.salesQuickWrap{
  display:flex; align-items:center; gap:0; flex-wrap:nowrap;
  height:46px; box-sizing:border-box;
  border:1px solid rgba(15,23,42,.12);
  border-radius:16px;
  background:rgba(255,255,255,.84);
  overflow:hidden;
  box-shadow: var(--sg-in);
}
.salesQuickTabs{ border:0 !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
.salesQuickRange{
  display:flex; align-items:center; gap:8px;
  height:100%; padding:0 12px; border:0; background:transparent; position:relative;
}
.salesQuickRange::before{
  content:""; position:absolute; left:0; top:50%; transform:translateY(-50%);
  height:26px; width:1px; background:rgba(15,23,42,.10);
}
.salesQuickLbl{ font-weight:900; opacity:.75; font-size:12px; }
.salesQuickDate{
  width:150px;
  height:34px;
  padding:0 12px;
  box-sizing:border-box;
  border-radius:12px;
  border:1px solid rgba(15,23,42,.12);
  background:rgba(255,255,255,.96);
  font:inherit;
  font-weight:900;
  font-size:13px;
  font-family:inherit !important;
  font-variant-numeric:tabular-nums;
  appearance:none; -webkit-appearance:none;
}
.salesApplyBtn{
  height:34px; line-height:34px;
  padding:0 14px; margin-left:6px;
  border-radius:12px;
  box-sizing:border-box;
  font:inherit; font-weight:900; font-size:13px;
  white-space:nowrap;
}
.salesApplyBtn:disabled{ opacity:.55; cursor:not-allowed; }

@media (max-width:1100px){
  .salesQuickWrap{ flex-wrap:wrap; height:auto; padding:6px; gap:10px; }
  .salesQuickRange{ width:100%; height:auto; padding:6px 8px; }
  .salesQuickRange::before{ display:none; }
}

.salesGrid{
  display:grid;
  grid-template-columns: 1.65fr 1fr;
  gap:12px;
  margin-top:12px;
}
@media (max-width: 1100px){
  .salesGrid{ grid-template-columns:1fr; }
}

.salesCard{
  border:1px solid var(--sg-bd2) !important;
  border-radius: var(--sg-r-xl) !important;
  background: var(--sg-card) !important;
  box-shadow: var(--sg-in) !important;
  overflow: hidden;
}
.salesCard--lift{
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
}
.salesCard--lift:hover{
  transform: translateY(-1px);
  box-shadow: var(--sg-glow), var(--sg-in) !important;
  border-color: rgba(15,23,42,.12) !important;
  background: var(--sg-card2) !important;
}

.salesCardHead{
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:12px;
  padding:14px 14px 10px 14px;
  border-bottom:1px solid rgba(15,23,42,.08);
}
.salesTitle{ font-weight:900; }
.salesSub{ margin-top:4px; opacity:.78; font-size:13px; }

.salesChartWrap{
  position:relative;
  width:100%;
  height: 340px; /* ближе к Wheel */
}
@media (max-width: 1100px){
  .salesChartWrap{ height: 320px; }
}

/* overlay controls — как в Wheel */
.salesChartTopControls{
  position:absolute;
  top: 10px;
  right: 12px;
  display:flex;
  align-items:center;
  gap:10px;
  z-index:5;
  pointer-events:auto;
}
.salesSeg{
  display:inline-flex;
  gap:6px;
  padding:4px;
  border-radius:16px;
  border:1px solid rgba(15,23,42,.08);
  background:rgba(255,255,255,.78);
  box-shadow: var(--sg-in);
}
.salesSegBtn{
  height:32px;
  padding:0 12px;
  border-radius:12px;
  border:1px solid transparent;
  background:transparent;
  cursor:pointer;
  font-weight:1000;
  font-size:12px;
  opacity:.9;
}
.salesSegBtn:hover{ opacity:1; }
.salesSegBtn.is-active{
  background:rgba(15,23,42,.04);
  border-color:rgba(15,23,42,.10);
  box-shadow:0 12px 22px rgba(15,23,42,.06), var(--sg-in);
  opacity:1;
}

.salesIconGroup{
  display:inline-flex;
  gap:6px;
  padding:4px;
  border-radius:16px;
  border:1px solid rgba(15,23,42,.08);
  background:rgba(255,255,255,.78);
  box-shadow: var(--sg-in);
}
.sgIconBtn{
  width:34px;
  height:34px;
  border-radius:12px;
  border:1px solid transparent;
  background:transparent;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  box-shadow:none;
  opacity:.92;
}
.sgIconBtn:hover{ opacity:1; }
.sgIconBtn.is-active{
  background:rgba(15,23,42,.04);
  border-color:rgba(15,23,42,.10);
  box-shadow:0 12px 22px rgba(15,23,42,.06), var(--sg-in);
  opacity:1;
}
.sgIconBtn svg{ width:16px; height:16px; opacity:.78; }
.sgIconBtn.is-active svg{ opacity:.92; }

.salesChartOverlay{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  flex-direction:column; gap:10px;
  pointer-events:none;
}
.salesSpinner{
  width:26px; height:26px; border-radius:999px;
  border:3px solid rgba(15,23,42,.18);
  border-top-color: rgba(15,23,42,.58);
  animation: salesSpin .8s linear infinite;
}
@keyframes salesSpin{ from{transform:rotate(0)} to{transform:rotate(360deg)} }

.salesUnderTabs{ padding:12px 14px 0 14px; }
.salesUnderPanel{
  margin:10px 14px 14px 14px;
  border:1px solid var(--sg-bd);
  border-radius: var(--sg-r-xl);
  background: rgba(255,255,255,.86);
  box-shadow: var(--sg-shadow), var(--sg-in);
  padding:14px;
}

/* Tiles */
.salesTiles{
  display:grid;
  grid-template-columns: repeat(5, 1fr);
  gap:10px;
}
@media (max-width: 1100px){
  .salesTiles{ grid-template-columns: repeat(2, 1fr); }
}
.salesTile{
  position:relative;
  border:1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.88);
  border-radius: var(--sg-r-lg);
  padding:12px 12px;
  box-shadow: var(--sg-in);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
  text-align:left;
}
.salesTile:hover{
  transform: translateY(-1px);
  box-shadow: var(--sg-shadow2), var(--sg-in);
  border-color: rgba(15,23,42,.12);
  background: rgba(255,255,255,.96);
}
.salesTileLbl{
  font-weight:900;
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  opacity:.72;
  display:flex; align-items:center; gap:8px;
}
.salesTileVal{
  margin-top:6px;
  font-weight:950;
  font-size:20px;
  letter-spacing:-.02em;
}
.salesTileSub{
  margin-top:6px;
  font-size:12px;
  opacity:.78;
}

/* Rows — hover как “Склад”: мягкий warm */
.sgRow{
  position:relative;
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  padding:10px 10px;
  border-radius: var(--sg-r-md);
  border:1px solid rgba(15,23,42,.07);
  background: rgba(255,255,255,.80);
  box-shadow: var(--sg-in);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
}
.sgRow:hover{
  transform: translateY(-1px);
  box-shadow: var(--sg-shadow), var(--sg-in);
  border-color: rgba(15,23,42,.12);
  background: var(--sg-warnTint);
}
.sgRowLeft{ display:flex; align-items:center; gap:10px; min-width:0; }
.sgRowTitle{ font-weight:900; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sgRowMeta{ margin-top:2px; font-size:12px; opacity:.75; }
.sgRowRight{ text-align:right; display:flex; flex-direction:column; gap:2px; }
.sgRowVal{ font-weight:950; }
.sgRowSub{ font-size:12px; opacity:.72; font-weight:800; }

/* shimmer */
.sgShimmerLine{
  position:relative;
  height:10px;
  border-radius:999px;
  background: rgba(15,23,42,.06);
  overflow:hidden;
}
.sgShimmerLine__shine{
  position:absolute;
  inset:-40% -60% -40% -60%;
  background: linear-gradient(90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.55) 45%,
    rgba(255,255,255,0) 80%);
  transform: translateX(-35%);
  animation: sgShimmer 1.5s ease-in-out infinite;
  opacity:.8;
}
@keyframes sgShimmer{
  0%{ transform: translateX(-35%); }
  100%{ transform: translateX(35%); }
}

/* alert dot */
.sgAlertDot{
  width:22px; height:22px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(239,68,68,.24);
  background: rgba(239,68,68,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 12px 24px rgba(15,23,42,.10);
}
.sgAlertDot__bang{
  font-weight:1000;
  font-size:14px;
  line-height:1;
  color: rgba(239,68,68,.95);
}

/* tooltips */
.sgTip{
  position:relative;
  display:inline-flex;
  width:18px;
  height:18px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.12);
  background:rgba(255,255,255,.92);
  opacity:.86;
  flex:0 0 auto;
}
.sgTip::before{
  content:"?";
  margin:auto;
  font-weight:1000;
  font-size:12px;
  opacity:.72;
}
.sgTip.is-dev::before{ content:"DEV"; font-size:9px; letter-spacing:.04em; }
.sgTip:hover{ opacity:1; }
.sgTip::after{
  content:attr(data-tip);
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  padding:8px 10px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.14);
  background:rgba(255,255,255,.98);
  box-shadow: 0 18px 40px rgba(15,23,42,.14);
  font-weight:900;
  font-size:12px;
  white-space:nowrap;
  opacity:0;
  pointer-events:none;
  transition:opacity .12s ease;
  z-index:9999;
}
.sgTip.is-top::after{ bottom: calc(100% + 10px); }
.sgTip.is-bottom::after{ top: calc(100% + 10px); }
.sgTip:hover::after{ opacity:1; }

/* Collapsible */
.sgColl{
  border:1px solid rgba(15,23,42,.08);
  border-radius: var(--sg-r-xl);
  background: rgba(255,255,255,.90);
  box-shadow: var(--sg-in);
  overflow:hidden;
}
.sgColl__head{
  width:100%;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:12px 12px;
  cursor:pointer;
  border:0;
  background:transparent;
  text-align:left;
}
.sgColl__title{
  font-weight:1000;
  display:flex;
  align-items:center;
  gap:10px;
}
.sgColl__sub{ margin-top:3px; font-size:12px; opacity:.78; }
.sgColl__right{ display:flex; gap:10px; align-items:center; }
.sgColl__chev{
  width:10px; height:10px;
  border-right:2px solid rgba(15,23,42,.45);
  border-bottom:2px solid rgba(15,23,42,.45);
  transform: rotate(45deg);
  transition: transform .16s ease;
  opacity:.85;
}
.sgColl.is-open .sgColl__chev{ transform: rotate(225deg); }
.sgColl__body{
  max-height: 0px;
  overflow:hidden;
  transition: max-height .22s ease;
  padding: 0 12px;
}
.sgColl.is-open .sgColl__body{
  max-height: 1200px;
  padding: 0 12px 12px 12px;
}

/* Right sticky */
.salesRightSticky{ position: sticky; top: 10px; }
      `}</style>

      {/* ===== HEAD ===== */}
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Продажи (QR)</h1>
          <div className="sg-sub">
            График/карточки — один стиль с Wheel. Сейчас данные — mock (для дизайна), потом подключим воркер.
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="salesQuickWrap">
            <div className="sg-tabs wheelMiniTabs salesQuickTabs">
              <button type="button" className={'sg-tab ' + (quick === 'day' ? 'is-active' : '')} onClick={() => pickQuick('day')}>День</button>
              <button type="button" className={'sg-tab ' + (quick === 'week' ? 'is-active' : '')} onClick={() => pickQuick('week')}>Неделя</button>
              <button type="button" className={'sg-tab ' + (quick === 'month' ? 'is-active' : '')} onClick={() => pickQuick('month')}>Месяц</button>
              <button type="button" className={'sg-tab ' + (quick === 'custom' ? 'is-active' : '')} onClick={() => pickQuick('custom')}>Свой период</button>
            </div>

            {quick === 'custom' && (
              <div className="salesQuickRange">
                <span className="salesQuickLbl">от</span>
                <Input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} className="salesQuickDate" />
                <span className="salesQuickLbl">до</span>
                <Input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} className="salesQuickDate" />
                <button
                  type="button"
                  className="sg-tab is-active salesApplyBtn"
                  onClick={() => applyRange(customFrom, customTo)}
                  disabled={!customFrom || !customTo}
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== GRID ===== */}
      <div className="salesGrid">
        {/* LEFT */}
        <div className="salesLeft">
          <Card className="salesCard salesCard--lift">
            <div className="salesCardHead">
              <div>
                <div className="salesTitle">
                  Факт: выручка / net эффект
                  <span style={{ marginLeft: 10 }}>
                    <Tip dev text="DEV: сюда потом подтянем /sales/timeseries. Сейчас mock." />
                  </span>
                </div>
                <div className="salesSub">{range?.from} — {range?.to}</div>
              </div>
            </div>

            <div className="salesChartWrap">
              {/* top overlay controls — “как в колесе” */}
              <div className="salesChartTopControls">
                <div className="salesSeg" role="tablist" aria-label="basis">
                  <button
                    type="button"
                    className={'salesSegBtn ' + (basis === 'confirmed' ? 'is-active' : '')}
                    onClick={() => setBasis('confirmed')}
                    title="Net по подтверждённым операциям"
                  >
                    при подтвержд.
                  </button>
                  <button
                    type="button"
                    className={'salesSegBtn ' + (basis === 'issued' ? 'is-active' : '')}
                    onClick={() => setBasis('issued')}
                    title="Net по выданным (issued) — позже на бэке"
                  >
                    при выдаче
                  </button>
                </div>

                <div className="salesIconGroup" aria-label="chart overlays">
                  <IconBtn
                    title="Цилиндры (заказы)"
                    active={showBars}
                    onClick={() => setShowBars(v => !v)}
                  >
                    {/* “квадратик” как на wheel */}
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M8 15h8" stroke="currentColor" strokeWidth="2" opacity=".6" />
                    </svg>
                  </IconBtn>

                  <IconBtn
                    title="Заливка (выручка)"
                    active={showArea}
                    onClick={() => setShowArea(v => !v)}
                  >
                    {/* “линии” */}
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5 16c3-6 6 2 9-4s5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" opacity=".45" />
                    </svg>
                  </IconBtn>

                  <IconBtn
                    title="П — Net (profit)"
                    active={showNet}
                    onClick={() => setShowNet(v => !v)}
                  >
                    {/* “П” */}
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M7 18V7h10v11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M9 10h6" stroke="currentColor" strokeWidth="2" opacity=".6" />
                    </svg>
                  </IconBtn>
                </div>

                {primaryAlert ? <AlertDot title={primaryAlert.title} /> : null}
              </div>

              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 34, right: 18, left: 6, bottom: 0 }}>
                    {/* сетка “как у wheel”: лёгкая */}
                    <CartesianGrid strokeDasharray="3 3" opacity={0.22} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                    />

                    {/* money axis (как в wheel: одна читаемая шкала) */}
                    <YAxis
                      yAxisId="money"
                      tick={{ fontSize: 12 }}
                      width={54}
                      tickFormatter={(v: any) => niceMoneyTick(Number(v))}
                    />

                    {/* orders axis — скрытая шкала, только для bar */}
                    <YAxis
                      yAxisId="orders"
                      orientation="right"
                      width={10}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'revenue_cents') return [moneyFromCent(val, currency), 'Выручка/день'];
                        if (name === 'net_cents') return [moneyFromCent(val, currency), 'Net/день'];
                        if (name === 'orders_count') return [val, 'Заказы/день'];
                        return [val, name];
                      }}
                      labelFormatter={(_: any, payload: any) => {
                        const d = payload?.[0]?.payload?.date;
                        return d ? `Дата ${d}` : 'Дата';
                      }}
                    />

                    {/* Area — выручка */}
                    {showArea && (
                      <Area
                        yAxisId="money"
                        type="monotone"
                        dataKey="revenue_cents"
                        name="revenue_cents"
                        stroke="var(--accent2)"
                        fill="var(--accent)"
                        fillOpacity={0.12}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )}

                    {/* Line — net (profit) */}
                    {showNet && (
                      <Line
                        yAxisId="money"
                        type="monotone"
                        dataKey="net_cents"
                        name="net_cents"
                        stroke="var(--accent2)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    )}

                    {/* Bars — заказы (цилиндры) */}
                    {showBars && (
                      <Bar
                        yAxisId="orders"
                        dataKey="orders_count"
                        name="orders_count"
                        fill="var(--accent)"
                        fillOpacity={0.18}
                        radius={[12, 12, 12, 12]}
                        barSize={14}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {isLoading && (
                <div className="salesChartOverlay">
                  <div className="salesSpinner" />
                  <div style={{ fontWeight: 900, opacity: 0.75 }}>Загрузка…</div>
                </div>
              )}

              {isError && (
                <div className="salesChartOverlay">
                  <div style={{ fontWeight: 900, opacity: 0.85 }}>
                    Ошибка: {String((qAll.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              )}
            </div>

            {/* UNDER TABS (как wheel) */}
            <div className="salesUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (tab === 'summary' ? 'is-active' : '')} onClick={() => setTab('summary')}>Сводка</button>
                <button className={'sg-tab ' + (tab === 'funnel' ? 'is-active' : '')} onClick={() => setTab('funnel')}>Воронка</button>
                <button className={'sg-tab ' + (tab === 'cashiers' ? 'is-active' : '')} onClick={() => setTab('cashiers')}>Кассиры</button>
                <button className={'sg-tab ' + (tab === 'customers' ? 'is-active' : '')} onClick={() => setTab('customers')}>Клиенты</button>
                <button className={'sg-tab ' + (tab === 'live' ? 'is-active' : '')} onClick={() => setTab('live')}>Live</button>
              </div>
            </div>

            {/* TAB: SUMMARY */}
            {tab === 'summary' && (
              <div className="salesUnderPanel">
                <div className="salesTiles">
                  <div className="salesTile">
                    <div className="salesTileLbl">
                      Выручка <Tip text="Сумма чеков за период" />
                    </div>
                    <div className="salesTileVal">{isLoading ? '—' : moneyFromCent(totals.rev, currency)}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={66} /> : <>в день: <b>{moneyFromCent(totals.revPerDay, currency)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">
                      Заказы <Tip text="Количество продаж (recorded)" />
                    </div>
                    <div className="salesTileVal">{isLoading ? '—' : totals.orders}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={58} /> : <>ср. чек: <b>{moneyFromCent(totals.avgCheck, currency)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">
                      Покупатели <Tip text="Уникальные клиенты (приближ.)" />
                    </div>
                    <div className="salesTileVal">{isLoading ? '—' : totals.buyers}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={52} /> : <>repeat: <b>{fmtPct(totals.repeat)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">
                      Кэшбэк <Tip text="Начислено монет (issued)" />
                    </div>
                    <div className="salesTileVal">
                      {isLoading ? '—' : `${totals.cashbackCoins.toLocaleString('ru-RU')} мон`}
                    </div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={64} /> : <>≈ <b>{moneyFromCent(totals.cashbackCent, currency)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">
                      Net <Tip text="Списание(₽) − Кэшбэк(₽)" />
                    </div>
                    <div className="salesTileVal">{isLoading ? '—' : moneyFromCent(totals.net, currency)}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={60} /> : <>списано: <b>{moneyFromCent(totals.redeemCent, currency)}</b></>}
                    </div>

                    {primaryAlert ? (
                      <div style={{ position: 'absolute', top: 10, right: 10 }}>
                        <AlertDot title={primaryAlert.title} />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="sgRow">
                    <div className="sgRowLeft">
                      <div>
                        <div className="sgRowTitle">Зависшие подтверждения</div>
                        <div className="sgRowMeta">
                          <span className="sg-muted">Портит UX: клиент не видит результат</span>
                          <span style={{ marginLeft: 8 }}>
                            <Tip dev text="DEV: pending = sales where status=pending OR ledger not confirmed by timeout" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="sgRowRight">
                      <div className="sgRowVal">{isLoading ? '—' : totals.pending}</div>
                      <div className="sgRowSub">{isLoading ? ' ' : (totals.pending >= 6 ? 'критично' : totals.pending > 0 ? 'есть' : 'ок')}</div>
                    </div>
                  </div>

                  <div className="sgRow">
                    <div className="sgRowLeft">
                      <div>
                        <div className="sgRowTitle">Процент отмен</div>
                        <div className="sgRowMeta">
                          <span className="sg-muted">Сигнал проблем в кассе/правилах</span>
                          <span style={{ marginLeft: 8 }}>
                            <Tip dev text="DEV: cancel_rate = cancels / recorded за период" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="sgRowRight">
                      <div className="sgRowVal">{isLoading ? '—' : fmtPct(totals.cancelRate)}</div>
                      <div className="sgRowSub">{isLoading ? ' ' : (totals.cancelRate >= 0.12 ? 'плохо' : totals.cancelRate >= 0.08 ? 'риск' : 'ок')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: FUNNEL */}
            {tab === 'funnel' && (
              <div className="salesUnderPanel">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {isLoading ? (
                    <>
                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">Воронка</div>
                            <div className="sgRowMeta"><ShimmerLine w={84} /></div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">—</div>
                          <div className="sgRowSub">—</div>
                        </div>
                      </div>
                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">Время подтверждения</div>
                            <div className="sgRowMeta"><ShimmerLine w={72} /></div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">—</div>
                          <div className="sgRowSub">—</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">Скан → Запись → Подтверждения</div>
                            <div className="sgRowMeta">
                              <span className="sg-muted">Слабое место = где больше всего падает</span>
                              <span style={{ marginLeft: 8 }}>
                                <Tip dev text="DEV: funnel из sales_events + статусов (pending/confirmed/canceled)" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">{funnel?.scanned} → {funnel?.recorded}</div>
                          <div className="sgRowSub">{funnel?.cashback_confirmed} confirmed</div>
                        </div>
                      </div>

                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">PIN: выдано → использовано</div>
                            <div className="sgRowMeta">
                              <span className="sg-muted">Показывает “дожим” до награды</span>
                              <span style={{ marginLeft: 8 }}>
                                <Tip dev text="DEV: pin_issued/pin_used из pins_pool (issued_at/used_at)" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">{funnel?.pin_issued} → {funnel?.pin_used}</div>
                          <div className="sgRowSub">
                            conv: {fmtPct(funnel && funnel.pin_issued ? (funnel.pin_used / funnel.pin_issued) : 0)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!isLoading && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="sgRow">
                      <div className="sgRowLeft">
                        <div>
                          <div className="sgRowTitle">Подтверждение (median)</div>
                          <div className="sgRowMeta">
                            <span className="sg-muted">От “записали” до “confirmed”</span>
                            <span style={{ marginLeft: 8 }}>
                              <Tip dev text="DEV: median(created_at→confirmed_at) по sales" />
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{(funnel?.median_confirm_minutes ?? 0).toFixed(1)} мин</div>
                        <div className="sgRowSub">{(funnel?.median_confirm_minutes ?? 0) > 5 ? 'медленно' : 'ок'}</div>
                      </div>
                    </div>

                    <div className="sgRow">
                      <div className="sgRowLeft">
                        <div>
                          <div className="sgRowTitle">Списание (подтверждено)</div>
                          <div className="sgRowMeta">
                            <span className="sg-muted">Если низко — люди не тратят монеты</span>
                            <span style={{ marginLeft: 8 }}>
                              <Tip dev text="DEV: redeem_confirmed из ledger events / sales.redeem_status" />
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{funnel?.redeem_confirmed}</div>
                        <div className="sgRowSub">
                          rate: {fmtPct(funnel && funnel.recorded ? (funnel.redeem_confirmed / funnel.recorded) : 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CASHIERS */}
            {tab === 'cashiers' && (
              <div className="salesUnderPanel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 1000 }}>
                    Кассиры <span style={{ marginLeft: 8 }}><Tip dev text="DEV: /sales/cashiers агрегация по cashier_tg_id" /></span>
                  </div>
                  <div className="sg-muted">наведи на строки — подсветка как “Склад”</div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(isLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <div className="sgRow" key={i}>
                      <div className="sgRowLeft">
                        <div style={{ width: '100%' }}>
                          <div className="sgRowTitle"><ShimmerLine w={42} /></div>
                          <div className="sgRowMeta"><ShimmerLine w={86} /></div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">—</div>
                        <div className="sgRowSub">—</div>
                      </div>
                    </div>
                  )) : topCashiers.map((c) => {
                    const bad = c.cancel_rate >= 0.12 || c.confirm_rate <= 0.86;
                    return (
                      <div className="sgRow" key={c.cashier_label} style={bad ? { borderColor: 'var(--sg-warnBd)' as any } : undefined}>
                        <div className="sgRowLeft">
                          <div style={{ minWidth: 0 }}>
                            <div className="sgRowTitle">{c.cashier_label}</div>
                            <div className="sgRowMeta">
                              выручка: <b>{moneyFromCent(c.revenue_cents, currency)}</b>
                              <span className="sg-muted"> · </span>
                              заказы: <b>{c.orders}</b>
                              <span className="sg-muted"> · </span>
                              confirm: <b>{fmtPct(c.confirm_rate)}</b>
                              <span className="sg-muted"> · </span>
                              cancel: <b>{fmtPct(c.cancel_rate)}</b>
                              {c.alerts?.length ? (
                                <span style={{ marginLeft: 10 }}>
                                  <AlertDot title={c.alerts.join(' / ')} />
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="sgRowRight">
                          <div className="sgRowVal">{c.median_confirm_minutes.toFixed(1)} мин</div>
                          <div className="sgRowSub">{bad ? 'риск' : 'норма'}</div>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>
            )}

            {/* TAB: CUSTOMERS */}
            {tab === 'customers' && (
              <div className="salesUnderPanel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 1000 }}>
                    Клиенты <span style={{ marginLeft: 8 }}><Tip dev text="DEV: /sales/customers список + сегменты по поведению" /></span>
                  </div>
                  <div className="sg-muted">сегменты: new / repeat / saver / spender</div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(isLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <div className="sgRow" key={i}>
                      <div className="sgRowLeft">
                        <div style={{ width: '100%' }}>
                          <div className="sgRowTitle"><ShimmerLine w={46} /></div>
                          <div className="sgRowMeta"><ShimmerLine w={80} /></div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">—</div>
                        <div className="sgRowSub">—</div>
                      </div>
                    </div>
                  )) : topCustomers.map((c) => {
                    const isSaver = c.segment === 'saver';
                    const isSpender = c.segment === 'spender';
                    const alert = isSaver ? 'Накопил и не тратит' : isSpender ? 'Часто тратит — VIP' : '';
                    return (
                      <div className="sgRow" key={c.customer_label} style={isSaver ? { background: 'rgba(245,158,11,.06)' } : undefined}>
                        <div className="sgRowLeft">
                          <div style={{ minWidth: 0 }}>
                            <div className="sgRowTitle">{c.customer_label}</div>
                            <div className="sgRowMeta">
                              LTV: <b>{moneyFromCent(c.ltv_cents, currency)}</b>
                              <span className="sg-muted"> · </span>
                              заказов: <b>{c.orders}</b>
                              <span className="sg-muted"> · </span>
                              last: <b>{c.last_seen}</b>
                              <span className="sg-muted"> · </span>
                              сегмент: <b>{c.segment}</b>
                              {alert ? (
                                <span style={{ marginLeft: 10 }}>
                                  <Tip text={alert} />
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="sgRowRight">
                          <div className="sgRowVal">{moneyFromCent(c.revenue_cents, currency)}</div>
                          <div className="sgRowSub">за период</div>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>
            )}

            {/* TAB: LIVE */}
            {tab === 'live' && (
              <div className="salesUnderPanel">
                <div style={{ fontWeight: 1000 }}>
                  Live лента <span style={{ marginLeft: 8 }}><Tip dev text="DEV: /sales/live последние N событий (sales_events)" /></span>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <div className="sgRow" key={i}>
                      <div className="sgRowLeft">
                        <div style={{ width: '100%' }}>
                          <div className="sgRowTitle"><ShimmerLine w={70} /></div>
                          <div className="sgRowMeta"><ShimmerLine w={92} /></div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">—</div>
                        <div className="sgRowSub">—</div>
                      </div>
                    </div>
                  )) : (
                    <>
                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">sale_recorded</div>
                            <div className="sgRowMeta">
                              Покупка 520 ₽ · cashback +31 мон · кассир #2 · 12:44
                              <span style={{ marginLeft: 8 }}><Tip text="Подсказка: hover-only" /></span>
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">ok</div>
                          <div className="sgRowSub">event</div>
                        </div>
                      </div>

                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">redeem_confirmed</div>
                            <div className="sgRowMeta">
                              Списано 120 мон · net +12 ₽ · кассир #1 · 12:40
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">vip</div>
                          <div className="sgRowSub">segment</div>
                        </div>
                      </div>

                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">cashback_pending</div>
                            <div className="sgRowMeta">
                              Ждёт подтверждения · кассир #2 · 12:33
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">risk</div>
                          <div className="sgRowSub">alert</div>
                        </div>
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="salesRight">
          <div className="salesRightSticky">
            {/* Summary PRO */}
            <Card className="salesCard salesCard--lift" style={{ marginBottom: 12 }}>
              <div className="salesCardHead">
                <div>
                  <div className="salesTitle">
                    Summary PRO
                    <span style={{ marginLeft: 10 }}><Tip text="Подсказки при наведении. Нажимай секции — сворачиваются." /></span>
                  </div>
                  <div className="salesSub">Сигналы качества + рекомендации</div>
                </div>
                {primaryAlert ? <AlertDot title={primaryAlert.title} /> : null}
              </div>

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Collapsible
                  title="Ключевые сигналы"
                  sub="что нужно починить в первую очередь"
                  open={openKpi}
                  onToggle={() => setOpenKpi(v => !v)}
                  alert={{ on: !!primaryAlert, title: primaryAlert?.title || '' }}
                  right={<span className="sg-muted" style={{ fontWeight: 900 }}>{alerts.length ? `${alerts.length} алерт(а)` : 'нет алертов'}</span>}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="sgRow">
                      <div className="sgRowLeft">
                        <div>
                          <div className="sgRowTitle">Список алертов</div>
                          <div className="sgRowMeta">
                            <span className="sg-muted">Мягкая подсветка (без кислотности)</span>
                            <span style={{ marginLeft: 8 }}><Tip dev text="DEV: алерты считать на бэке и отдавать массивом" /></span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{alerts.length}</div>
                        <div className="sgRowSub">{alerts.length ? 'внимание' : 'ok'}</div>
                      </div>
                    </div>

                    {alerts.length ? alerts.slice(0, 4).map((a) => (
                      <div className="sgRow" key={a.key} style={a.sev === 'bad' ? { borderColor: 'var(--sg-dangerBd)' as any, background: 'var(--sg-dangerTint)' as any } : undefined}>
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">{a.title}</div>
                            <div className="sgRowMeta">
                              <span className="sg-muted">sev: </span><b>{a.sev}</b>
                              <span style={{ marginLeft: 8 }}><Tip text="Подсказка при hover" /></span>
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">{a.sev === 'bad' ? '!' : '·'}</div>
                          <div className="sgRowSub">{a.sev}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="sgRow">
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">Всё спокойно</div>
                            <div className="sgRowMeta">Пока нет критичных отклонений</div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">ok</div>
                          <div className="sgRowSub">clean</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Collapsible>

                <Collapsible
                  title="Инсайты"
                  sub="умные подсказки (с привязкой к метрикам)"
                  open={openInsights}
                  onToggle={() => setOpenInsights(v => !v)}
                  right={<span className="sg-muted" style={{ fontWeight: 900 }}>4 cards</span>}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {isLoading ? (
                      <>
                        <div className="sgRow"><div className="sgRowLeft"><div style={{ width: '100%' }}><div className="sgRowTitle"><ShimmerLine w={54} /></div><div className="sgRowMeta"><ShimmerLine w={92} /></div></div></div></div>
                        <div className="sgRow"><div className="sgRowLeft"><div style={{ width: '100%' }}><div className="sgRowTitle"><ShimmerLine w={62} /></div><div className="sgRowMeta"><ShimmerLine w={88} /></div></div></div></div>
                      </>
                    ) : insights.map((x, i) => (
                      <div className="sgRow" key={i}>
                        <div className="sgRowLeft">
                          <div style={{ minWidth: 0 }}>
                            <div className="sgRowTitle">
                              {x.title}
                              <span style={{ marginLeft: 10 }}>
                                <Tip text={x.body} />
                              </span>
                              {x.dev ? (
                                <span style={{ marginLeft: 8 }}>
                                  <Tip dev text={x.dev} />
                                </span>
                              ) : null}
                            </div>
                            <div className="sgRowMeta">{x.body}</div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">{x.tone}</div>
                          <div className="sgRowSub">insight</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Collapsible>

                <Collapsible
                  title="Топ списки"
                  sub="кто приносит деньги / кто косячит"
                  open={openTop}
                  onToggle={() => setOpenTop(v => !v)}
                  right={<span className="sg-muted" style={{ fontWeight: 900 }}>Top 6</span>}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <div className="sgRow">
                      <div className="sgRowLeft">
                        <div>
                          <div className="sgRowTitle">Топ кассиров по выручке</div>
                          <div className="sgRowMeta">
                            <span className="sg-muted">Сравни confirm/cancel и медиану времени</span>
                            <span style={{ marginLeft: 8 }}><Tip dev text="DEV: sort by revenue_cents desc" /></span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{topCashiers.length}</div>
                        <div className="sgRowSub">rows</div>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="sgRow">
                        <div className="sgRowLeft"><div style={{ width: '100%' }}><div className="sgRowTitle"><ShimmerLine w={44} /></div><div className="sgRowMeta"><ShimmerLine w={90} /></div></div></div>
                        <div className="sgRowRight"><div className="sgRowVal">—</div><div className="sgRowSub">—</div></div>
                      </div>
                    ) : (
                      topCashiers.slice(0, 3).map((c) => (
                        <div className="sgRow" key={'topc_' + c.cashier_label}>
                          <div className="sgRowLeft">
                            <div>
                              <div className="sgRowTitle">{c.cashier_label}</div>
                              <div className="sgRowMeta">
                                confirm <b>{fmtPct(c.confirm_rate)}</b> · cancel <b>{fmtPct(c.cancel_rate)}</b> · median <b>{c.median_confirm_minutes.toFixed(1)}m</b>
                              </div>
                            </div>
                          </div>
                          <div className="sgRowRight">
                            <div className="sgRowVal">{moneyFromCent(c.revenue_cents, currency)}</div>
                            <div className="sgRowSub">revenue</div>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="sgRow">
                      <div className="sgRowLeft">
                        <div>
                          <div className="sgRowTitle">Топ клиентов по LTV</div>
                          <div className="sgRowMeta">
                            <span className="sg-muted">Отсюда делаем VIP/retention сценарии</span>
                            <span style={{ marginLeft: 8 }}><Tip dev text="DEV: segment rules (saver/spender) позже" /></span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{topCustomers.length}</div>
                        <div className="sgRowSub">rows</div>
                      </div>
                    </div>

                    {!isLoading && topCustomers.slice(0, 3).map((c) => (
                      <div className="sgRow" key={'topu_' + c.customer_label}>
                        <div className="sgRowLeft">
                          <div>
                            <div className="sgRowTitle">{c.customer_label}</div>
                            <div className="sgRowMeta">
                              сегмент <b>{c.segment}</b> · заказов <b>{c.orders}</b> · last <b>{c.last_seen}</b>
                            </div>
                          </div>
                        </div>
                        <div className="sgRowRight">
                          <div className="sgRowVal">{moneyFromCent(c.ltv_cents, currency)}</div>
                          <div className="sgRowSub">LTV</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Collapsible>
              </div>
            </Card>

            {/* Settings block (UI-only) */}
            <Card className="salesCard salesCard--lift">
              <div className="salesCardHead">
                <div>
                  <div className="salesTitle">
                    Стоимость монеты (UI)
                    <span style={{ marginLeft: 10 }}><Tip dev text="DEV: потом /settings (coin_value_cents + currency)" /></span>
                  </div>
                  <div className="salesSub">Нужно для пересчёта монет → деньги</div>
                </div>
              </div>

              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'end' }}>
                  <div>
                    <div className="sg-muted" style={{ marginBottom: 6 }}>
                      1 монета = (в {currencyLabel(currencyDraft)})
                    </div>
                    <Input value={coinValueDraft} onChange={(e: any) => setCoinValueDraft(e.target.value)} placeholder="1.00" />
                    <div className="sg-muted" style={{ marginTop: 6 }}>
                      = {moneyFromCent(coinCents, currencyDraft)} / монета
                    </div>
                  </div>

                  <div>
                    <div className="sg-muted" style={{ marginBottom: 6 }}>Валюта</div>
                    <select
                      value={currencyDraft}
                      onChange={(e: any) => setCurrencyDraft(String(e.target.value || 'RUB').toUpperCase())}
                      className="sg-input"
                      style={{ height: 38, width: '100%' }}
                    >
                      <option value="RUB">RUB (₽)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="sg-tab is-active" disabled>
                    Сохранить (позже)
                  </button>
                  <span className="sg-muted">
                    DEV: позже сделаем PUT /settings и invalidate queries
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
