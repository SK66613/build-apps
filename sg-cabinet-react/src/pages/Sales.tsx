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
 * - график: Area + Line(штрих) + Bar(цилиндры) + overlay controls
 * - без “лишних” осей/кумулятивов (только дневные значения)
 *
 * PREMIUM (встроено справа):
 * - tiers (прогрессивный cashback)
 * - ranks (ранги по покупкам/выручке)
 * - alerts (правила тревог + мягкие подсветки)
 * - automation (авто-напоминания/сценарии)
 *
 * DEV: сейчас данные mock, конфиг хранится локально (localStorage), структура 1:1 под будущий воркер.
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

function toNum(v: any, d = 0) {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : d;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
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
  const x = Math.round(v / 100);
  const ax = Math.abs(x);
  if (ax >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (ax >= 10_000) return `${(x / 1000).toFixed(0)}k`;
  return String(x);
}

/* ===== Premium helpers (health/alerts) ===== */

type HealthTone = 'good' | 'warn' | 'bad';
type AlertItem = { key: string; title: string; sev: 'warn' | 'bad' };

function toneFromAlerts(alerts: AlertItem[]): HealthTone {
  const hasBad = alerts.some((a) => a.sev === 'bad');
  if (hasBad) return 'bad';
  const hasWarn = alerts.length > 0;
  if (hasWarn) return 'warn';
  return 'good';
}

function joinAlertTitles(alerts: AlertItem[], max = 3) {
  if (!alerts.length) return 'Всё хорошо — критичных отклонений нет.';
  const list = alerts.slice(0, max).map((a) => a.title);
  const tail = alerts.length > max ? ` (+${alerts.length - max})` : '';
  return list.join(' / ') + tail;
}

function HealthBadge({
  tone,
  title,
  compact,
}: {
  tone: HealthTone;
  title: string;
  compact?: boolean;
}) {
  const cls =
    'sgHealthBadge ' +
    (tone === 'bad' ? 'is-bad' : tone === 'warn' ? 'is-warn' : 'is-good') +
    (compact ? ' is-compact' : '');
  const icon = tone === 'bad' ? '!' : tone === 'warn' ? '!' : '✓';
  const label = tone === 'bad' ? 'alert' : tone === 'warn' ? 'warn' : 'ok';

  return (
    <button type="button" className={cls} title={title} aria-label={title}>
      <span className="sgHealthBadge__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sgHealthBadge__txt">{label}</span>
    </button>
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

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className={'sgToggle ' + (checked ? 'is-on' : 'is-off')}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      title={hint || label}
    >
      <span className="sgToggle__track">
        <span className="sgToggle__thumb" />
      </span>
      <span className="sgToggle__lbl">{label}</span>
    </button>
  );
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/* ===== Premium config (local mock, 1:1 for future worker) ===== */

type CashbackTier = {
  id: string;
  enabled: boolean;
  title: string; // e.g. “VIP”
  min_orders_lifetime?: number | null; // gate by lifetime orders
  min_revenue_cents_lifetime?: number | null; // gate by lifetime revenue
  cashback_pct: number; // percent, e.g. 3.5
  cap_coins_per_day?: number | null; // optional cap
  note?: string;
};

type RankRule = {
  id: string;
  enabled: boolean;
  title: string; // e.g. “Бронза”
  min_orders_lifetime: number;
  badge_emoji?: string;
  perks_note?: string;
};

type AlertRule = {
  id: string;
  enabled: boolean;
  key: 'pending_confirms' | 'cancel_rate' | 'repeat_rate' | 'net_negative' | 'slow_confirm';
  warn_threshold: number; // meaning depends on key
  bad_threshold: number; // meaning depends on key
  note?: string;
};

type AutomationRule = {
  id: string;
  enabled: boolean;
  key:
    | 'remind_pending_cashier'
    | 'remind_customer_spend'
    | 'vip_thanks'
    | 'reactivate_saver';
  when: 'hourly' | 'daily' | 'weekly';
  cooldown_minutes: number;
  template_ru: string;
  note?: string;
};

type SalesPremiumConfig = {
  version: number;
  coin_value_cents: number;
  currency: 'RUB' | 'USD' | 'EUR';

  tiers: CashbackTier[];
  ranks: RankRule[];
  alerts: AlertRule[];
  automation: AutomationRule[];

  updated_at: string; // ISO
};

function defaultPremiumConfig(currency: 'RUB' | 'USD' | 'EUR', coinValueCents: number): SalesPremiumConfig {
  return {
    version: 1,
    currency,
    coin_value_cents: Math.max(1, Math.floor(coinValueCents || 100)),
    tiers: [
      {
        id: uid('tier'),
        enabled: true,
        title: 'Base',
        min_orders_lifetime: null,
        min_revenue_cents_lifetime: null,
        cashback_pct: 2.5,
        cap_coins_per_day: null,
        note: 'Базовый кэшбэк для всех.',
      },
      {
        id: uid('tier'),
        enabled: true,
        title: 'VIP',
        min_orders_lifetime: 8,
        min_revenue_cents_lifetime: null,
        cashback_pct: 4.0,
        cap_coins_per_day: null,
        note: 'Повышаем % тем, кто часто покупает.',
      },
    ],
    ranks: [
      { id: uid('rank'), enabled: true, title: 'Бронза', min_orders_lifetime: 3, badge_emoji: '🥉', perks_note: 'Стикер + чуть выше кэшбэк' },
      { id: uid('rank'), enabled: true, title: 'Серебро', min_orders_lifetime: 7, badge_emoji: '🥈', perks_note: 'Ранний доступ к акциям' },
      { id: uid('rank'), enabled: true, title: 'Золото', min_orders_lifetime: 12, badge_emoji: '🥇', perks_note: 'VIP бонусы / приглашения' },
    ],
    alerts: [
      { id: uid('al'), enabled: true, key: 'pending_confirms', warn_threshold: 4, bad_threshold: 8, note: 'Шумит, если касса не подтверждает.' },
      { id: uid('al'), enabled: true, key: 'cancel_rate', warn_threshold: 0.08, bad_threshold: 0.12, note: 'Отмены выше нормы.' },
      { id: uid('al'), enabled: true, key: 'repeat_rate', warn_threshold: 0.22, bad_threshold: 0.16, note: 'Низкая повторяемость.' },
      { id: uid('al'), enabled: true, key: 'net_negative', warn_threshold: 0, bad_threshold: -1, note: 'Net отрицательный.' },
    ],
    automation: [
      {
        id: uid('au'),
        enabled: true,
        key: 'remind_pending_cashier',
        when: 'hourly',
        cooldown_minutes: 60,
        template_ru: 'Есть неподтверждённые операции. Проверь кассу и нажми “подтвердить/отменить”.',
        note: 'Пинг кассирам, если висит pending.',
      },
      {
        id: uid('au'),
        enabled: true,
        key: 'remind_customer_spend',
        when: 'daily',
        cooldown_minutes: 24 * 60,
        template_ru: 'У вас накопилось {coins} монет — можно списать на скидку сегодня 🙂',
        note: 'Пуш “накопил — потрать”.',
      },
    ],
    updated_at: new Date().toISOString(),
  };
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  try {
    if (!s) return fallback;
    const v = JSON.parse(s);
    return (v ?? fallback) as T;
  } catch (_) {
    return fallback;
  }
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
    buyers: Math.max(
      1,
      Math.round(days.reduce((s, x) => s + x.buyers, 0) / Math.max(1, days.length)),
    ),
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
    {
      customer_label: 'Покупатель A',
      orders: 7,
      revenue_cents: 410000,
      ltv_cents: 690000,
      last_seen: dates[dates.length - 1],
      segment: 'repeat',
    },
    {
      customer_label: 'Покупатель B',
      orders: 1,
      revenue_cents: 58000,
      ltv_cents: 58000,
      last_seen: dates[Math.max(0, dates.length - 2)],
      segment: 'new',
    },
    {
      customer_label: 'Покупатель C',
      orders: 5,
      revenue_cents: 260000,
      ltv_cents: 510000,
      last_seen: dates[Math.max(0, dates.length - 3)],
      segment: 'spender',
    },
    {
      customer_label: 'Покупатель D',
      orders: 4,
      revenue_cents: 210000,
      ltv_cents: 420000,
      last_seen: dates[Math.max(0, dates.length - 6)],
      segment: 'saver',
    },
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
  healthTone,
  healthTitle,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  healthTone?: HealthTone;
  healthTitle?: string;
}) {
  const toneCls =
    healthTone === 'bad'
      ? ' is-bad'
      : healthTone === 'warn'
        ? ' is-warn'
        : healthTone === 'good'
          ? ' is-good'
          : '';
  return (
    <div className={'sgColl ' + (open ? 'is-open' : 'is-closed') + toneCls}>
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
          {healthTone ? (
            <HealthBadge tone={healthTone} title={healthTitle || ''} compact />
          ) : null}
        </div>
      </button>
      <div className="sgColl__body">{children}</div>
    </div>
  );
}

/* ===== Premium mapping helpers ===== */

function alertKeyLabel(key: AlertRule['key']) {
  if (key === 'pending_confirms') return 'Pending подтверждения';
  if (key === 'cancel_rate') return 'Cancel rate';
  if (key === 'repeat_rate') return 'Repeat rate';
  if (key === 'net_negative') return 'Net ниже 0';
  if (key === 'slow_confirm') return 'Долгое подтверждение';
  return key;
}
function alertKeyHint(key: AlertRule['key']) {
  if (key === 'pending_confirms') return 'Сработает, если много неподтверждённых операций.';
  if (key === 'cancel_rate') return 'Сработает, если много отмен в кассе.';
  if (key === 'repeat_rate') return 'Сработает, если клиенты не возвращаются.';
  if (key === 'net_negative') return 'Сработает, если Net (списание − кэшбэк) уходит в минус.';
  if (key === 'slow_confirm') return 'Сработает, если median подтверждения > порога.';
  return '';
}
function alertUnit(key: AlertRule['key']) {
  if (key === 'cancel_rate') return 'доля (0..1)';
  if (key === 'repeat_rate') return 'доля (0..1)';
  if (key === 'pending_confirms') return 'шт';
  if (key === 'slow_confirm') return 'мин';
  if (key === 'net_negative') return 'cents';
  return '';
}

function automationKeyLabel(key: AutomationRule['key']) {
  if (key === 'remind_pending_cashier') return 'Напоминать кассиру про pending';
  if (key === 'remind_customer_spend') return 'Пуш “потрать монеты”';
  if (key === 'vip_thanks') return 'Спасибо VIP после покупки';
  if (key === 'reactivate_saver') return 'Реактивация “накопил и молчит”';
  return key;
}

function whenLabel(w: AutomationRule['when']) {
  if (w === 'hourly') return 'каждый час';
  if (w === 'daily') return 'ежедневно';
  if (w === 'weekly') return 'еженедельно';
  return w;
}

/* ===== Page ===== */

export default function Sales() {
  const { appId, range, setRange }: any = useAppState();

  const [tab, setTab] = React.useState<'summary' | 'funnel' | 'cashiers' | 'customers' | 'live'>(
    'summary',
  );

  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  const [openKpi, setOpenKpi] = React.useState(true);
  const [openInsights, setOpenInsights] = React.useState(true);
  const [openTop, setOpenTop] = React.useState(true);

  // как в wheel: confirmed/issued
  const [basis, setBasis] = React.useState<'confirmed' | 'issued'>('confirmed');

  // overlay кнопки “как в колесе” (3 штуки)
  const [showBars, setShowBars] = React.useState(true);
  const [showNet, setShowNet] = React.useState(true);
  const [showArea, setShowArea] = React.useState(true);

  // settings draft (UI only)
  const [currencyDraft, setCurrencyDraft] = React.useState<'RUB' | 'USD' | 'EUR'>('RUB');
  const [coinValueDraft, setCoinValueDraft] = React.useState('1.00');

  // PREMIUM panel state
  const [premiumTab, setPremiumTab] = React.useState<'tiers' | 'ranks' | 'alerts' | 'automation'>(
    'tiers',
  );
  const [premiumCfg, setPremiumCfg] = React.useState<SalesPremiumConfig | null>(null);
  const [premiumDirty, setPremiumDirty] = React.useState(false);

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
    queryKey: [
      'sales_mock',
      appId,
      range?.from,
      range?.to,
      settings.currency,
      settings.coin_value_cents,
      basis,
    ],
    queryFn: async () => {
      // позже:
      // const kpi = await apiFetch(`/api/cabinet/apps/${appId}/sales/kpi?${qs(range)}`);
      // const ts  = await apiFetch(`/api/cabinet/apps/${appId}/sales/timeseries?${qs(range)}`);
      // basis учитывать на бэке
      return mkMock(range as SalesRange, settings);
    },
    staleTime: 10_000,
  });

  const isLoading = qAll.isLoading;
  const isError = qAll.isError;

  const data = qAll.data;
  const currency = String(data?.settings?.currency || settings.currency || 'RUB').toUpperCase() as
    | 'RUB'
    | 'USD'
    | 'EUR';
  const coinCents = Math.max(
    1,
    toInt(data?.settings?.coin_value_cents ?? settings.coin_value_cents ?? 100, 100),
  );

  // init/load premium config (localStorage) — structure matches future worker payload
  React.useEffect(() => {
    const key = `sg_sales_premium_cfg:${String(appId || 'noapp')}`;
    const fallback = defaultPremiumConfig(currencyDraft, coinCents);
    const stored = safeJsonParse<SalesPremiumConfig>(localStorage.getItem(key), fallback);

    // keep currency/coin in sync with UI draft if config is empty
    const next: SalesPremiumConfig = {
      ...stored,
      currency: stored.currency || currencyDraft,
      coin_value_cents: Number.isFinite(stored.coin_value_cents)
        ? stored.coin_value_cents
        : Math.max(1, coinCents),
      updated_at: stored.updated_at || new Date().toISOString(),
    };

    setPremiumCfg(next);
    setPremiumDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

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

  // === alerts computed from metrics (later: backend) + “premium rules” override thresholds
  const computedAlerts: AlertItem[] = React.useMemo(() => {
    const out: AlertItem[] = [];

    // baseline defaults (если premiumCfg ещё не готов)
    const ruleByKey = new Map<AlertRule['key'], AlertRule>();
    (premiumCfg?.alerts || []).forEach((r) => {
      if (r.enabled) ruleByKey.set(r.key, r);
    });

    function pickThresholds(
      key: AlertRule['key'],
      defWarn: number,
      defBad: number,
    ): { warn: number; bad: number } {
      const r = ruleByKey.get(key);
      if (!r) return { warn: defWarn, bad: defBad };
      return { warn: Number(r.warn_threshold), bad: Number(r.bad_threshold) };
    }

    // pending confirms
    {
      const t = pickThresholds('pending_confirms', 4, 8);
      if (totals.pending >= t.bad) out.push({ key: 'pending', title: 'Много неподтверждённых операций', sev: 'bad' });
      else if (totals.pending >= t.warn) out.push({ key: 'pending', title: 'Есть неподтверждённые операции', sev: 'warn' });
    }

    // cancel rate
    {
      const t = pickThresholds('cancel_rate', 0.08, 0.12);
      if (totals.cancelRate >= t.bad) out.push({ key: 'cancel', title: 'Высокий процент отмен', sev: 'bad' });
      else if (totals.cancelRate >= t.warn) out.push({ key: 'cancel', title: 'Отмены выше нормы', sev: 'warn' });
    }

    // repeat rate (тут “ниже — хуже”, поэтому пороги инвертируем по смыслу)
    {
      const r = ruleByKey.get('repeat_rate');
      const warn = r ? Number(r.warn_threshold) : 0.22;
      const bad = r ? Number(r.bad_threshold) : 0.16;
      if (totals.orders > 20 && totals.repeat <= bad) out.push({ key: 'repeat', title: 'Очень низкая повторяемость', sev: 'bad' });
      else if (totals.orders > 20 && totals.repeat <= warn) out.push({ key: 'repeat', title: 'Низкая повторяемость', sev: 'warn' });
    }

    // net negative
    {
      const r = ruleByKey.get('net_negative');
      const warn = r ? Number(r.warn_threshold) : 0; // если ниже 0 — warn
      const bad = r ? Number(r.bad_threshold) : -1; // если ниже -1 (любой минус) — bad по умолчанию
      // по смыслу: warn_threshold обычно 0, bad_threshold обычно -1 (то есть <0)
      if (totals.net < warn && totals.net < bad) out.push({ key: 'net', title: 'Net ушёл в минус', sev: 'bad' });
      else if (totals.net < warn) out.push({ key: 'net', title: 'Net отрицательный', sev: 'warn' });
    }

    return out;
  }, [totals.pending, totals.cancelRate, totals.repeat, totals.orders, totals.net, premiumCfg?.alerts]);

  const healthTone: HealthTone = React.useMemo(() => toneFromAlerts(computedAlerts), [computedAlerts]);
  const healthTitle = React.useMemo(() => joinAlertTitles(computedAlerts, 4), [computedAlerts]);

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

    // premium hint: progressive tiers present?
    const tiersOn = (premiumCfg?.tiers || []).filter((t) => t.enabled).length;
    out.push({
      tone: tiersOn >= 2 ? 'good' : 'warn',
      title: tiersOn >= 2 ? 'Есть прогрессивные уровни кэшбэка' : 'Добавь VIP-уровень (tiers)',
      body:
        tiersOn >= 2
          ? `Уровней активных: ${tiersOn}. Это повышает retention — клиент “копит” до следующего ранга.`
          : 'Сделай минимум 2 уровня: Base и VIP (по кол-ву покупок). Это хорошо продаётся как “премиум-автоматизация”.',
    });

    return out.slice(0, 4);
  }, [totals.net, totals.pending, totals.repeat, currency, premiumCfg?.tiers]);

  const topCashiers = [...cashiers]
    .sort((a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0))
    .slice(0, 6);

  const topCustomers = [...customers]
    .sort((a, b) => (b.ltv_cents || 0) - (a.ltv_cents || 0))
    .slice(0, 6);

  const chartData = React.useMemo(() => {
    return (days || []).map((d: SalesDay) => ({
      ...d,
      orders_count: d.orders,
    }));
  }, [days]);

  const cardToneCls =
    healthTone === 'bad' ? 'is-health-bad' : healthTone === 'warn' ? 'is-health-warn' : 'is-health-good';

  // ===== Premium mutations =====
  function patchPremium(next: SalesPremiumConfig) {
    setPremiumCfg(next);
    setPremiumDirty(true);
  }

  function savePremium() {
    if (!premiumCfg) return;
    const key = `sg_sales_premium_cfg:${String(appId || 'noapp')}`;
    const next: SalesPremiumConfig = { ...premiumCfg, updated_at: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(next));
    setPremiumCfg(next);
    setPremiumDirty(false);
  }

  function resetPremium() {
    const next = defaultPremiumConfig(currencyDraft, coinCents);
    patchPremium(next);
  }

  function exportPremium(): string {
    try {
      return JSON.stringify(premiumCfg, null, 2);
    } catch (_) {
      return '';
    }
  }

  function importPremiumJson(s: string) {
    try {
      const v = JSON.parse(String(s || ''));
      if (!v || typeof v !== 'object') return;
      patchPremium(v as SalesPremiumConfig);
    } catch (_) {
      // no-op
    }
  }

  // ===== Derived previews for premium =====
  const premiumPreview = React.useMemo(() => {
    const cfg = premiumCfg;
    if (!cfg) return { activeTiers: 0, activeRanks: 0, activeAlerts: 0, activeAutomation: 0 };

    return {
      activeTiers: cfg.tiers.filter((t) => t.enabled).length,
      activeRanks: cfg.ranks.filter((t) => t.enabled).length,
      activeAlerts: cfg.alerts.filter((t) => t.enabled).length,
      activeAutomation: cfg.automation.filter((t) => t.enabled).length,
    };
  }, [premiumCfg]);

  const premiumHealthTone: HealthTone = React.useMemo(() => {
    // “здоровье конфигурации” — чтобы продавать премиум: если мало правил — warn.
    const cfg = premiumCfg;
    if (!cfg) return 'warn';
    const tiers = cfg.tiers.filter((t) => t.enabled).length;
    const auto = cfg.automation.filter((a) => a.enabled).length;

    if (tiers >= 2 && auto >= 1) return 'good';
    if (tiers >= 1) return 'warn';
    return 'bad';
  }, [premiumCfg]);

  const premiumHealthTitle = React.useMemo(() => {
    if (!premiumCfg) return 'Конфиг не загружен';
    if (premiumHealthTone === 'good') return 'Premium настроен: tiers + automation активны';
    if (premiumHealthTone === 'warn') return 'Можно усилить: добавь ещё tier или включи automation';
    return 'Premium почти пустой: включи хотя бы Base tier';
  }, [premiumCfg, premiumHealthTone]);

  return (
    <div className="sg-page salesPage">
      <style>{`
:root{
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

  --sg-warnTint: rgba(245,158,11,.08);
  --sg-warnBd: rgba(245,158,11,.18);

  --sg-dangerTint: rgba(239,68,68,.08);
  --sg-dangerBd: rgba(239,68,68,.18);

  --sg-goodTint: rgba(34,197,94,.08);
  --sg-goodBd: rgba(34,197,94,.18);

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

/* Health tint on cards */
.salesCard.is-health-good{ border-color: var(--sg-goodBd) !important; background: linear-gradient(0deg, var(--sg-goodTint), rgba(255,255,255,.90)) !important; }
.salesCard.is-health-warn{ border-color: var(--sg-warnBd) !important; background: linear-gradient(0deg, var(--sg-warnTint), rgba(255,255,255,.90)) !important; }
.salesCard.is-health-bad{ border-color: var(--sg-dangerBd) !important; background: linear-gradient(0deg, var(--sg-dangerTint), rgba(255,255,255,.90)) !important; }

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
  height: 340px;
}
@media (max-width: 1100px){
  .salesChartWrap{ height: 320px; }
}

/* overlay controls */
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

/* Rows */
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
.sgRow.is-warn{
  border-color: var(--sg-warnBd) !important;
  background: linear-gradient(0deg, var(--sg-warnTint), rgba(255,255,255,.86)) !important;
}
.sgRow.is-bad{
  border-color: var(--sg-dangerBd) !important;
  background: linear-gradient(0deg, var(--sg-dangerTint), rgba(255,255,255,.86)) !important;
}
.sgRow.is-good{
  border-color: var(--sg-goodBd) !important;
  background: linear-gradient(0deg, var(--sg-goodTint), rgba(255,255,255,.86)) !important;
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
.sgColl.is-good{ border-color: var(--sg-goodBd); }
.sgColl.is-warn{ border-color: var(--sg-warnBd); }
.sgColl.is-bad{ border-color: var(--sg-dangerBd); }

.sgColl.is-good .sgColl__head{ background: linear-gradient(90deg, var(--sg-goodTint), transparent 44%); }
.sgColl.is-warn .sgColl__head{ background: linear-gradient(90deg, var(--sg-warnTint), transparent 44%); }
.sgColl.is-bad .sgColl__head{ background: linear-gradient(90deg, var(--sg-dangerTint), transparent 44%); }

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
  max-height: 1600px;
  padding: 0 12px 12px 12px;
}

/* Health badge */
.sgHealthBadge{
  height:32px;
  padding:0 10px 0 8px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.78);
  box-shadow: var(--sg-in);
  display:inline-flex;
  align-items:center;
  gap:8px;
  cursor:default;
  user-select:none;
  font-weight:1000;
  font-size:12px;
  opacity:.96;
}
.sgHealthBadge.is-compact{
  height:28px;
  padding:0 8px 0 6px;
  border-radius:13px;
  font-size:11px;
}
.sgHealthBadge__icon{
  width:18px; height:18px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-weight:1100;
  line-height:1;
}
.sgHealthBadge__txt{ opacity:.86; text-transform:uppercase; letter-spacing:.08em; }

.sgHealthBadge.is-good{
  border-color: var(--sg-goodBd);
  background: rgba(255,255,255,.86);
}
.sgHealthBadge.is-good .sgHealthBadge__icon{
  border:1px solid var(--sg-goodBd);
  background: var(--sg-goodTint);
  color: rgba(22,163,74,.95);
}

.sgHealthBadge.is-warn{
  border-color: var(--sg-warnBd);
  background: rgba(255,255,255,.86);
}
.sgHealthBadge.is-warn .sgHealthBadge__icon{
  border:1px solid var(--sg-warnBd);
  background: var(--sg-warnTint);
  color: rgba(245,158,11,.95);
}

.sgHealthBadge.is-bad{
  border-color: var(--sg-dangerBd);
  background: rgba(255,255,255,.86);
}
.sgHealthBadge.is-bad .sgHealthBadge__icon{
  border:1px solid var(--sg-dangerBd);
  background: var(--sg-dangerTint);
  color: rgba(239,68,68,.95);
}

/* Right sticky */
.salesRightSticky{ position: sticky; top: 10px; }

/* Premium panel micro-UI */
.sgBtn{
  height:34px;
  padding:0 12px;
  border-radius:12px;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.90);
  box-shadow: var(--sg-in);
  cursor:pointer;
  font-weight:1000;
  font-size:12px;
}
.sgBtn:hover{ box-shadow: var(--sg-shadow), var(--sg-in); }
.sgBtn.is-primary{
  border-color: rgba(15,23,42,.16);
  background: rgba(15,23,42,.04);
}
.sgBtn:disabled{ opacity:.55; cursor:not-allowed; }

.sgMiniNote{
  font-size:12px;
  opacity:.78;
}

.sgInlineActions{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }

.sgDivider{
  height:1px;
  background: rgba(15,23,42,.10);
  margin:10px 0;
}

.sgToggle{
  display:inline-flex;
  align-items:center;
  gap:10px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.86);
  box-shadow: var(--sg-in);
  border-radius:14px;
  padding:6px 10px;
  cursor:pointer;
  font-weight:1000;
  font-size:12px;
  user-select:none;
}
.sgToggle__track{
  width:36px;
  height:20px;
  border-radius:999px;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(15,23,42,.06);
  position:relative;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.70);
}
.sgToggle__thumb{
  width:16px;
  height:16px;
  border-radius:999px;
  background: rgba(255,255,255,.96);
  border:1px solid rgba(15,23,42,.12);
  position:absolute;
  top:50%;
  transform: translateY(-50%);
  left:2px;
  transition: left .14s ease;
  box-shadow: 0 10px 20px rgba(15,23,42,.10);
}
.sgToggle.is-on .sgToggle__track{ background: rgba(34,197,94,.16); border-color: rgba(34,197,94,.22); }
.sgToggle.is-on .sgToggle__thumb{ left:18px; }
.sgToggle__lbl{ opacity:.92; }

.sgGridForm{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:10px;
}
@media (max-width:1100px){
  .sgGridForm{ grid-template-columns:1fr; }
}

.sgRowGrid{
  display:grid;
  grid-template-columns: 1.1fr .8fr .8fr .8fr auto;
  gap:8px;
  align-items:end;
}
@media (max-width:1100px){
  .sgRowGrid{ grid-template-columns:1fr 1fr; }
}

.sgFieldLbl{ font-size:12px; opacity:.78; font-weight:900; margin-bottom:6px; }
.sgTextArea{
  width:100%;
  min-height:80px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.96);
  box-shadow: var(--sg-in);
  font:inherit;
  font-weight:900;
  font-size:13px;
  resize:vertical;
}

.sgSmallIcon{
  width:34px;
  height:34px;
  border-radius:12px;
  border:1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.90);
  box-shadow: var(--sg-in);
  cursor:pointer;
}
.sgSmallIcon:hover{ box-shadow: var(--sg-shadow), var(--sg-in); }
.sgSmallIcon.is-danger{
  border-color: rgba(239,68,68,.20);
  background: rgba(239,68,68,.06);
}

      `}</style>

      {/* ===== HEAD ===== */}
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Продажи (QR)</h1>
          <div className="sg-sub">
            График/карточки — один стиль с Wheel. Сейчас данные — mock, конфиг Premium справа — локальный (под будущий воркер).
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
          <Card className={`salesCard salesCard--lift ${cardToneCls}`}>
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
                  <IconBtn title="Цилиндры (заказы)" active={showBars} onClick={() => setShowBars(v => !v)}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M8 15h8" stroke="currentColor" strokeWidth="2" opacity=".6" />
                    </svg>
                  </IconBtn>

                  <IconBtn title="Заливка (выручка)" active={showArea} onClick={() => setShowArea(v => !v)}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5 16c3-6 6 2 9-4s5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" opacity=".45" />
                    </svg>
                  </IconBtn>

                  <IconBtn title="П — Net (profit)" active={showNet} onClick={() => setShowNet(v => !v)}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M7 18V7h10v11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M9 10h6" stroke="currentColor" strokeWidth="2" opacity=".6" />
                    </svg>
                  </IconBtn>
                </div>

                <HealthBadge tone={healthTone} title={healthTitle} />
              </div>

              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 34, right: 18, left: 6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.22} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                    />

                    <YAxis
                      yAxisId="money"
                      tick={{ fontSize: 12 }}
                      width={54}
                      tickFormatter={(v: any) => niceMoneyTick(Number(v))}
                    />

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
                    <div className="salesTileLbl">Выручка <Tip text="Сумма чеков за период" /></div>
                    <div className="salesTileVal">{isLoading ? '—' : moneyFromCent(totals.rev, currency)}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={66} /> : <>в день: <b>{moneyFromCent(totals.revPerDay, currency)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">Заказы <Tip text="Количество продаж (recorded)" /></div>
                    <div className="salesTileVal">{isLoading ? '—' : totals.orders}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={58} /> : <>ср. чек: <b>{moneyFromCent(totals.avgCheck, currency)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">Покупатели <Tip text="Уникальные клиенты (приближ.)" /></div>
                    <div className="salesTileVal">{isLoading ? '—' : totals.buyers}</div>
                    <div className="salesTileSub">
                      {isLoading ? <ShimmerLine w={52} /> : <>repeat: <b>{fmtPct(totals.repeat)}</b></>}
                    </div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">Кэшбэк <Tip text="Начислено монет (issued)" /></div>
                    <div className="salesTileVal">{isLoading ? '—' : `${totals.cashbackCoins.toLocaleString('ru-RU')} мон`}</div>
                    <div className="salesTileSub">{isLoading ? <ShimmerLine w={64} /> : <>≈ <b>{moneyFromCent(totals.cashbackCent, currency)}</b></>}</div>
                  </div>

                  <div className="salesTile">
                    <div className="salesTileLbl">Net <Tip text="Списание(₽) − Кэшбэк(₽)" /></div>
                    <div className="salesTileVal">{isLoading ? '—' : moneyFromCent(totals.net, currency)}</div>
                    <div className="salesTileSub">{isLoading ? <ShimmerLine w={60} /> : <>списано: <b>{moneyFromCent(totals.redeemCent, currency)}</b></>}</div>
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <HealthBadge tone={healthTone} title={healthTitle} compact />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className={'sgRow ' + (totals.pending >= 6 ? 'is-bad' : totals.pending > 0 ? 'is-warn' : 'is-good')}>
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

                  <div className={'sgRow ' + (totals.cancelRate >= 0.12 ? 'is-bad' : totals.cancelRate >= 0.08 ? 'is-warn' : 'is-good')}>
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
                    <div className={'sgRow ' + ((funnel?.median_confirm_minutes ?? 0) > 6 ? 'is-warn' : 'is-good')}>
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
                  <div className="sg-muted">hover подсветка как “Склад”</div>
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
                    const tone: HealthTone =
                      c.cancel_rate >= 0.12 || c.confirm_rate <= 0.86
                        ? 'bad'
                        : c.cancel_rate >= 0.08 || c.confirm_rate <= 0.90
                          ? 'warn'
                          : 'good';

                    const tip = c.alerts?.length
                      ? c.alerts.join(' / ')
                      : tone === 'bad'
                        ? 'Риск: проверь отмены/подтверждения'
                        : tone === 'warn'
                          ? 'Есть отклонения — стоит проверить'
                          : 'Всё норм по метрикам';

                    return (
                      <div className={'sgRow ' + (tone === 'bad' ? 'is-bad' : tone === 'warn' ? 'is-warn' : 'is-good')} key={c.cashier_label}>
                        <div className="sgRowLeft">
                          <div style={{ minWidth: 0 }}>
                            <div className="sgRowTitle">
                              {c.cashier_label}
                              <span style={{ marginLeft: 10 }}>
                                <HealthBadge tone={tone} title={tip} compact />
                              </span>
                            </div>
                            <div className="sgRowMeta">
                              выручка: <b>{moneyFromCent(c.revenue_cents, currency)}</b>
                              <span className="sg-muted"> · </span>
                              заказы: <b>{c.orders}</b>
                              <span className="sg-muted"> · </span>
                              confirm: <b>{fmtPct(c.confirm_rate)}</b>
                              <span className="sg-muted"> · </span>
                              cancel: <b>{fmtPct(c.cancel_rate)}</b>
                            </div>
                          </div>
                        </div>

                        <div className="sgRowRight">
                          <div className="sgRowVal">{c.median_confirm_minutes.toFixed(1)} мин</div>
                          <div className="sgRowSub">{tone === 'bad' ? 'риск' : tone === 'warn' ? 'внимание' : 'норма'}</div>
                        </div>
                      </div>
                    );
                  })) }
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
                    const tone: HealthTone =
                      c.segment === 'saver' ? 'warn' : c.segment === 'spender' ? 'good' : 'good';

                    const alert = c.segment === 'saver'
                      ? 'Накопил и не тратит — пуши на списание'
                      : c.segment === 'spender'
                        ? 'Часто тратит — VIP'
                        : c.segment === 'repeat'
                          ? 'Повторный клиент'
                          : 'Новый клиент';

                    return (
                      <div className={'sgRow ' + (tone === 'warn' ? 'is-warn' : 'is-good')} key={c.customer_label}>
                        <div className="sgRowLeft">
                          <div style={{ minWidth: 0 }}>
                            <div className="sgRowTitle">
                              {c.customer_label}
                              <span style={{ marginLeft: 10 }}>
                                <HealthBadge tone={tone} title={alert} compact />
                              </span>
                            </div>
                            <div className="sgRowMeta">
                              LTV: <b>{moneyFromCent(c.ltv_cents, currency)}</b>
                              <span className="sg-muted"> · </span>
                              заказов: <b>{c.orders}</b>
                              <span className="sg-muted"> · </span>
                              last: <b>{c.last_seen}</b>
                              <span className="sg-muted"> · </span>
                              сегмент: <b>{c.segment}</b>
                            </div>
                          </div>
                        </div>

                        <div className="sgRowRight">
                          <div className="sgRowVal">{moneyFromCent(c.revenue_cents, currency)}</div>
                          <div className="sgRowSub">за период</div>
                        </div>
                      </div>
                    );
                  })) }
                </div>
              </div>
            )}

            {/* TAB: LIVE */}
            {tab === 'live' && (
              <div className="salesUnderPanel">
                <div style={{ fontWeight:
