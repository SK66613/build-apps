// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Card, Input, Button } from '../components/ui';
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
 * SALES — Cabinet “дорого как Wheel”
 * - Премиум карточки: glass + lift + аккуратный hover + подсветка “не дешевая”
 * - Шиммер-строки (переливаются) для таблиц/строк метрик
 * - Under-chart tabs как у колеса
 * - Collapsible секции (нажатием сворачивать/разворачивать)
 * - Alerts: красный восклицательный знак сверху справа (не “кислотный”)
 *
 * DEV (для разработчика): сейчас endpoints — заглушки / mock fallback.
 * Потом просто заменить queryFn на реальные роуты воркера.
 *
 * План endpoints (потом прикрутим в worker):
 *  - GET  /api/cabinet/apps/:appId/sales/kpi?from&to
 *  - GET  /api/cabinet/apps/:appId/sales/timeseries?from&to
 *  - GET  /api/cabinet/apps/:appId/sales/funnel?from&to
 *  - GET  /api/cabinet/apps/:appId/sales/cashiers?from&to
 *  - GET  /api/cabinet/apps/:appId/sales/customers?from&to
 *  - GET  /api/cabinet/apps/:appId/sales/live?from&to
 */

type SalesRange = { from: string; to: string };

type SalesSettings = {
  coin_value_cents?: number;
  currency?: string; // RUB|USD|EUR
  cashback_pct?: number; // optional
};

type SalesKPI = {
  revenue_cents: number;
  orders: number;
  buyers: number;
  repeat_rate: number; // 0..1
  cashback_issued_coins: number;
  redeem_confirmed_coins: number;

  // optional quality signals (alerts)
  pending_confirms?: number; // сколько операций “зависло”
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
  cashier_label: string; // name or tg id
  orders: number;
  revenue_cents: number;
  confirm_rate: number; // 0..1
  cancel_rate: number; // 0..1
  median_confirm_minutes: number;
  alerts?: string[]; // for UI badges
};

type CustomerRow = {
  customer_label: string;
  orders: number;
  revenue_cents: number;
  ltv_cents: number;
  last_seen: string; // YYYY-MM-DD
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

/** ===== chart helpers (дорого как wheel) ===== */
function compactMoneyTickFromCents(v: any, currency: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const sym = currencyLabel(currency);
  const units = n / 100; // cents -> money

  const abs = Math.abs(units);
  const sign = units < 0 ? '-' : '';

  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${sym}${Math.round(abs)}`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

function domainFrom(values: number[], padRatio = 0.10): [number, number] {
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

  // если есть и + и - — делаем “красиво” симметрично вокруг 0
  if (min < 0 && max > 0) {
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    return [-absMax * 1.02, absMax * 1.02];
  }

  return [min, max];
}

/* ====== Premium UI helpers ====== */

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

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={'sgSwitch ' + (checked ? 'is-on' : 'is-off') + (disabled ? ' is-disabled' : '')}
      onClick={(e) => {
        if (disabled) return;
        try {
          (e.currentTarget as any).blur?.();
        } catch (_) {}
        onChange(!checked);
      }}
      aria-pressed={checked}
      aria-disabled={!!disabled}
    >
      <span className="sgSwitch__knob" />
    </button>
  );
}

/* ====== Mock data (fallback) ====== */

function mkMock(range: SalesRange, settings: SalesSettings) {
  const dates = listDaysISO(range.from, range.to);
  const coinCents = Math.max(1, toInt(settings.coin_value_cents ?? 100, 100));
  let buyersBase = 40;

  const days: SalesDay[] = dates.map((d, i) => {
    // gentle seasonality + noise
    const wave = Math.sin(i / 3.2) * 0.25 + 0.85;
    const orders = Math.max(8, Math.round((18 + (i % 5) * 3) * wave));
    buyersBase = Math.max(18, buyersBase + (i % 2 === 0 ? 1 : -1));
    const buyers = Math.max(10, Math.round(buyersBase * wave));
    const avg = 52000 + Math.round(14000 * Math.sin(i / 2.8)); // cents
    const revenue = Math.max(0, orders * avg);
    const cashbackCoins = Math.round((revenue / 100) * 0.06); // fake
    const redeemCoins = Math.round((revenue / 100) * 0.045); // fake
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
    repeat_rate: 0.36 + (Math.sin(days.length / 4) * 0.05),
    cashback_issued_coins: days.reduce((s, x) => s + x.cashback_coins, 0),
    redeem_confirmed_coins: days.reduce((s, x) => s + x.redeem_coins, 0),
    pending_confirms: Math.round(3 + (days.length % 4)),
    cancel_rate: 0.06 + (Math.sin(days.length / 3) * 0.01),
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

/* ====== Collapsible ====== */

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

/* ====== Page ====== */

export default function Sales() {
  const { appId, range, setRange }: any = useAppState();

  // tabs under chart
  const [tab, setTab] = React.useState<'summary' | 'funnel' | 'cashiers' | 'customers' | 'live'>('summary');

  // quick range (same UX as Wheel)
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // collapsibles
  const [openKpi, setOpenKpi] = React.useState(true);
  const [openInsights, setOpenInsights] = React.useState(true);
  const [openTop, setOpenTop] = React.useState(true);

  // cost basis toggle (в Sales тоже пригодится: net от confirmed vs issued — потом)
  const [basis, setBasis] = React.useState<'confirmed' | 'issued'>('confirmed');

  // settings draft (UI only, later from worker)
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
    if (kind === 'day') {
      applyRange(anchor, anchor);
      return;
    }
    if (kind === 'week') {
      applyRange(isoAddDays(anchor, -6), anchor);
      return;
    }
    if (kind === 'month') {
      applyRange(isoAddDays(anchor, -29), anchor);
      return;
    }
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

  // ===== queries (placeholder, but “дорого” даже в loading)
  const qAll = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['sales_mock', appId, range?.from, range?.to, settings.currency, settings.coin_value_cents],
    queryFn: async () => {
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

    if (totals.net >= 0) {
      out.push({
        tone: 'good',
        title: 'Net эффект положительный',
        body: `Списание покрывает кэшбэк: ${moneyFromCent(totals.net, currency)} за период.`,
        dev: 'DEV: net = redeem_confirmed_coins*coin_value - cashback_issued_coins*coin_value',
      });
    } else {
      out.push({
        tone: 'warn',
        title: 'Net эффект отрицательный',
        body: `Кэшбэк “тяжелее” списаний: ${moneyFromCent(totals.net, currency)}. Подумай о промо на списание / правилах.`,
        dev: 'DEV: позже добавим переключатель basis=issued/confirmed и разнесём статусы',
      });
    }

    if (totals.pending > 0) {
      out.push({
        tone: totals.pending >= 6 ? 'bad' : 'warn',
        title: 'Есть зависшие подтверждения',
        body: `Сейчас зависло: ~${totals.pending}. Это бьёт по доверию (клиент не видит результат).`,
        dev: 'DEV: нужно sales_events + авто-напоминания кассиру',
      });
    }

    if (totals.repeat >= 0.35) {
      out.push({
        tone: 'good',
        title: 'Повторяемость норм',
        body: `Repeat rate: ${fmtPct(totals.repeat)}. Можно аккуратно повышать списания без потери маржи.`,
        dev: 'DEV: repeat_rate считать по customer_tg_id: repeat / total_unique',
      });
    } else {
      out.push({
        tone: 'warn',
        title: 'Повторяемость можно поднять',
        body: `Repeat rate: ${fmtPct(totals.repeat)}. Дай “сладкий” повод вернуться: авто-пуш “у вас накопилось N монет”.`,
        dev: 'DEV: сегменты клиентов + cron рассылка',
      });
    }

    return out.slice(0, 4);
  }, [totals.net, totals.pending, totals.repeat, currency]);

  const topCashiers = [...cashiers]
    .sort((a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0))
    .slice(0, 6);

  const topCustomers = [...customers]
    .sort((a, b) => (b.ltv_cents || 0) - (a.ltv_cents || 0))
    .slice(0, 6);

  /** ===== улучшение графика: как в колесе, без cumulative ===== */
  const chartData = React.useMemo(() => {
    // basis пока UI-only: структура готова
    // позже ты просто начнёшь отдавать net_cents_confirmed / net_cents_issued с бэка
    return (days || []).map((d: SalesDay) => ({
      ...d,
      net_for_chart: Number(d.net_cents) || 0,
      revenue_for_chart: Number(d.revenue_cents) || 0,
      orders_for_chart: Number(d.orders) || 0,
    }));
  }, [days]);

  const moneyDomain = React.useMemo<[number, number]>(() => {
    const vals: number[] = [];
    for (const r of chartData) {
      vals.push(Number(r.revenue_for_chart));
      vals.push(Number(r.net_for_chart));
    }
    return domainFrom(vals, 0.12);
  }, [chartData]);

  const ordersDomain = React.useMemo<[number, number]>(() => {
    const vals = chartData.map((r) => Number(r.orders_for_chart) || 0);
    const max = Math.max(1, ...vals);
    return [0, Math.ceil(max * 1.18)];
  }, [chartData]);

  return (
    <div className="sg-page salesPage">
      <style>{`
:root{
  --sg-r-xl: 18px;
  --sg-r-lg: 16px;
  --sg-r-md: 14px;
  --sg-r-sm: 12px;
  --sg-r-xs: 10px;

  --sg-bd: rgba(15,23,42,.10);
  --sg-bd2: rgba(15,23,42,.08);

  --sg-bg: rgba(255,255,255,.62);
  --sg-bg2: rgba(255,255,255,.78);
  --sg-bg3: rgba(15,23,42,.03);

  --sg-sh1: 0 10px 24px rgba(15,23,42,.06);
  --sg-sh2: 0 16px 46px rgba(15,23,42,.10);
  --sg-in1: inset 0 1px 0 rgba(255,255,255,.56);

  --sg-ok-bg: rgba(34,197,94,.10);
  --sg-ok-bd: rgba(34,197,94,.20);

  --sg-warn-bg: rgba(245,158,11,.10);
  --sg-warn-bd: rgba(245,158,11,.22);

  --sg-bad-bg: rgba(239,68,68,.09);
  --sg-bad-bd: rgba(239,68,68,.20);

  /* “дорогой” glow — очень мягкий, без дешёвой кислотности */
  --sg-glow: 0 0 0 1px rgba(15,23,42,.08), 0 18px 42px rgba(15,23,42,.10);
}

.salesPage .wheelHead{ display:flex; gap:14px; align-items:flex-start; }
.salesPage .sg-h1{ margin:0; }
.salesPage .sg-sub{ opacity:.78; margin-top:6px; }

.salesQuickWrap{
  display:flex; align-items:center; gap:0; flex-wrap:nowrap;
  height:46px; box-sizing:border-box;
  border:1px solid rgba(15,23,42,.12);
  border-radius:12px;
  background:rgba(255,255,255,.60);
  overflow:hidden;
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
  background:rgba(255,255,255,.90);
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
  background: var(--sg-bg2) !important;
  box-shadow: var(--sg-in1) !important;
  overflow: hidden;
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
  height:320px;
}
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
  background: var(--sg-bg);
  box-shadow: var(--sg-sh1), var(--sg-in1);
  padding:14px;
}

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
  background: rgba(255,255,255,.72);
  border-radius: var(--sg-r-lg);
  padding:12px 12px;
  box-shadow: var(--sg-in1);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
  text-align:left;
}
.salesTile:hover{
  transform: translateY(-1px);
  box-shadow: var(--sg-glow), var(--sg-in1);
  border-color: rgba(15,23,42,.12);
}
.salesTile:active{
  transform: translateY(0px) scale(.995);
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

/* expensive row */
.sgRow{
  position:relative;
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:10px;
  padding:10px 10px;
  border-radius: var(--sg-r-md);
  border:1px solid rgba(15,23,42,.07);
  background: rgba(255,255,255,.60);
  box-shadow: var(--sg-in1);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
}
.sgRow:hover{
  transform: translateY(-1px);
  box-shadow: var(--sg-sh1), var(--sg-in1);
  border-color: rgba(15,23,42,.12);
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

/* alert dot (top-right) */
.sgAlertDot{
  width:22px; height:22px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(239,68,68,.26);
  background: rgba(239,68,68,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 12px 24px rgba(15,23,42,.10);
}
.sgAlertDot__bang{
  font-weight:1000;
  font-size:14px;
  line-height:1;
  color: rgba(239,68,68,.95);
}

/* tooltips (hover only, no sticky) */
.sgTip{
  position:relative;
  display:inline-flex;
  width:18px;
  height:18px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.12);
  background:rgba(255,255,255,.86);
  opacity:.85;
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
  background: rgba(255,255,255,.70);
  box-shadow: var(--sg-in1);
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

/* Right sidebar sticky */
.salesRightSticky{
  position: sticky;
  top: 10px;
}

/* Segmented tabs */
.salesSeg{
  display:inline-flex;
  gap:8px;
  padding:4px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.08);
  background:rgba(255,255,255,.55);
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
  box-shadow:0 12px 22px rgba(15,23,42,.06), var(--sg-in1);
  opacity:1;
}

/* Switch (premium) */
.sgSwitch{
  width:64px;
  height:28px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.10);
  background:rgba(15,23,42,.05);
  position:relative;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:flex-start;
  padding:0 5px;
  box-shadow:0 1px 0 rgba(15,23,42,.03);
  transition: background .12s ease, border-color .12s ease, opacity .12s ease, filter .12s ease;
}
.sgSwitch.is-on{
  background:rgba(34,197,94,.18);
  border-color:rgba(34,197,94,.22);
  justify-content:flex-end;
  filter:saturate(1.05);
}
.sgSwitch.is-off{
  background:rgba(239,68,68,.06);
  border-color:rgba(239,68,68,.12);
  filter:saturate(.92);
}
.sgSwitch.is-disabled{ opacity:.45; cursor:not-allowed; }
.sgSwitch__knob{
  width:18px;
  height:18px;
  border-radius:999px;
  background:#fff;
  border:1px solid rgba(15,23,42,.12);
  box-shadow:0 8px 16px rgba(15,23,42,.10);
}
      `}</style>

      {/* ===== HEAD ===== */}
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Продажи (QR)</h1>
          <div className="sg-sub">
            Премиум-кабинет в стиле “Колеса”. Сейчас данные — mock (для дизайна). Потом подключим воркер.
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
          <Card className="salesCard">
            <div className="salesCardHead">
              <div>
                <div className="salesTitle">
                  Факт: выручка / net эффект
                  <span style={{ marginLeft: 10 }}>
                    <Tip
                      dev
                      text="DEV: сюда потом подтянем /sales/timeseries. Сейчас mock."
                    />
                  </span>
                </div>
                <div className="salesSub">{range?.from} — {range?.to}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div className="salesSeg" role="tablist" aria-label="basis">
                  <button
                    type="button"
                    className={'salesSegBtn ' + (basis === 'confirmed' ? 'is-active' : '')}
                    onClick={() => setBasis('confirmed')}
                    title="Net по подтверждённым операциям"
                  >
                    confirmed
                  </button>
                  <button
                    type="button"
                    className={'salesSegBtn ' + (basis === 'issued' ? 'is-active' : '')}
                    onClick={() => setBasis('issued')}
                    title="Net по выданным (issued) — позже"
                  >
                    issued
                  </button>
                </div>

                {primaryAlert ? <AlertDot title={primaryAlert.title} /> : null}
              </div>
            </div>

            {/* ===== CHART (улучшен) ===== */}
            <div className="salesChartWrap">
              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                    />

                    {/* Деньги — слева (единственная денежная шкала, без cumulative) */}
                    <YAxis
                      yAxisId="money"
                      domain={moneyDomain as any}
                      tick={{ fontSize: 12 }}
                      width={72}
                      tickFormatter={(v: any) => compactMoneyTickFromCents(v, currency)}
                    />

                    {/* Кол-во заказов — справа (как в колесе: отдельная шкала, не мешает деньгам) */}
                    <YAxis
                      yAxisId="count"
                      orientation="right"
                      domain={ordersDomain as any}
                      tick={{ fontSize: 12 }}
                      width={44}
                      tickFormatter={(v: any) => String(Math.round(Number(v) || 0))}
                    />

                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'revenue_for_chart') return [moneyFromCent(val, currency), 'Выручка/день'];
                        if (name === 'net_for_chart') return [moneyFromCent(val, currency), 'Net/день'];
                        if (name === 'orders_for_chart') return [val, 'Заказы/день'];
                        return [val, name];
                      }}
                      labelFormatter={(_: any, payload: any) => {
                        const d = payload?.[0]?.payload?.date;
                        return d ? `Дата ${d}` : 'Дата';
                      }}
                    />

                    {/* Area: Revenue (цвета как у тебя) */}
                    <Area
                      yAxisId="money"
                      type="monotone"
                      dataKey="revenue_for_chart"
                      name="revenue_for_chart"
                      stroke="var(--accent2)"
                      fill="var(--accent)"
                      fillOpacity={0.10}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Line: Net (цвет как у тебя, пунктир) */}
                    <Line
                      yAxisId="money"
                      type="monotone"
                      dataKey="net_for_chart"
                      name="net_for_chart"
                      stroke="var(--accent2)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Cylinders: Orders (на count-оси, чтобы не ломать деньги) */}
                    <Bar
                      yAxisId="count"
                      dataKey="orders_for_chart"
                      name="orders_for_chart"
                      fill="var(--accent)"
                      fillOpacity={0.18}
                      radius={[10, 10, 10, 10]}
                      isAnimationActive={false}
                    />
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

            {/* UNDER TABS */}
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
                  <div className="sg-muted">наведи на строки — подсветка + lift</div>
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
                      <div className="sgRow" key={c.cashier_label}>
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
                      <div className="sgRow" key={c.customer_label}>
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
            <Card className="salesCard" style={{ marginBottom: 12 }}>
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
                            <span className="sg-muted">Дорогая подсветка — без кислотных цветов</span>
                            <span style={{ marginLeft: 8 }}><Tip dev text="DEV: алерты рассчитывать на бэке и отдавать массивом" /></span>
                          </div>
                        </div>
                      </div>
                      <div className="sgRowRight">
                        <div className="sgRowVal">{alerts.length}</div>
                        <div className="sgRowSub">{alerts.length ? 'внимание' : 'ok'}</div>
                      </div>
                    </div>

                    {alerts.length ? alerts.slice(0, 4).map((a) => (
                      <div className="sgRow" key={a.key}>
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
            <Card className="salesCard">
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
