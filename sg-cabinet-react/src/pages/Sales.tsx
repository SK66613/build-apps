// src/pages/Sales.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';

import { SgPage } from '../components/sgp/layout/SgPage';
import { SgFormRow } from '../components/sgp/ui/SgFormRow';
import { SgActions, type SgSaveState } from '../components/sgp/ui/SgActions';

import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
} from '../components/sgp/ui/SgCard';

import { SgButton } from '../components/sgp/ui/SgButton';
import { SgInput, SgSelect } from '../components/sgp/ui/SgInput';
import { SgToggle } from '../components/sgp/ui/SgToggle';

import { HealthBadge } from '../components/sgp/HealthBadge';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { IconBtn } from '../components/sgp/IconBtn';

import { ChartState } from '../components/sgp/charts/ChartState';
import { SgSectionCard } from '../components/sgp/blocks/SgSectionCard';
import { SgTopListCard } from '../components/sgp/sections/SgTopListCard';

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
} from 'recharts';

import SgRowsSummary from '../components/sgp/blocks/SgRowsSummary';

import SgSectionSummary from '../components/sgp/blocks/SgSectionSummary';

/**
 * SALES (QR)
 * - Один стиль/разметка/шрифты как “Сводка” в Passport (SgPage + SgSectionCard + HealthBadge + IconBtn).
 * - Гармошки: Сводка / Кэшбэк / Бусты / Кассиру
 * - Топы: по пользователям
 * - Настройки (UI-first): кэшбэк по рангу/по продажам, мотивация покупок, кассиры + права (в разработке)
 */

/** ========= Types ========= */
type SalesSettings = {
  currency?: string; // RUB|USD|EUR
  coin_value_cents?: number; // 1 coin = X cents
  sales_active?: number; // 0|1
  require_cashier_confirm?: number; // 0|1
};

type SalesTimeseriesDay = {
  date: string; // YYYY-MM-DD
  revenue_cents: number;
  orders: number;
  buyers: number;
  cashback_issued_coins: number;
  redeem_confirmed_coins: number;

  cancels?: number;
  pending?: number;
};

type SalesTopUser = {
  tg_id: string;
  title?: string;
  revenue_cents?: number;
  orders?: number;
  cashback_coins?: number;
  redeem_coins?: number;
};

type CashierRole = 'cashier' | 'senior' | 'auditor';
type CashierDraft = {
  id: string;
  label: string;
  tg_id: string;
  role: CashierRole;
  active: boolean;
};

type CashbackRuleByRank = {
  id: string;
  rank: string; // Bronze/Silver/Gold...
  cashback_pct: number; // 0..100
  max_cashback_coins_per_day: number; // 0 = no limit
  min_order_cents: number; // 0 = no minimum
  enabled: boolean;
};

type CashbackRuleBySales = {
  id: string;
  title: string;
  condition: 'orders_ge' | 'revenue_ge' | 'buyers_ge';
  threshold: number;
  bonus_cashback_pct: number; // adds to base (rank)
  ttl_hours: number;
  enabled: boolean;
};

type BoostId = 'first_purchase' | 'coins_waiting' | 'big_check' | 'weekend';
type BoostRow = {
  id: BoostId;
  title: string;
  enabled: boolean;
  ttl_hours: number;
  limit_per_user: number;
  button_label: string;
  message_text: string;
  hint: string;
};

/** ========= Helpers ========= */
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

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
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

function listDaysISO(fromISO: string, toISO: string) {
  const out: string[] = [];
  if (!fromISO || !toISO) return out;
  let cur = fromISO;
  for (let i = 0; i < 500; i++) {
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

function niceMoneyTick(vCents: number) {
  const v = Number(vCents);
  if (!Number.isFinite(v)) return '';
  const x = Math.round(v / 100);
  const ax = Math.abs(x);
  if (ax >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (ax >= 10_000) return `${(x / 1000).toFixed(0)}k`;
  return String(x);
}

function safeNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

type HintTone = 'neutral' | 'good' | 'warn' | 'bad';
function Hint({ tone = 'neutral', children }: { tone?: HintTone; children: React.ReactNode }) {
  return <div className={`sgp-hint tone-${tone}`}>{children}</div>;
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={(active ? 'sgp-seg__btn is-active ' : 'sgp-seg__btn ') + 'sgp-press'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** ========= Mock fallback ========= */
function mkMock(range: { from: string; to: string }, settings: SalesSettings) {
  const dates = listDaysISO(range.from, range.to);
  const coinCents = Math.max(1, toInt(settings.coin_value_cents ?? 100, 100));

  let buyersBase = 38;
  const days: SalesTimeseriesDay[] = dates.map((d, i) => {
    const wave = Math.sin(i / 3.2) * 0.25 + 0.85;
    const orders = Math.max(8, Math.round((18 + (i % 5) * 3) * wave));
    buyersBase = Math.max(16, buyersBase + (i % 2 === 0 ? 1 : -1));
    const buyers = Math.max(10, Math.round(buyersBase * wave));

    const avg = 52000 + Math.round(14000 * Math.sin(i / 2.8));
    const revenue = Math.max(0, orders * avg);

    const cashbackIssuedCoins = Math.round((revenue / 100) * 0.06);
    const redeemConfirmedCoins = Math.round((revenue / 100) * 0.045);

    const cancels = Math.max(0, Math.round(orders * (0.04 + 0.02 * (i % 3 === 0 ? 1 : 0))));
    const pending = Math.max(0, Math.round(2 + (i % 4)));

    void coinCents;
    return {
      date: d,
      revenue_cents: revenue,
      orders,
      buyers,
      cashback_issued_coins: cashbackIssuedCoins,
      redeem_confirmed_coins: redeemConfirmedCoins,
      cancels,
      pending,
    };
  });

  return { ok: true, days, settings };
}

/** ========= Page ========= */
export default function Sales() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  type OpenedKey = 'summary' | 'cashback' | 'boosts' | 'cashiers' | null;

  const [opened, setOpened] = React.useState<OpenedKey>('summary');
  const [openSummary, setOpenSummary] = React.useState(true);
  const [openCashback, setOpenCashback] = React.useState(true);
  const [openBoosts, setOpenBoosts] = React.useState(true);
  const [openCashiers, setOpenCashiers] = React.useState(true);

  function openOnly(k: Exclude<OpenedKey, null>) {
    setOpened(k);
    setOpenSummary(k === 'summary');
    setOpenCashback(k === 'cashback');
    setOpenBoosts(k === 'boosts');
    setOpenCashiers(k === 'cashiers');
  }

  function toggleOnly(k: Exclude<OpenedKey, null>) {
    if (opened === k) {
      setOpened(null);
      setOpenSummary(false);
      setOpenCashback(false);
      setOpenBoosts(false);
      setOpenCashiers(false);
      return;
    }
    openOnly(k);
  }

  // ===== quick range (same as Passport) =====
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

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

  // ===== overlay chart controls =====
  const [basis, setBasis] = React.useState<'confirmed' | 'issued'>('confirmed');

  const [showRevenue, setShowRevenue] = React.useState(true);
  const [showOrders, setShowOrders] = React.useState(true);
  const [showCashback, setShowCashback] = React.useState(false);
  const [showRedeem, setShowRedeem] = React.useState(false);
  const [showNet, setShowNet] = React.useState(true);

  // ===== settings =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['sales_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: SalesSettings }>(`/api/cabinet/apps/${appId}/sales/settings`),
    staleTime: 30_000,
  });

  // ===== timeseries =====
  const qTs = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['sales_ts', appId, range.from, range.to, basis],
    queryFn: async () => {
      try {
        // later:
        // return apiFetch(`/api/cabinet/apps/${appId}/sales/timeseries?${qs({ ...range, basis })}`)
        const settings = qSettings.data?.settings || {};
        return mkMock(range, settings);
      } catch (e) {
        const settings = qSettings.data?.settings || {};
        return mkMock(range, settings);
      }
    },
    staleTime: 10_000,
  });

  // ===== top users =====
  const [topMetric, setTopMetric] = React.useState<'revenue' | 'orders' | 'cashback' | 'redeem'>('revenue');

  const qTopUsers = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['sales_top_users', appId, range.from, range.to, topMetric],
    queryFn: () =>
      apiFetch<{ ok: true; items: SalesTopUser[] }>(
        `/api/cabinet/apps/${appId}/sales/users/top?${qs({ ...range, metric: topMetric })}`,
      ),
    staleTime: 10_000,
  });

  // ===== derived settings =====
  const settings: SalesSettings = qSettings.data?.settings || (qTs.data as any)?.settings || {};
  const currency = String(settings.currency || 'RUB').toUpperCase();
  const coinCents = Math.max(1, toInt(settings.coin_value_cents, 100));

  const salesActive = !!toInt(settings.sales_active, 1);
  const requireCashierConfirm = !!toInt(settings.require_cashier_confirm, 1);

  // ===== series normalize by day =====
  const series = React.useMemo(() => {
    const map = new Map<string, SalesTimeseriesDay>();
    for (const d of ((qTs.data as any)?.days || []) as SalesTimeseriesDay[]) if (d?.date) map.set(String(d.date), d);

    const dates = listDaysISO(range.from, range.to);
    return dates.map((iso) => {
      const r = map.get(iso);
      const cashbackCoins = safeNum(r?.cashback_issued_coins, 0);
      const redeemCoins = safeNum(r?.redeem_confirmed_coins, 0);
      const netCents = Math.round(redeemCoins * coinCents - cashbackCoins * coinCents);

      return {
        date: iso,
        revenue_cents: safeNum(r?.revenue_cents, 0),
        orders: safeNum(r?.orders, 0),
        buyers: safeNum(r?.buyers, 0),
        cashback_issued_coins: cashbackCoins,
        redeem_confirmed_coins: redeemCoins,
        cancels: safeNum(r?.cancels, 0),
        pending: safeNum(r?.pending, 0),
        net_cents: netCents,
      };
    });
  }, [qTs.data, range.from, range.to, coinCents]);

  // ===== totals =====
  const totals = React.useMemo(() => {
    const rev = series.reduce((s, d) => s + safeNum(d.revenue_cents, 0), 0);
    const orders = series.reduce((s, d) => s + safeNum(d.orders, 0), 0);
    const buyersAvg = series.length
      ? Math.round(series.reduce((s, d) => s + safeNum(d.buyers, 0), 0) / series.length)
      : 0;

    const cashbackCoins = series.reduce((s, d) => s + safeNum(d.cashback_issued_coins, 0), 0);
    const redeemCoins = series.reduce((s, d) => s + safeNum(d.redeem_confirmed_coins, 0), 0);

    const cashbackCent = Math.round(cashbackCoins * coinCents);
    const redeemCent = Math.round(redeemCoins * coinCents);
    const net = redeemCent - cashbackCent;

    const cancels = series.reduce((s, d) => s + safeNum(d.cancels, 0), 0);
    const pending = series.reduce((s, d) => s + safeNum(d.pending, 0), 0);

    const cancelRatePct = orders > 0 ? Math.round((cancels / orders) * 100) : 0;
    const redeemRatePct = cashbackCoins > 0 ? Math.round((redeemCoins / cashbackCoins) * 100) : 0;
    const avgCheck = orders > 0 ? Math.round(rev / orders) : 0;

    return {
      rev,
      orders,
      buyersAvg,
      cashbackCoins,
      redeemCoins,
      cashbackCent,
      redeemCent,
      net,
      cancels,
      pending,
      cancelRatePct: clampN(cancelRatePct, 0, 100),
      redeemRatePct: clampN(redeemRatePct, 0, 100),
      avgCheck,
    };
  }, [series, coinCents]);

  // ===== health =====
  const healthTone: 'good' | 'warn' | 'bad' = React.useMemo(() => {
    if (!salesActive) return 'bad';
    if (totals.pending >= 20) return 'bad';
    if (totals.cancelRatePct >= 12) return 'bad';
    if (totals.pending >= 8) return 'warn';
    if (totals.cancelRatePct >= 8) return 'warn';
    return 'good';
  }, [salesActive, totals.pending, totals.cancelRatePct]);

  const healthTitle = React.useMemo(() => {
    if (!salesActive) return 'Продажи выключены';
    const bits: string[] = [];
    if (totals.pending >= 8) bits.push(`pending: ${totals.pending}`);
    if (totals.cancelRatePct >= 8) bits.push(`cancel: ${totals.cancelRatePct}%`);
    if (!bits.length) return 'Всё ок';
    return bits.join(' · ');
  }, [salesActive, totals.pending, totals.cancelRatePct]);

  // ===== right side top users =====
  const topUsers: SalesTopUser[] = (qTopUsers.data?.items || []).slice(0, 7);

  // ===== cashback settings (UI-first) =====
  const [cashbackOn, setCashbackOn] = React.useState(true);
  const [cashbackRulesByRank, setCashbackRulesByRank] = React.useState<CashbackRuleByRank[]>([
    { id: 'cr1', rank: 'Bronze', cashback_pct: 3, max_cashback_coins_per_day: 0, min_order_cents: 0, enabled: true },
    { id: 'cr2', rank: 'Silver', cashback_pct: 5, max_cashback_coins_per_day: 0, min_order_cents: 0, enabled: true },
    { id: 'cr3', rank: 'Gold', cashback_pct: 7, max_cashback_coins_per_day: 0, min_order_cents: 0, enabled: true },
  ]);

  const [cashbackRulesBySales, setCashbackRulesBySales] = React.useState<CashbackRuleBySales[]>([
    { id: 'cs1', title: '10 заказов за период', condition: 'orders_ge', threshold: 10, bonus_cashback_pct: 2, ttl_hours: 72, enabled: true },
    { id: 'cs2', title: 'Выручка ≥ 10k', condition: 'revenue_ge', threshold: 10_000, bonus_cashback_pct: 1, ttl_hours: 48, enabled: false },
  ]);

  function patchRankRule(id: string, patch: Partial<CashbackRuleByRank>) {
    setCashbackRulesByRank((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function patchSalesRule(id: string, patch: Partial<CashbackRuleBySales>) {
    setCashbackRulesBySales((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRankRule() {
    const id = 'cr' + Math.random().toString(16).slice(2, 8);
    setCashbackRulesByRank((p) => [
      ...p,
      { id, rank: 'New', cashback_pct: 0, max_cashback_coins_per_day: 0, min_order_cents: 0, enabled: false },
    ]);
  }

  function addSalesRule() {
    const id = 'cs' + Math.random().toString(16).slice(2, 8);
    setCashbackRulesBySales((p) => [
      ...p,
      { id, title: 'Новый триггер', condition: 'orders_ge', threshold: 0, bonus_cashback_pct: 0, ttl_hours: 24, enabled: false },
    ]);
  }

  function removeRankRule(id: string) {
    setCashbackRulesByRank((p) => p.filter((x) => x.id !== id));
  }
  function removeSalesRule(id: string) {
    setCashbackRulesBySales((p) => p.filter((x) => x.id !== id));
  }

  const [savingCashback, setSavingCashback] = React.useState(false);
  const [cashbackMsg, setCashbackMsg] = React.useState('');

  async function saveCashback() {
    if (!appId) return;
    setCashbackMsg('');
    setSavingCashback(true);
    try {
      // TODO: PUT /api/cabinet/apps/:id/sales/cashback/settings
      // await apiFetch(`/api/cabinet/apps/${appId}/sales/cashback/settings`, { method:'PUT', ... })
      setCashbackMsg('Сохранено');
    } catch (e: any) {
      setCashbackMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingCashback(false);
    }
  }

  const cashbackSaveState: SgSaveState =
    savingCashback ? 'saving' : cashbackMsg === 'Сохранено' ? 'saved' : cashbackMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== boosts (motivation for purchases) =====
  const [boostsOn, setBoostsOn] = React.useState(true);
  const [boosts, setBoosts] = React.useState<BoostRow[]>([
    {
      id: 'first_purchase',
      title: 'Первую покупку — усилить',
      enabled: true,
      ttl_hours: 72,
      limit_per_user: 1,
      button_label: 'Сделать покупку',
      message_text: 'Первая покупка — повышенный кэшбэк ✨ Успей в ближайшие 72 часа.',
      hint: 'Сегмент: нет покупок в истории (new).',
    },
    {
      id: 'coins_waiting',
      title: 'Накопились монеты — попросить потратить',
      enabled: true,
      ttl_hours: 72,
      limit_per_user: 3,
      button_label: 'Потратить монеты',
      message_text: 'У тебя накопились монеты 💰 Загляни — можно выгодно списать.',
      hint: 'Сегмент: баланс монет ≥ N, но redeem давно не было.',
    },
    {
      id: 'big_check',
      title: 'Большой чек — дополнительный бонус',
      enabled: false,
      ttl_hours: 24,
      limit_per_user: 1,
      button_label: 'Получить бонус',
      message_text: 'Сегодня большой чек — бонусный кэшбэк 🎁 Действует 24 часа.',
      hint: 'Сегмент: чек ≥ N (или LTV).',
    },
    {
      id: 'weekend',
      title: 'Выходные — лёгкий буст',
      enabled: false,
      ttl_hours: 48,
      limit_per_user: 2,
      button_label: 'Зайти в выходные',
      message_text: 'В выходные — приятный бонус к кэшбэку 🌿 Загляни!',
      hint: 'Сегмент: общая кампания по расписанию.',
    },
  ]);

  function patchBoost(id: BoostId, patch: Partial<BoostRow>) {
    setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  const [savingBoosts, setSavingBoosts] = React.useState(false);
  const [boostsMsg, setBoostsMsg] = React.useState('');

  async function saveBoosts() {
    if (!appId) return;
    setBoostsMsg('');
    setSavingBoosts(true);
    try {
      // TODO: PUT /api/cabinet/apps/:id/sales/boosts
      setBoostsMsg('Сохранено');
    } catch (e: any) {
      setBoostsMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingBoosts(false);
    }
  }

  const boostsSaveState: SgSaveState =
    savingBoosts ? 'saving' : boostsMsg === 'Сохранено' ? 'saved' : boostsMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== cashiers (3 stable + optional) =====
  const [cashiers, setCashiers] = React.useState<CashierDraft[]>([
    { id: 'c1', label: 'Кассир #1', tg_id: '', role: 'cashier', active: true },
    { id: 'c2', label: 'Кассир #2', tg_id: '', role: 'cashier', active: true },
    { id: 'c3', label: 'Кассир #3', tg_id: '', role: 'cashier', active: true },
  ]);

  function patchCashier(id: string, patch: Partial<CashierDraft>) {
    setCashiers((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCashier() {
    const id = 'c' + Math.random().toString(16).slice(2, 8);
    setCashiers((p) => [...p, { id, label: 'Кассир (доп.)', tg_id: '', role: 'cashier', active: true }]);
  }

  function removeCashier(id: string) {
    // первые 3 не удаляем
    if (id === 'c1' || id === 'c2' || id === 'c3') return;
    setCashiers((p) => p.filter((c) => c.id !== id));
  }

  const [savingCashiers, setSavingCashiers] = React.useState(false);
  const [cashiersMsg, setCashiersMsg] = React.useState('');

  async function saveCashiers() {
    if (!appId) return;
    setCashiersMsg('');
    setSavingCashiers(true);
    try {
      // TODO: PUT /api/cabinet/apps/:id/sales/cashiers
      // await apiFetch(`/api/cabinet/apps/${appId}/sales/cashiers`, { method:'PUT', ... })
      setCashiersMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['sales_settings', appId] });
    } catch (e: any) {
      setCashiersMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingCashiers(false);
    }
  }

  const cashiersSaveState: SgSaveState =
    savingCashiers ? 'saving' : cashiersMsg === 'Сохранено' ? 'saved' : cashiersMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== live toggles (settings) =====
  const [salesActiveDraft, setSalesActiveDraft] = React.useState(salesActive);
  const [confirmDraft, setConfirmDraft] = React.useState(requireCashierConfirm);

  React.useEffect(() => {
    setSalesActiveDraft(salesActive);
    setConfirmDraft(requireCashierConfirm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesActive, requireCashierConfirm]);

  const [savingOps, setSavingOps] = React.useState(false);
  const [opsMsg, setOpsMsg] = React.useState('');

  async function saveOps() {
    if (!appId) return;
    setOpsMsg('');
    setSavingOps(true);
    try {
      await apiFetch(`/api/cabinet/apps/${appId}/sales/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          settings: {
            sales_active: salesActiveDraft ? 1 : 0,
            require_cashier_confirm: confirmDraft ? 1 : 0,
          },
        }),
      });
      setOpsMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['sales_settings', appId] });
      await qc.invalidateQueries({ queryKey: ['sales_ts', appId] });
    } catch (e: any) {
      setOpsMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingOps(false);
    }
  }

  const opsSaveState: SgSaveState =
    savingOps ? 'saving' : opsMsg === 'Сохранено' ? 'saved' : opsMsg.startsWith('Ошибка') ? 'error' : 'idle';

  // ===== state =====
  const isLoading = qSettings.isLoading || qTs.isLoading || qTopUsers.isLoading;
  const isError = qSettings.isError || qTs.isError || qTopUsers.isError;

  const summaryBadgeTone: 'good' | 'warn' | 'bad' = !salesActive ? 'bad' : healthTone;

  return (
    <SgPage
      className="sgp-sales"
      title="Продажи (QR)"
      subtitle={
        <span>
          Факт по <b>sales</b> + начисление/списание монет. Управление: <b>кэшбэк</b>, <b>бусты</b>, <b>кассиры</b>.
        </span>
      }
      actions={
        <div className="sgp-rangebar">
          <div className="sgp-rangebar__row">
            <div className="sgp-seg">
              <SegBtn active={quick === 'day'} onClick={() => pickQuick('day')}>День</SegBtn>
              <SegBtn active={quick === 'week'} onClick={() => pickQuick('week')}>Неделя</SegBtn>
              <SegBtn active={quick === 'month'} onClick={() => pickQuick('month')}>Месяц</SegBtn>
              <SegBtn active={quick === 'custom'} onClick={() => pickQuick('custom')}>Свой</SegBtn>
            </div>

            <div className={quick === 'custom' ? 'sgp-rangebar__customWrap is-open' : 'sgp-rangebar__customWrap'}>
              <div className="sgp-rangebar__custom">
                <span className="sgp-muted">от</span>
                <input
                  type="date"
                  className="sgp-input sgp-date sgp-press"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className="sgp-muted">до</span>
                <input
                  type="date"
                  className="sgp-input sgp-date sgp-press"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
                <SgButton
                  variant="secondary"
                  size="sm"
                  onClick={() => applyRange(customFrom, customTo)}
                  disabled={!customFrom || !customTo}
                >
                  Применить
                </SgButton>
              </div>
            </div>
          </div>
        </div>
      }
      aside={
        <div className="sgp-aside">
          <SgCard>
            <SgCardHeader
              right={<HealthBadge tone={summaryBadgeTone} title={salesActive ? healthTitle : 'OFF'} />}
            >
              <div>
                <SgCardTitle>Состояние продаж</SgCardTitle>
                <SgCardSub>за выбранный период</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <div className="sgp-kv">
                <div className="sgp-kv__row"><span>Выручка</span><b>{moneyFromCent(totals.rev, currency)}</b></div>
                <div className="sgp-kv__row"><span>Заказы</span><b>{totals.orders}</b></div>
                <div className="sgp-kv__row"><span>Покупатели (avg/day)</span><b>{totals.buyersAvg}</b></div>
                <div className="sgp-kv__row"><span>Кэшбэк (issued)</span><b>{totals.cashbackCoins} мон</b></div>
                <div className="sgp-kv__row"><span>Списано (confirmed)</span><b>{totals.redeemCoins} мон</b></div>
                <div className="sgp-kv__row"><span>Net</span><b>{moneyFromCent(totals.net, currency)}</b></div>
                <div className="sgp-kv__row"><span>Pending</span><b>{totals.pending}</b></div>
                <div className="sgp-kv__row"><span>Cancel</span><b>{totals.cancelRatePct}%</b></div>
              </div>

              <div style={{ marginTop: 10 }}>
                {!salesActive ? (
                  <Hint tone="bad">Продажи выключены. Скан/запись/начисления будут блокироваться.</Hint>
                ) : healthTone === 'bad' ? (
                  <Hint tone="bad">Есть критичные сигналы: {healthTitle}.</Hint>
                ) : healthTone === 'warn' ? (
                  <Hint tone="warn">Есть отклонения: {healthTitle}. Проверь кассиров/подтверждения.</Hint>
                ) : (
                  <Hint tone="good">Ок. Можно включать бусты и точнее настроить кэшбэк.</Hint>
                )}
              </div>
            </SgCardContent>
          </SgCard>

          <div style={{ height: 12 }} />

          <SgTopListCard
            title="Топ пользователей"
            subtitle={
              topMetric === 'revenue'
                ? 'по выручке'
                : topMetric === 'orders'
                  ? 'по заказам'
                  : topMetric === 'cashback'
                    ? 'по кэшбэку'
                    : 'по списаниям'
            }
            items={topUsers}
            getId={(u: any) => String(u.tg_id || u.title || Math.random())}
            getTitle={(u: any) => String(u.title || u.tg_id || 'user')}
            metrics={[
              {
                key: 'revenue',
                label: 'выручке',
                value: (u: any) => Number(u.revenue_cents) || 0,
                fmt: (v: any) => moneyFromCent(Number(v) || 0, currency),
                sub: (u: any) => `orders: ${Number(u.orders) || 0} · cb: ${Number(u.cashback_coins) || 0} · rd: ${Number(u.redeem_coins) || 0}`,
              },
              {
                key: 'orders',
                label: 'заказам',
                value: (u: any) => Number(u.orders) || 0,
                sub: (u: any) => `rev: ${moneyFromCent(Number(u.revenue_cents) || 0, currency)}`,
              },
              {
                key: 'cashback',
                label: 'кэшбэку',
                value: (u: any) => Number(u.cashback_coins) || 0,
                sub: (u: any) => `redeem: ${Number(u.redeem_coins) || 0} · rev: ${moneyFromCent(Number(u.revenue_cents) || 0, currency)}`,
              },
              {
                key: 'redeem',
                label: 'списаниям',
                value: (u: any) => Number(u.redeem_coins) || 0,
                sub: (u: any) => `cashback: ${Number(u.cashback_coins) || 0}`,
              },
            ]}
            metricKey={topMetric}
            onMetricKeyChange={(k) => setTopMetric(k as any)}
            limit={7}
          />

          {!qTopUsers.isLoading && !topUsers.length ? (
            <div style={{ marginTop: 10 }}>
              <Hint tone="warn">
                Топ пустой. Нужен эндпоинт <b>/sales/users/top</b> (пока можно отдавать mock).
              </Hint>
            </div>
          ) : null}
        </div>
      }
    >
      {/* ===== FACT CHART ===== */}
      <SgSectionCard
        title="Факт: выручка / заказы / net"
        sub={
          <>
            {range.from} — {range.to} · 1 монета = <b>{moneyFromCent(coinCents, currency)}</b>
          </>
        }
        right={
          <div className="sgp-chartbar">
            <div className="sgp-seg">
              <SegBtn active={basis === 'confirmed'} onClick={() => setBasis('confirmed')}>
                при подтвержд.
              </SegBtn>
              <SegBtn active={basis === 'issued'} onClick={() => setBasis('issued')}>
                при выдаче
              </SegBtn>
            </div>

            <div className="sgp-iconGroup">
              <IconBtn active={showRevenue} title="Выручка (день)" onClick={() => setShowRevenue((v) => !v)}>R</IconBtn>
              <IconBtn active={showOrders} title="Заказы (день)" onClick={() => setShowOrders((v) => !v)}>O</IconBtn>
              <IconBtn active={showNet} title="Net (день)" onClick={() => setShowNet((v) => !v)}>N</IconBtn>
              <IconBtn active={showCashback} title="Кэшбэк issued (coins)" onClick={() => setShowCashback((v) => !v)}>C</IconBtn>
              <IconBtn active={showRedeem} title="Redeem confirmed (coins)" onClick={() => setShowRedeem((v) => !v)}>D</IconBtn>
            </div>

            <HealthBadge tone={summaryBadgeTone} title={salesActive ? healthTitle : 'OFF'} />
          </div>
        }
        contentStyle={{ padding: 12 }}
      >
        <ChartState
          height={340}
          isLoading={qTs.isLoading}
          isError={qTs.isError}
          errorText={String((qTs.error as any)?.message || 'UNKNOWN')}
        >
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
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
                  yAxisId="count"
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
                    if (name === 'orders') return [String(val), 'Заказы/день'];
                    if (name === 'cashback_issued_coins') return [String(val), 'Кэшбэк issued (мон)'];
                    if (name === 'redeem_confirmed_coins') return [String(val), 'Redeem confirmed (мон)'];
                    return [String(val), String(name)];
                  }}
                  labelFormatter={(_: any, payload: any) => {
                    const d = payload?.[0]?.payload?.date;
                    return d ? `Дата ${d}` : 'Дата';
                  }}
                />

                {showRevenue ? (
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
                  />
                ) : null}

                {showNet ? (
                  <Line
                    yAxisId="money"
                    type="monotone"
                    dataKey="net_cents"
                    name="net_cents"
                    stroke="var(--accent2)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    opacity={0.95}
                  />
                ) : null}

                {showOrders ? (
                  <Bar
                    yAxisId="count"
                    dataKey="orders"
                    name="orders"
                    fill="var(--accent)"
                    fillOpacity={0.18}
                    radius={[10, 10, 10, 10]}
                    barSize={14}
                  />
                ) : null}

                {showCashback ? (
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="cashback_issued_coins"
                    name="cashback_issued_coins"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    opacity={0.85}
                  />
                ) : null}

                {showRedeem ? (
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="redeem_confirmed_coins"
                    name="redeem_confirmed_coins"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                    opacity={0.55}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartState>
      </SgSectionCard>

      {/* ===== quick nav (same approach as Passport) ===== */}
      <div className="sgp-wheelTabsBar">
        <div className="sgp-seg">
          <SegBtn active={opened === 'summary'} onClick={() => openOnly('summary')}>Сводка</SegBtn>
          <SegBtn active={opened === 'cashback'} onClick={() => openOnly('cashback')}>Кэшбэк</SegBtn>
          <SegBtn active={opened === 'boosts'} onClick={() => openOnly('boosts')}>Бусты</SegBtn>
          <SegBtn active={opened === 'cashiers'} onClick={() => openOnly('cashiers')}>Кассиру</SegBtn>
        </div>
      </div>

    {/* ===== ACC: SUMMARY ===== */}
<SgSectionCard
  title={
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>Сводка</span>
      <HealthBadge tone={summaryBadgeTone} title={salesActive ? healthTitle : 'OFF'} />
    </div>
  }
  collapsible
  open={opened === 'summary' && openSummary}
  onToggleOpen={() => toggleOnly('summary')}
>
  <div className="sgp-metrics">
    <div className="sgp-metric">
      <div className="sgp-metric__k">ВЫРУЧКА</div>
      <div className="sgp-metric__v">{moneyFromCent(totals.rev, currency)}</div>
      <div className="sgp-metric__s">
        в день: <b>{moneyFromCent(totals.revPerDay, currency)}</b>
      </div>
    </div>

    <div className="sgp-metric">
      <div className="sgp-metric__k">ЗАКАЗЫ</div>
      <div className="sgp-metric__v">{totals.orders}</div>
      <div className="sgp-metric__s">
        ср. чек: <b>{moneyFromCent(totals.avgCheck, currency)}</b>
      </div>
    </div>

    <div className="sgp-metric">
      <div className="sgp-metric__k">ПОКУПАТЕЛИ</div>
      <div className="sgp-metric__v">{totals.buyers}</div>
      <div className="sgp-metric__s">
        repeat: <b>{totals.repeatRatePct}%</b>
      </div>
    </div>

    <div className="sgp-metric">
      <div className="sgp-metric__k">КЭШБЭК</div>
      <div className="sgp-metric__v">{totals.cashbackCoins} мон</div>
      <div className="sgp-metric__s">
        ≈ <b>{moneyFromCent(totals.cashbackCent, currency)}</b>
      </div>
    </div>

    <div className="sgp-metric">
      <div className="sgp-metric__k">NET</div>
      <div className="sgp-metric__v">{moneyFromCent(totals.net, currency)}</div>
      <div className="sgp-metric__s">
        списано: <b>{moneyFromCent(totals.redeemCent, currency)}</b>
      </div>
    </div>
  </div>

  {/* Rows summary (универсальный блок “строки”, стиль как твой старый sales sgRow) */}
  <div style={{ marginTop: 12 }}>
    <SgRowsSummary
      columns={2}
      dense
      items={[
        {
          key: 'pending',
          tone: !salesActive ? 'bad' : totals.pending >= 8 ? 'bad' : totals.pending > 0 ? 'warn' : 'good',
          title: 'Зависшие подтверждения',
          meta: 'Портит UX: клиент не видит результат',
          value: totals.pending,
          sub: totals.pending >= 8 ? 'критично' : totals.pending > 0 ? 'есть' : 'ок',
          right: (
            <HealthBadge
              tone={!salesActive ? 'bad' : totals.pending >= 8 ? 'bad' : totals.pending > 0 ? 'warn' : 'good'}
              title={!salesActive ? 'Продажи OFF' : 'pending за период'}
              compact
            />
          ),
        },
        {
          key: 'cancel',
          tone: !salesActive ? 'bad' : totals.cancelRatePct >= 12 ? 'bad' : totals.cancelRatePct >= 8 ? 'warn' : 'good',
          title: 'Процент отмен',
          meta: 'Сигнал проблем в кассе/правилах',
          value: `${totals.cancelRatePct}%`,
          sub: totals.cancelRatePct >= 12 ? 'плохо' : totals.cancelRatePct >= 8 ? 'риск' : 'ок',
          right: (
            <HealthBadge
              tone={!salesActive ? 'bad' : totals.cancelRatePct >= 12 ? 'bad' : totals.cancelRatePct >= 8 ? 'warn' : 'good'}
              title={!salesActive ? 'Продажи OFF' : 'cancel_rate за период'}
              compact
            />
          ),
        },
      ]}
    />
  </div>
</SgSectionCard>

      {/* ===== ACC: CASHBACK ===== */}
      <SgSectionCard
        title="Кэшбэк"
        sub="Настройки кэшбэка по рангу и по продажам (UI-first)"
        collapsible
        open={opened === 'cashback' && openCashback}
        onToggleOpen={() => toggleOnly('cashback')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sgp-muted">Общий тумблер</span>
            <SgToggle checked={cashbackOn} onChange={setCashbackOn} />
          </div>
          <Hint tone="neutral">
            Идея: базовый % по рангу + временный бонус по поведению (orders/revenue/buyers).
          </Hint>
        </div>

        <div style={{ height: 10 }} />

        <SgCard>
          <SgCardHeader
            right={
              <SgButton variant="secondary" size="sm" onClick={addRankRule}>
                + Ранг-правило
              </SgButton>
            }
          >
            <div>
              <SgCardTitle>По рангу</SgCardTitle>
              <SgCardSub>Зависит от ранга пользователя (будет связка с системой рангов)</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            {cashbackRulesByRank.map((r) => (
              <SgCard key={r.id} style={{ marginTop: 10 }}>
                <SgCardHeader
                  right={
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <SgToggle checked={r.enabled} onChange={(v) => patchRankRule(r.id, { enabled: v })} />
                      <SgButton variant="ghost" size="sm" onClick={() => removeRankRule(r.id)}>
                        Удалить
                      </SgButton>
                    </div>
                  }
                >
                  <div>
                    <SgCardTitle>{r.rank}</SgCardTitle>
                    <SgCardSub>{r.enabled ? 'включено' : 'выключено'}</SgCardSub>
                  </div>
                </SgCardHeader>

                <SgCardContent>
                  <SgFormRow label="Ранг">
                    <SgInput
                      value={r.rank}
                      onChange={(e) => patchRankRule(r.id, { rank: String((e.target as any).value || '') })}
                    />
                  </SgFormRow>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SgFormRow label="Cashback %" hint="0..100">
                      <SgInput
                        value={String(r.cashback_pct)}
                        onChange={(e) => patchRankRule(r.id, { cashback_pct: clampN((e.target as any).value, 0, 100) })}
                      />
                    </SgFormRow>

                    <SgFormRow label="Min чек" hint={`0 = без минимума (${currencyLabel(currency)})`}>
                      <SgInput
                        value={String(Math.max(0, toInt(r.min_order_cents, 0)) / 100)}
                        onChange={(e) =>
                          patchRankRule(r.id, {
                            min_order_cents: Math.max(0, Math.round(Number(String((e.target as any).value || '0').replace(',', '.')) * 100)),
                          })
                        }
                      />
                    </SgFormRow>
                  </div>

                  <SgFormRow label="Лимит монет/день" hint="0 = без лимита">
                    <SgInput
                      value={String(r.max_cashback_coins_per_day)}
                      onChange={(e) =>
                        patchRankRule(r.id, { max_cashback_coins_per_day: Math.max(0, toInt((e.target as any).value, 0)) })
                      }
                    />
                  </SgFormRow>
                </SgCardContent>
              </SgCard>
            ))}

            {!cashbackRulesByRank.length ? (
              <Hint tone="warn">Нет правил по рангу — добавь хотя бы базовый %.</Hint>
            ) : null}
          </SgCardContent>
        </SgCard>

        <div style={{ height: 12 }} />

        <SgCard>
          <SgCardHeader
            right={
              <SgButton variant="secondary" size="sm" onClick={addSalesRule}>
                + Sales-правило
              </SgButton>
            }
          >
            <div>
              <SgCardTitle>По продажам</SgCardTitle>
              <SgCardSub>Временные бонусы “за период” (можно превратить в кампании)</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            {cashbackRulesBySales.map((r) => (
              <SgCard key={r.id} style={{ marginTop: 10 }}>
                <SgCardHeader
                  right={
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <SgToggle checked={r.enabled} onChange={(v) => patchSalesRule(r.id, { enabled: v })} />
                      <SgButton variant="ghost" size="sm" onClick={() => removeSalesRule(r.id)}>
                        Удалить
                      </SgButton>
                    </div>
                  }
                >
                  <div>
                    <SgCardTitle>{r.title}</SgCardTitle>
                    <SgCardSub>{r.enabled ? 'включено' : 'выключено'}</SgCardSub>
                  </div>
                </SgCardHeader>

                <SgCardContent>
                  <SgFormRow label="Название">
                    <SgInput
                      value={r.title}
                      onChange={(e) => patchSalesRule(r.id, { title: String((e.target as any).value || '') })}
                    />
                  </SgFormRow>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SgFormRow label="Условие">
                      <SgSelect
                        value={r.condition}
                        onChange={(e) => patchSalesRule(r.id, { condition: (e.target as any).value })}
                      >
                        <option value="orders_ge">orders ≥</option>
                        <option value="revenue_ge">revenue ≥</option>
                        <option value="buyers_ge">buyers ≥</option>
                      </SgSelect>
                    </SgFormRow>

                    <SgFormRow
                      label="Порог"
                      hint={r.condition === 'revenue_ge' ? `в ${currencyLabel(currency)} (целое)` : 'в штуках'}
                    >
                      <SgInput
                        value={String(r.threshold)}
                        onChange={(e) => patchSalesRule(r.id, { threshold: Math.max(0, toInt((e.target as any).value, 0)) })}
                      />
                    </SgFormRow>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SgFormRow label="Bonus cashback %" hint="добавляется к рангу">
                      <SgInput
                        value={String(r.bonus_cashback_pct)}
                        onChange={(e) =>
                          patchSalesRule(r.id, { bonus_cashback_pct: clampN((e.target as any).value, 0, 100) })
                        }
                      />
                    </SgFormRow>

                    <SgFormRow label="TTL (часы)">
                      <SgInput
                        value={String(r.ttl_hours)}
                        onChange={(e) => patchSalesRule(r.id, { ttl_hours: Math.max(1, toInt((e.target as any).value, 24)) })}
                      />
                    </SgFormRow>
                  </div>
                </SgCardContent>
              </SgCard>
            ))}

            {!cashbackRulesBySales.length ? (
              <Hint tone="neutral">Можно добавить правило “orders ≥ 10” и дать +2% на 72 часа.</Hint>
            ) : null}
          </SgCardContent>
        </SgCard>

        <div style={{ height: 12 }} />

        <SgActions
          primaryLabel="Сохранить кэшбэк"
          onPrimary={saveCashback}
          state={cashbackSaveState}
          errorText={cashbackMsg.startsWith('Ошибка') ? cashbackMsg : undefined}
          left={<span className="sgp-muted">TODO: backend endpoint + расчёт выдачи кэшбэка.</span>}
        />
      </SgSectionCard>

      {/* ===== ACC: BOOSTS ===== */}
      <SgSectionCard
        title="Бусты"
        sub="Мотивация покупать (UI-first, позже привязка к кампаниям)"
        collapsible
        open={opened === 'boosts' && openBoosts}
        onToggleOpen={() => toggleOnly('boosts')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sgp-muted">Общий тумблер</span>
            <SgToggle checked={boostsOn} onChange={setBoostsOn} />
          </div>

          <Hint tone="neutral">
            Если списания низкие, включай “накопились монеты”. Если заказов мало — “первую покупку”.
          </Hint>
        </div>

        <div style={{ height: 10 }} />

        {boosts.map((b) => (
          <SgCard key={b.id} style={{ marginTop: 10 }}>
            <SgCardHeader
              right={
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <SgToggle checked={!!(boostsOn && b.enabled)} onChange={(v) => patchBoost(b.id, { enabled: v })} />
                  <HealthBadge tone={boostsOn && b.enabled ? 'good' : 'warn'} title={boostsOn && b.enabled ? 'ON' : 'OFF'} />
                </div>
              }
            >
              <div>
                <SgCardTitle>{b.title}</SgCardTitle>
                <SgCardSub>{b.hint}</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <SgFormRow label="Текст сообщения">
                <SgInput
                  value={b.message_text}
                  onChange={(e) => patchBoost(b.id, { message_text: String((e.target as any).value || '') })}
                />
              </SgFormRow>

              <SgFormRow label="Кнопка">
                <SgInput
                  value={b.button_label}
                  onChange={(e) => patchBoost(b.id, { button_label: String((e.target as any).value || '') })}
                />
              </SgFormRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SgFormRow label="TTL (часы)">
                  <SgInput
                    value={String(b.ttl_hours)}
                    onChange={(e) => patchBoost(b.id, { ttl_hours: Math.max(1, toInt((e.target as any).value, 24)) })}
                  />
                </SgFormRow>

                <SgFormRow label="Лимит / юзер">
                  <SgInput
                    value={String(b.limit_per_user)}
                    onChange={(e) => patchBoost(b.id, { limit_per_user: Math.max(0, toInt((e.target as any).value, 1)) })}
                  />
                </SgFormRow>
              </div>

              <div style={{ marginTop: 10 }}>
                <Hint tone="neutral">
                  Подсказка: если <b>redeem</b> низкий относительно <b>cashback</b> ({totals.redeemRatePct}%),
                  усиливай сценарий “потратить монеты”.
                </Hint>
              </div>
            </SgCardContent>
          </SgCard>
        ))}

        <div style={{ height: 12 }} />

        <SgActions
          primaryLabel="Сохранить бусты"
          onPrimary={saveBoosts}
          state={boostsSaveState}
          errorText={boostsMsg.startsWith('Ошибка') ? boostsMsg : undefined}
          left={<span className="sgp-muted">TODO: привязать к воркеру/кампаниям.</span>}
        />
      </SgSectionCard>

      {/* ===== ACC: CASHIERS ===== */}
      <SgSectionCard
        title="Кассиру"
        sub="Добавление кассиров и права (в разработке)"
        collapsible
        open={opened === 'cashiers' && openCashiers}
        onToggleOpen={() => toggleOnly('cashiers')}
      >
        <SgCard>
          <SgCardHeader>
            <div>
              <SgCardTitle>Операционные тумблеры</SgCardTitle>
              <SgCardSub>live-настройки (settings)</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            <SgFormRow label="Продажи активны" hint="Если выключено — запись продаж/кэшбэк блокируются">
              <SgToggle checked={salesActiveDraft} onChange={setSalesActiveDraft} />
            </SgFormRow>

            <SgFormRow label="Требовать подтверждение кассиром" hint="Если включено — начисление/списание подтверждается">
              <SgToggle checked={confirmDraft} onChange={setConfirmDraft} />
            </SgFormRow>

            <div style={{ marginTop: 10 }}>
              <Hint tone="neutral">
                Валюта: <b>{currency}</b> · 1 монета: <b>{moneyFromCent(coinCents, currency)}</b>
              </Hint>
            </div>

            <div style={{ marginTop: 12 }}>
              <SgActions
                primaryLabel="Сохранить тумблеры"
                onPrimary={saveOps}
                state={opsSaveState}
                errorText={opsMsg.startsWith('Ошибка') ? opsMsg : undefined}
                left={<span className="sgp-muted">Сохраняем сразу, влияет на работу кассы.</span>}
              />
            </div>
          </SgCardContent>
        </SgCard>

        <div style={{ height: 12 }} />

        <SgCard>
          <SgCardHeader
            right={
              <SgButton variant="secondary" size="sm" onClick={addCashier}>
                + Добавить кассира
              </SgButton>
            }
          >
            <div>
              <SgCardTitle>Кассиры</SgCardTitle>
              <SgCardSub>Первые 3 — обязательные. Остальные добавляй по кнопке.</SgCardSub>
            </div>
          </SgCardHeader>

          <SgCardContent>
            {cashiers.map((c, idx) => {
              const locked = idx < 3;
              return (
                <SgCard key={c.id} style={{ marginTop: 10 }}>
                  <SgCardHeader
                    right={
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <SgToggle checked={c.active} onChange={(v) => patchCashier(c.id, { active: v })} />
                        <SgButton variant="ghost" size="sm" onClick={() => removeCashier(c.id)} disabled={locked}>
                          Удалить
                        </SgButton>
                      </div>
                    }
                  >
                    <div>
                      <SgCardTitle>{locked ? `Кассир #${idx + 1}` : c.label}</SgCardTitle>
                      <SgCardSub>{c.active ? 'активен' : 'выключен'} · права: {c.role}</SgCardSub>
                    </div>
                  </SgCardHeader>

                  <SgCardContent>
                    <SgFormRow label="Лейбл">
                      <SgInput
                        value={c.label}
                        onChange={(e) => patchCashier(c.id, { label: String((e.target as any).value || '') })}
                        disabled={locked}
                      />
                    </SgFormRow>

                    <SgFormRow label="tg_id кассира" hint="позже можно будет искать по контактам/юзеру">
                      <SgInput
                        value={c.tg_id}
                        onChange={(e) => patchCashier(c.id, { tg_id: String((e.target as any).value || '') })}
                        placeholder="например: 123456789"
                      />
                    </SgFormRow>

                    <SgFormRow label="Права (в разработке)" hint="пока просто фиксируем в настройках">
                      <SgSelect value={c.role} onChange={(e) => patchCashier(c.id, { role: (e.target as any).value })}>
                        <option value="cashier">cashier (обычный)</option>
                        <option value="senior">senior (старший)</option>
                        <option value="auditor">auditor (просмотр)</option>
                      </SgSelect>
                    </SgFormRow>
                  </SgCardContent>
                </SgCard>
              );
            })}

            <div style={{ marginTop: 10 }}>
              <Hint tone="neutral">
                В разработке: “права” (кто может отменять/подтверждать/видеть ленту), и связка с реальными пользователями.
              </Hint>
            </div>

            <div style={{ marginTop: 12 }}>
              <SgActions
                primaryLabel="Сохранить кассиров"
                onPrimary={saveCashiers}
                state={cashiersSaveState}
                errorText={cashiersMsg.startsWith('Ошибка') ? cashiersMsg : undefined}
                left={<span className="sgp-muted">TODO: endpoint /sales/cashiers.</span>}
              />
            </div>
          </SgCardContent>
        </SgCard>
      </SgSectionCard>

      {isLoading ? <ShimmerLine /> : null}
      {isError ? (
        <div style={{ marginTop: 12 }}>
          <Hint tone="bad">
            Ошибка: {String((qSettings.error as any)?.message || (qTs.error as any)?.message || (qTopUsers.error as any)?.message || 'UNKNOWN')}
          </Hint>
        </div>
      ) : null}
    </SgPage>
  );
}
