// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
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

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;

  weight?: number;
  active?: number;

  kind?: string; // "coins" | "item"
  coins?: number; // for coins-prize

  // ✅ new source of truth for item cost (in coins)
  cost_coins?: number;

  // legacy for UI (may be present)
  cost_cent?: number;
  cost_currency?: string;

  track_qty?: number; // 0|1
  qty_left?: number | null; // number
  stop_when_zero?: number; // 0|1
};

type WheelTimeseriesDay = {
  date: string; // YYYY-MM-DD
  spins: number;
  wins: number;
  redeemed: number;

  // ✅ coins (ROI without currency)
  revenue_coins: number;
  payout_issued_coins: number;
  payout_redeemed_coins: number;
  profit_issued_coins: number;
  profit_redeemed_coins: number;
  cum_profit_issued_coins?: number;
  cum_profit_redeemed_coins?: number;

  // ✅ money snapshots (cents) from wheel_spins
  revenue_cents: number;
  payout_issued_cents: number;
  payout_redeemed_cents: number;
  profit_issued_cents: number;
  profit_redeemed_cents: number;
  cum_profit_issued_cents?: number;
  cum_profit_redeemed_cents?: number;
};

type AppSettings = {
  coin_value_cents?: number;
  currency?: string; // 'RUB' | 'USD' | 'EUR' | ...
  // (optional future) spin_cost_coins?: number;
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

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${(Number(x) * 100).toFixed(1)}%`;
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

/* Иконки для кнопок-линий в денежном графике */
function IcoMoney() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 5h10v6H3V5z" stroke="currentColor" strokeWidth="2" opacity="0.9" />
      <path d="M6 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IcoPay() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <path d="M6 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function normalizeCoins(p: PrizeStat): number {
  const v = Number((p as any).coins);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function normalizeKind(p: PrizeStat): 'coins' | 'item' {
  const k = String((p as any).kind || '').trim().toLowerCase();
  return k === 'coins' ? 'coins' : 'item';
}

function profitBadge(profitCent: number, revenueCent: number) {
  if (revenueCent <= 0) return { text: '—', cls: 'mid' };
  const m = profitCent / revenueCent;
  if (m >= 0.25) return { text: 'ОК', cls: 'ok' };
  if (m >= 0.05) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

function redeemBadge(redeemRatePct: number) {
  if (redeemRatePct >= 70) return { text: 'ОК', cls: 'ok' };
  if (redeemRatePct >= 40) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

function isTracked(p: PrizeStat) {
  return Number(p.track_qty || 0) ? true : false;
}
function isStopWhenZero(p: PrizeStat) {
  return Number(p.stop_when_zero || 0) ? true : false;
}
function qtyLeft(p: PrizeStat) {
  const q = (p as any).qty_left;
  const n = Number(q);
  return Number.isFinite(n) ? n : null;
}

// ✅ mimic mini-runtime effWeight (only the crucial part for analytics)
// if track_qty + stop_when_zero + qty_left<=0 => effective weight = 0
function effWeight(p: PrizeStat, w: number) {
  const tracked = isTracked(p);
  const swz = isStopWhenZero(p);
  const q = qtyLeft(p);
  if (tracked && swz && q !== null && q <= 0) return 0;
  return Math.max(0, w);
}

/* ==== Toggle (тумблер) ==== */
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

export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  // ===== Under-chart tabs (как обсудили) =====
  const [tab, setTab] = React.useState<'summary' | 'forecast' | 'stock'>('summary');

  // расход считать: при выигрыше или при выдаче (переключает payout/profit из timeseries)
  const [costBasis, setCostBasis] = React.useState<'issued' | 'redeemed'>('issued');

  // Денежный график: кнопки слоёв
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showProfitBars, setShowProfitBars] = React.useState<boolean>(true);

  // Быстрые периоды
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // Right card Top prizes
  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');

  // ===== SETTINGS from worker (app_settings) =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

  // local drafts for app_settings (coin value + currency)
  const [coinValueDraft, setCoinValueDraft] = React.useState<string>('1'); // in currency units (e.g. 1.00)
  const [currencyDraft, setCurrencyDraft] = React.useState<string>('RUB');
  const [savingCoin, setSavingCoin] = React.useState(false);
  const [coinMsg, setCoinMsg] = React.useState<string>('');

  React.useEffect(() => {
    const cents = qSettings.data?.settings?.coin_value_cents;
    const cur = qSettings.data?.settings?.currency;

    if (cur) setCurrencyDraft(String(cur).toUpperCase());

    if (cents === undefined || cents === null) return;
    const units = Number(cents) / 100;
    if (!Number.isFinite(units) || units <= 0) return;

    // only auto-fill if draft still "default-ish"
    setCoinValueDraft((prev) => {
      const prevN = Number(String(prev).replace(',', '.'));
      if (!Number.isFinite(prevN)) return prev;
      const prevCent = Math.floor(prevN * 100);
      if (prevCent === Math.floor(Number(cents))) return prev;
      if (prev !== '1' && prev !== '1.0' && prev !== '1.00') return prev;
      return String(units);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSettings.data?.settings?.coin_value_cents, qSettings.data?.settings?.currency]);

  async function saveAppSettings() {
    if (!appId) return;
    setCoinMsg('');

    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor(units * 100);

    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(cents) || cents <= 0) {
      setCoinMsg('Введите корректную стоимость 1 монеты.');
      return;
    }

    const cur = String(currencyDraft || 'RUB').toUpperCase().trim() || 'RUB';

    setSavingCoin(true);
    try {
      await apiFetch(`/api/cabinet/apps/${appId}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          settings: { coin_value_cents: cents, currency: cur },
        }),
      });

      setCoinMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['app_settings', appId] });
      await qc.invalidateQueries({ queryKey: ['wheel_ts', appId] }); // чтобы moneyFromCent был с актуальной валютой
    } catch (e: any) {
      setCoinMsg('Ошибка: ' + String(e?.message || e));
    } finally {
      setSavingCoin(false);
    }
  }

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

  // ===== prizes stats (by prize) =====
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });
  const items = qStats.data?.items || [];

  // ===== timeseries (daily) =====
  const qTs = useQuery({
    enabled: !!appId,
    queryKey: ['wheel_ts', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; days: WheelTimeseriesDay[]; settings?: AppSettings; meta?: any }>(
        `/api/cabinet/apps/${appId}/wheel/timeseries?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  const currency = String(
    qTs.data?.settings?.currency ||
      qSettings.data?.settings?.currency ||
      currencyDraft ||
      'RUB'
  ).toUpperCase();

  // cents per coin (from app_settings draft)
  const coinCostCentPerCoin = React.useMemo(() => {
    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor(units * 100);
    return Number.isFinite(cents) ? Math.max(0, cents) : 0;
  }, [coinValueDraft]);

  // ===== FACT totals (from timeseries) =====
  const fact = React.useMemo(() => {
    const days = qTs.data?.days || [];
    const spins = days.reduce((s, d) => s + (Number(d.spins) || 0), 0);
    const wins = days.reduce((s, d) => s + (Number(d.wins) || 0), 0);
    const redeemed = days.reduce((s, d) => s + (Number(d.redeemed) || 0), 0);

    const revenue_cents = days.reduce((s, d) => s + (Number(d.revenue_cents) || 0), 0);
    const payoutIssued_cents = days.reduce((s, d) => s + (Number(d.payout_issued_cents) || 0), 0);
    const payoutRedeemed_cents = days.reduce((s, d) => s + (Number(d.payout_redeemed_cents) || 0), 0);
    const payout_cents = costBasis === 'redeemed' ? payoutRedeemed_cents : payoutIssued_cents;

    const profitIssued_cents = days.reduce((s, d) => s + (Number(d.profit_issued_cents) || 0), 0);
    const profitRedeemed_cents = days.reduce((s, d) => s + (Number(d.profit_redeemed_cents) || 0), 0);
    const profit_cents = costBasis === 'redeemed' ? profitRedeemed_cents : profitIssued_cents;

    const revenue_coins = days.reduce((s, d) => s + (Number(d.revenue_coins) || 0), 0);
    const payoutIssued_coins = days.reduce((s, d) => s + (Number(d.payout_issued_coins) || 0), 0);
    const payoutRedeemed_coins = days.reduce((s, d) => s + (Number(d.payout_redeemed_coins) || 0), 0);
    const payout_coins = costBasis === 'redeemed' ? payoutRedeemed_coins : payoutIssued_coins;

    const profitIssued_coins = days.reduce((s, d) => s + (Number(d.profit_issued_coins) || 0), 0);
    const profitRedeemed_coins = days.reduce((s, d) => s + (Number(d.profit_redeemed_coins) || 0), 0);
    const profit_coins = costBasis === 'redeemed' ? profitRedeemed_coins : profitIssued_coins;

    const redeemRate = wins > 0 ? Math.max(0, Math.min(1, redeemed / wins)) : 0;

    return {
      spins,
      wins,
      redeemed,
      revenue_cents,
      payout_cents,
      profit_cents,
      revenue_coins,
      payout_coins,
      profit_coins,
      redeemRate,
      redeemRatePct: wins > 0 ? Math.round(redeemRate * 100) : 0,
    };
  }, [qTs.data?.days, costBasis]);

  // ===== FACT period (money) =====
  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const spins = fact.spins;
    const revenue = fact.revenue_cents;
    const payout = fact.payout_cents;
    const profit = fact.profit_cents;

    const spinsPerDay = days > 0 ? spins / days : 0;
    return { days, spins, revenue, payout, profit, spinsPerDay };
  }, [range.from, range.to, fact.spins, fact.revenue_cents, fact.payout_cents, fact.profit_cents]);

  const profitTag = React.useMemo(
    () => profitBadge(period.profit, Math.max(0, period.revenue)),
    [period.profit, period.revenue]
  );
  const redeemTag = React.useMemo(() => redeemBadge(fact.redeemRatePct), [fact.redeemRatePct]);

  const activeCount = items.filter((i) => (Number(i.active) || 0) ? true : false).length;

  // Top prizes
  const top = [...items]
    .sort((a, b) => (Number((b as any)[topMetric]) || 0) - (Number((a as any)[topMetric]) || 0))
    .slice(0, 7);

  // ===== Settings draft (ТОЛЬКО СКЛАД) =====
  type DraftRow = {
    active: boolean;
    track_qty: boolean;
    qty_left: string; // empty => don't send
    stop_when_zero: boolean;
  };

  const [draft, setDraft] = React.useState<Record<string, DraftRow>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  React.useEffect(() => {
    if (!items.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of items) {
        const code = p.prize_code;
        if (!code) continue;
        if (next[code] === undefined) {
          next[code] = {
            active: !!p.active,
            track_qty: !!p.track_qty,
            qty_left: (p.qty_left === null || p.qty_left === undefined) ? '' : String(p.qty_left),
            stop_when_zero: !!p.stop_when_zero,
          };
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qStats.data?.items]);

  function patchDraft(code: string, patch: Partial<DraftRow>) {
    setDraft((d) => ({
      ...d,
      [code]: {
        active: !!d[code]?.active,
        track_qty: !!d[code]?.track_qty,
        qty_left: d[code]?.qty_left ?? '',
        stop_when_zero: !!d[code]?.stop_when_zero,
        ...patch,
      },
    }));
  }

  async function saveStock() {
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;

        const active = d.active ? 1 : 0;
        const track_qty = d.track_qty ? 1 : 0;
        const stop_when_zero = d.stop_when_zero ? 1 : 0;

        // qty_left: если пусто => не трогаем (undefined)
        const qty_left_raw = String(d.qty_left ?? '').trim();
        const qty_left =
          qty_left_raw === ''
            ? undefined
            : Math.max(0, toInt(qty_left_raw, 0));

        return {
          prize_code: code,
          active,
          track_qty,
          stop_when_zero,
          ...(qty_left === undefined ? {} : { qty_left }),
        };
      })
      .filter(Boolean) as Array<any>;

    if (!payloadItems.length) {
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try {
      const r = await apiFetch<{ ok: true; updated: number }>(
        `/api/cabinet/apps/${appId}/wheel/prizes`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: payloadItems }),
        }
      );

      setSaveMsg(`Сохранено: ${r.updated}`);
      await qc.invalidateQueries({ queryKey: ['wheel', appId] });
      await qc.invalidateQueries({ queryKey: ['wheel_ts', appId] });
    } catch (e: any) {
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  // ===== Forecast controls (ПРОГНОЗ) =====
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // forecast only
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>(''); // forecast only
  const spinCostCoinsForecast = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

  const [forecastScenario, setForecastScenario] = React.useState<'safe' | 'base' | 'aggr'>('base');
  const [forecastTargetMargin, setForecastTargetMargin] = React.useState<0.1 | 0.2 | 0.3>(0.2);

  // ===== PROGNOSIS EV/ROI (current config; НЕ влияет на факт) =====
  const ev = React.useMemo(() => {
    // используем данные из items + склад (stop/track/qty) из draft, чтобы прогноз учитывал склад
    const merged = items.map((p) => {
      const d = draft[p.prize_code];
      if (!d) return p;

      const next: PrizeStat = { ...p };
      next.active = d.active ? 1 : 0;
      next.track_qty = d.track_qty ? 1 : 0;
      if (String(d.qty_left ?? '').trim() !== '') next.qty_left = Math.max(0, toInt(d.qty_left, 0));
      next.stop_when_zero = d.stop_when_zero ? 1 : 0;
      return next;
    });

    const active = merged.filter((p) => (Number(p.active) || 0) ? true : false);

    // eff weights учитывают stop_when_zero+qty_left (как в рантайме)
    const wSum = active.reduce((s, p) => s + effWeight(p, Math.max(0, Number(p.weight) || 0)), 0);

    const spinRevenueCoins = spinCostCoinsForecast;
    const spinRevenueCent = spinRevenueCoins * coinCostCentPerCoin;

    let evCoinsAcc = 0;

    const perPrize = active.map((p) => {
      const wRaw = Math.max(0, Number(p.weight) || 0);
      const w = effWeight(p, wRaw);
      const prob = wSum > 0 ? (w / wSum) : 0;

      const kind = normalizeKind(p);
      const coins = normalizeCoins(p);

      const costCoins = kind === 'coins' ? coins : Math.max(0, Number(p.cost_coins ?? 0) || 0);
      const expCoins = prob * costCoins;

      evCoinsAcc += expCoins;

      const costCent = Math.round(costCoins * coinCostCentPerCoin);
      const expCent = Math.round(expCoins * coinCostCentPerCoin);

      const tracked = isTracked(p);
      const swz = isStopWhenZero(p);
      const q = qtyLeft(p);
      const disabledByStock = tracked && swz && q !== null && q <= 0;

      return {
        prize_code: p.prize_code,
        title: p.title || p.prize_code,
        weight: wRaw,
        eff_weight: w,
        prob,
        kind,
        coins,
        costCoins,
        expCoins,
        costCent,
        expCent,
        disabledByStock,
      };
    });

    const payoutCoinsIssued = evCoinsAcc;

    // redeemed-basis: payout only when cashier confirms (мы моделируем через redeemRate)
    const redeemRate = fact.redeemRate;
    const payoutCoinsRedeemed = evCoinsAcc * redeemRate;

    const payoutCoins = costBasis === 'redeemed' ? payoutCoinsRedeemed : payoutCoinsIssued;
    const profitCoins = spinRevenueCoins - payoutCoins;
    const roiCoins = spinRevenueCoins > 0 ? (profitCoins / spinRevenueCoins) : null;

    const payoutCentIssued = Math.round(payoutCoinsIssued * coinCostCentPerCoin);
    const payoutCentRedeemed = Math.round(payoutCoinsRedeemed * coinCostCentPerCoin);
    const payoutCent = costBasis === 'redeemed' ? payoutCentRedeemed : payoutCentIssued;

    const profitCent = Math.round(spinRevenueCent - payoutCent);
    const roi = spinRevenueCent > 0 ? (profitCent / spinRevenueCent) : null;

    // простая метрика “сколько спинов чтобы покрыть расход” (эвристика)
    const breakEvenSpins = profitCent > 0 ? Math.ceil(payoutCent / profitCent) : null;

    const riskRows = [...perPrize].sort((a, b) => (b.expCoins - a.expCoins));
    const topRisk = riskRows?.[0] || null;

    const costCoverage = perPrize.length
      ? Math.round((perPrize.filter((x) => x.costCoins > 0).length / perPrize.length) * 100)
      : 0;

    return {
      wSum,
      spinRevenueCoins,
      payoutCoinsIssued,
      payoutCoinsRedeemed,
      payoutCoins,
      profitCoins,
      roiCoins,

      spinRevenueCent,
      payoutCentIssued,
      payoutCentRedeemed,
      payoutCent,
      profitCent,
      roi,

      breakEvenSpins,
      perPrize,
      topRisk,
      costCoverage,
    };
  }, [items, draft, spinCostCoinsForecast, coinCostCentPerCoin, fact.redeemRate, costBasis]);

  const breakEvenLabel = React.useMemo(() => {
    if (ev.breakEvenSpins === null) return 'не окупается';
    return `${ev.breakEvenSpins} спинов`;
  }, [ev.breakEvenSpins]);

  // ===== ОСТАТКИ / ИНВЕНТАРЬ (для подсказок) =====
  const inventory = React.useMemo(() => {
    const tracked = items.filter((p) => isTracked(p));
    const trackedCount = tracked.length;

    const outOfStock = tracked.filter((p) => {
      const q = qtyLeft(p);
      return q !== null && q <= 0;
    });
    const outOfStockCount = outOfStock.length;

    const lowThreshold = 3;
    const lowStock = tracked.filter((p) => {
      const q = qtyLeft(p);
      return q !== null && q > 0 && q <= lowThreshold;
    });
    const lowStockCount = lowStock.length;

    const autoOff = tracked.filter((p) => isStopWhenZero(p) && (() => {
      const q = qtyLeft(p);
      return q !== null && q <= 0;
    })());
    const autoOffCount = autoOff.length;

    return {
      trackedCount,
      outOfStockCount,
      lowStockCount,
      autoOffCount,
      lowThreshold,
    };
  }, [items]);

  // ===== MONEY SERIES (FACT DAYS from wheel_spins) =====
  const moneySeries = React.useMemo(() => {
    const map = new Map<string, WheelTimeseriesDay>();
    for (const r of (qTs.data?.days || [])) {
      if (r?.date) map.set(String(r.date), r);
    }

    const dates = listDaysISO(range.from, range.to);
    let cum = 0;

    const series = dates.map((iso) => {
      const r = map.get(iso);

      const spins = Number(r?.spins || 0);
      const revenue = Number(r?.revenue_cents || 0);

      const payout =
        costBasis === 'redeemed'
          ? Number(r?.payout_redeemed_cents || 0)
          : Number(r?.payout_issued_cents || 0);

      const profit =
        costBasis === 'redeemed'
          ? Number(r?.profit_redeemed_cents || 0)
          : Number(r?.profit_issued_cents || 0);

      cum += profit;

      return {
        date: iso,
        spins,
        revenue,
        payout,
        profit,
        cum_profit: cum,
      };
    });

    return { series };
  }, [qTs.data?.days, range.from, range.to, costBasis]);

  const isLoading = qStats.isLoading || qTs.isLoading;
  const isError = qStats.isError || qTs.isError;

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">
            Факт по спинам (wheel_spins) + прогноз EV/ROI (по весам/себестоимости/цене спина).
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="wheelQuickWrap">
            <div className="sg-tabs wheelMiniTabs wheelQuickTabs">
              <button
                type="button"
                className={'sg-tab ' + (quick === 'day' ? 'is-active' : '')}
                onClick={() => pickQuick('day')}
              >
                День
              </button>

              <button
                type="button"
                className={'sg-tab ' + (quick === 'week' ? 'is-active' : '')}
                onClick={() => pickQuick('week')}
              >
                Неделя
              </button>

              <button
                type="button"
                className={'sg-tab ' + (quick === 'month' ? 'is-active' : '')}
                onClick={() => pickQuick('month')}
              >
                Месяц
              </button>

              <button
                type="button"
                className={'sg-tab ' + (quick === 'custom' ? 'is-active' : '')}
                onClick={() => pickQuick('custom')}
              >
                Свой период
              </button>
            </div>

            {quick === 'custom' && (
              <div className="wheelQuickRange">
                <span className="wheelQuickLbl">от</span>

                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e: any) => setCustomFrom(e.target.value)}
                  className="wheelQuickDate"
                />

                <span className="wheelQuickLbl">до</span>

                <Input
                  type="date"
                  value={customTo}
                  onChange={(e: any) => setCustomTo(e.target.value)}
                  className="wheelQuickDate"
                />

                <button
                  type="button"
                  className="sg-tab is-active wheelApplyBtn"
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

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          {/* ====== ФАКТ ГРАФИК ====== */}
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Факт: выручка / расход / прибыль</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="wheelChartBtns" role="tablist" aria-label="Слои графика">
                <button
                  type="button"
                  className={'wheelChartBtn wheelChartBtn--text ' + (costBasis === 'issued' ? 'is-active' : '')}
                  onClick={() => setCostBasis('issued')}
                  title="Факт расхода считаем в момент выигрыша"
                >
                  при выигрыше
                </button>
                <button
                  type="button"
                  className={'wheelChartBtn wheelChartBtn--text ' + (costBasis === 'redeemed' ? 'is-active' : '')}
                  onClick={() => setCostBasis('redeemed')}
                  title="Факт расхода считаем по факту выдачи"
                >
                  при выдаче
                </button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showRevenue ? 'is-active' : '')}
                  onClick={() => setShowRevenue(v => !v)}
                  title="Выручка"
                  aria-label="Выручка"
                ><IcoMoney /></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showPayout ? 'is-active' : '')}
                  onClick={() => setShowPayout(v => !v)}
                  title="Расход"
                  aria-label="Расход"
                ><IcoPay /></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showProfitBars ? 'is-active' : '')}
                  onClick={() => setShowProfitBars(v => !v)}
                  title="Прибыль (столбики)"
                  aria-label="Прибыль"
                >П</button>
              </div>
            </div>

            <div className="wheelChartWrap">
              <div className={'wheelChart is-area'}>
                {!isLoading && !isError && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={moneySeries.series}
                      margin={{ top: 8, right: 18, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                        tickFormatter={(v: any) => fmtDDMM(String(v || ''))}
                      />

                      <YAxis
                        yAxisId="day"
                        tick={{ fontSize: 12 }}
                        width={54}
                        tickFormatter={(v: any) => {
                          const n = Number(v);
                          if (!Number.isFinite(n)) return '';
                          return String(Math.round(n / 100));
                        }}
                      />

                      <Tooltip
                        formatter={(val: any, name: any) => {
                          if (name === 'profit') return [moneyFromCent(val, currency), 'Прибыль/день'];
                          if (name === 'revenue') return [moneyFromCent(val, currency), 'Выручка/день'];
                          if (name === 'payout') return [moneyFromCent(val, currency), 'Расход/день'];
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
                          fill="var(--accent)"
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
                          stroke="var(--accent2)"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}

                      {showPayout && (
                        <Line
                          yAxisId="day"
                          type="monotone"
                          dataKey="payout"
                          name="payout"
                          stroke="var(--accent2)"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {isLoading && (
                <div className="wheelChartOverlay">
                  <div className="wheelSpinner" />
                  <div className="wheelChartOverlayText">Загрузка…</div>
                </div>
              )}

              {isError && (
                <div className="wheelChartOverlay">
                  <div className="wheelChartOverlayText">
                    Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              )}
            </div>

            <div className="wheelUnderTabs" style={{ marginTop: 10 }}>
              <div className="sg-tabs wheelUnderTabs__seg">
                <button
                  className={'sg-tab ' + (tab === 'summary' ? 'is-active' : '')}
                  onClick={() => setTab('summary')}
                >
                  Сводка
                </button>
                <button
                  className={'sg-tab ' + (tab === 'forecast' ? 'is-active' : '')}
                  onClick={() => setTab('forecast')}
                >
                  Прогноз
                </button>
                <button
                  className={'sg-tab ' + (tab === 'stock' ? 'is-active' : '')}
                  onClick={() => setTab('stock')}
                >
                  Склад
                </button>
              </div>

              {/* ===== TAB: SUMMARY (ФАКТ) — PRO ===== */}
              {tab === 'summary' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Сводка (ФАКТ)</div>
                      <div className="wheelCardSub">
                        История берётся из <b>wheel_spins</b> (timeseries). База расхода:{' '}
                        <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>.
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const n = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
                    const clamp0 = (x: number) => (Number.isFinite(x) ? Math.max(0, x) : 0);

                    const spins = clamp0(n(period?.spins, 0));
                    const days = Math.max(1, clamp0(n(period?.days, 1)));

                    const revenue = Math.round(n(period?.revenue, 0));
                    const payout = Math.round(n(period?.payout, 0));
                    const profit = Math.round(Number.isFinite(Number(period?.profit)) ? Number(period?.profit) : (revenue - payout));

                    const revPerSpin = spins > 0 ? Math.round(revenue / spins) : 0;
                    const payPerSpin = spins > 0 ? Math.round(payout / spins) : 0;
                    const profPerSpin = spins > 0 ? Math.round(profit / spins) : 0;

                    const revPerDay = Math.round(revenue / days);
                    const payPerDay = Math.round(payout / days);
                    const profPerDay = Math.round(profit / days);

                    const wins = clamp0(n(fact?.wins, 0));
                    const redeemed = clamp0(n(fact?.redeemed, 0));
                    const redeemRatePct = clamp0(n(fact?.redeemRatePct, 0));

                    const totalPrizes = Array.isArray(items) ? items.length : 0;
                    const activePrizes = clamp0(n(activeCount, 0));

                    const trackedCount = clamp0(n(inventory?.trackedCount, 0));
                    const outCount = clamp0(n(inventory?.outOfStockCount, 0));
                    const lowCount = clamp0(n(inventory?.lowStockCount, 0));
                    const autoOffCount = clamp0(n(inventory?.autoOffCount, 0));
                    const lowThr = clamp0(n(inventory?.lowThreshold, 3));

                    const profitTone = (() => {
                      const m = revenue > 0 ? (profit / revenue) : 0;
                      if (revenue <= 0) return { text: 'нет данных', cls: 'is-neutral' as const };
                      if (m >= 0.25) return { text: 'сильно', cls: 'is-good' as const };
                      if (m >= 0.05) return { text: 'норм', cls: 'is-warn' as const };
                      if (m >= 0) return { text: 'на грани', cls: 'is-warn' as const };
                      return { text: 'минус', cls: 'is-bad' as const };
                    })();

                    const redeemTone = (() => {
                      if (wins <= 0) return { text: '—', cls: 'is-neutral' as const };
                      if (redeemRatePct >= 70) return { text: 'ок', cls: 'is-good' as const };
                      if (redeemRatePct >= 40) return { text: 'средне', cls: 'is-warn' as const };
                      return { text: 'низко', cls: 'is-bad' as const };
                    })();

                    const stockTone = (() => {
                      if (trackedCount <= 0) return { text: 'склад выкл', cls: 'is-neutral' as const };
                      if (outCount > 0) return { text: `ноль: ${outCount}`, cls: 'is-bad' as const };
                      if (lowCount > 0) return { text: `мало: ${lowCount}`, cls: 'is-warn' as const };
                      return { text: 'в норме', cls: 'is-good' as const };
                    })();

                    const topEaters = (() => {
                      const coinCent = clamp0(n(coinCostCentPerCoin, 0));
                      const basis = costBasis;

                      const rows = (Array.isArray(items) ? items : []).map((p) => {
                        const kind = normalizeKind(p);
                        const costCoins =
                          kind === 'coins'
                            ? clamp0(n((p as any).coins, 0))
                            : clamp0(n((p as any).cost_coins, 0));

                        const qty = basis === 'redeemed' ? clamp0(n((p as any).redeemed, 0)) : clamp0(n((p as any).wins, 0));

                        const estCoins = costCoins * qty;
                        const estCent = Math.round(estCoins * coinCent);

                        const tracked = isTracked(p);
                        const swz = isStopWhenZero(p);
                        const q = qtyLeft(p);
                        const out = tracked && swz && q !== null && q <= 0;

                        return {
                          code: p.prize_code,
                          title: p.title || p.prize_code,
                          kind,
                          qty,
                          costCoins,
                          estCoins,
                          estCent,
                          out,
                        };
                      });

                      const total = rows.reduce((s, r) => s + r.estCent, 0);
                      const sorted = rows
                        .filter((r) => r.estCent > 0 && r.qty > 0)
                        .sort((a, b) => b.estCent - a.estCent)
                        .slice(0, 6)
                        .map((r) => ({
                          ...r,
                          sharePct: total > 0 ? Math.round((r.estCent / total) * 100) : 0,
                        }));

                      return { totalCent: total, list: sorted };
                    })();

                    const recs = (() => {
                      const out: Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];

                      if (revenue > 0 && profit < 0) {
                        out.push({
                          tone: 'bad',
                          title: 'Период в минусе',
                          body: 'Проверь “что съедает прибыль” ниже: там топ-призы по расходу. Обычно лечится снижением их доли (шанс/себестоимость) или повышением цены спина.',
                        });
                      } else if (revenue > 0 && profit >= 0) {
                        out.push({
                          tone: 'good',
                          title: 'Период в плюсе',
                          body: 'Следи за расходом/спин и складом: нули и “мало” часто ломают стабильность и создают перекосы по выдаче.',
                        });
                      }

                      if (wins > 0 && redeemRatePct < 40) {
                        out.push({
                          tone: 'warn',
                          title: 'Низкая выдача призов',
                          body: 'Если выдача низкая — люди могут “не доходить до кассы”. Подумай про более понятный CTA, напоминания и упрощение получения.',
                        });
                      }

                      if (trackedCount > 0 && outCount > 0) {
                        out.push({
                          tone: 'bad',
                          title: 'Есть призы с нулём на складе',
                          body: 'Если приз дефицитный — включай “авто-выкл при 0”, иначе экономика и UX будут дергаться.',
                        });
                      }

                      if (trackedCount <= 0) {
                        out.push({
                          tone: 'warn',
                          title: 'Склад выключен',
                          body: 'Для физических призов лучше включить “учёт остатков” + “авто-выкл”, чтобы дорогие позиции не выпадали при нуле.',
                        });
                      }

                      return out.slice(0, 4);
                    })();

                    const recToneCls = (t: string) => (t ? `is-${t}` : '');

                    return (
                      <div className="wheelSummaryPro" style={{ paddingTop: 12 }}>
                        <div className="summaryGrid2">
                          <div className="sg-pill summaryCard">
                            <div className="summaryCardHead">
                              <div className="summaryCardTitle">Ключевые метрики</div>
                              <span className={'sumBadge ' + profitTone.cls}>
                                {profitTone.text}
                              </span>
                            </div>

                            <div className="summaryRows">
                              <div className="summaryRow">
                                <span className="sg-muted">Спинов</span>
                                <b>{spins}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Выручка</span>
                                <b>{moneyFromCent(revenue, currency)}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Расход</span>
                                <b>{moneyFromCent(payout, currency)}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">
                                  Прибыль <span className="sg-muted">· база:</span>{' '}
                                  <b>{costBasis === 'issued' ? 'выигрыш' : 'выдача'}</b>
                                </span>
                                <b>{moneyFromCent(profit, currency)}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">На 1 спин</span>
                                <b>
                                  {moneyFromCent(revPerSpin, currency)} / {moneyFromCent(payPerSpin, currency)} / {moneyFromCent(profPerSpin, currency)}
                                </b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">В день (среднее)</span>
                                <b>
                                  {moneyFromCent(revPerDay, currency)} / {moneyFromCent(payPerDay, currency)} / {moneyFromCent(profPerDay, currency)}
                                </b>
                              </div>
                            </div>
                          </div>

                          <div className="sg-pill summaryCard">
                            <div className="summaryCardHead">
                              <div className="summaryCardTitle">Операционка</div>
                              <span className={'sumBadge ' + redeemTone.cls}>
                                выдача {redeemTone.text}
                              </span>
                            </div>

                            <div className="summaryRows">
                              <div className="summaryRow">
                                <span className="sg-muted">Выигрышей</span>
                                <b>{wins}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Выдано</span>
                                <b>{redeemed}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Доля выдачи</span>
                                <b>{redeemRatePct}%</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Активных призов</span>
                                <b>{activePrizes} / {totalPrizes}</b>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">Склад</span>
                                <span className={'sumBadge ' + stockTone.cls}>{stockTone.text}</span>
                              </div>

                              <div className="summaryRow">
                                <span className="sg-muted">
                                  Остатки: ноль / мало (≤ {lowThr}) / авто-выкл
                                </span>
                                <b>{outCount} / {lowCount} / {autoOffCount}</b>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="sg-pill summaryCard" style={{ marginTop: 12 }}>
                          <div className="summaryCardHead">
                            <div className="summaryCardTitle">Что сильнее всего “съедает” расход</div>
                            <span className="sumBadge is-neutral">
                              оценка: {costBasis === 'issued' ? 'wins×cost' : 'redeemed×cost'}
                            </span>
                          </div>

                          {topEaters.list.length ? (
                            <div className="summaryTopList">
                              {topEaters.list.map((r) => {
                                const w = Math.max(3, Math.min(100, r.sharePct));
                                return (
                                  <div key={r.code} className="summaryTopRow">
                                    <div className="summaryTopLeft">
                                      <div className="summaryTopTitle">
                                        <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {r.title}
                                        </b>
                                        <span className="sg-muted">·</span>
                                        <span className="sg-muted">{r.kind === 'coins' ? 'монеты' : 'товар'}</span>
                                        {r.out ? (
                                          <span className="sumBadge is-bad" style={{ marginLeft: 8 }}>ноль+авто-выкл</span>
                                        ) : null}
                                      </div>

                                      <div className="summaryTopBar" aria-hidden="true">
                                        <div className="summaryTopBarFill" style={{ width: `${w}%` }} />
                                      </div>
                                    </div>

                                    <div className="summaryTopRight">
                                      <div className="summaryTopMoney">{moneyFromCent(r.estCent, currency)}</div>
                                      <div className="summaryTopPct">{r.sharePct}% · {r.qty} шт</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="sg-muted" style={{ padding: '8px 2px' }}>
                              Пока нечего показать: нет себестоимости (cost_coins/coins) или нет wins/redeemed за период.
                            </div>
                          )}
                        </div>

                        {recs.length ? (
                          <div className="sg-pill summaryCard" style={{ marginTop: 12 }}>
                            <div className="summaryCardHead">
                              <div className="summaryCardTitle">Рекомендации</div>
                              <span className="sumBadge is-neutral">по факту периода</span>
                            </div>

                            <div className="forecastRecsGrid" style={{ marginTop: 0 }}>
                              {recs.map((r, i) => (
                                <div key={i} className={'forecastRecCard ' + recToneCls(r.tone)}>
                                  <div className="forecastRecTitle">{r.title}</div>
                                  <div className="forecastRecBody">{r.body}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ===== TAB: FORECAST (PRO) ===== */}
              {tab === 'forecast' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Прогноз: прибыль и окупаемость</div>
                      <div className="wheelCardSub">
                        Это планирование по текущим настройкам (не история). Расход фиксируем{' '}
                        <b>{costBasis === 'issued' ? 'в момент выигрыша' : 'в момент выдачи'}</b>.
                        <span className="sg-muted"> “EV” = средний расход на призы на 1 спин.</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const toNum = (v: any, d = 0) => {
                      const n = Number(String(v ?? '').replace(',', '.').trim());
                      return Number.isFinite(n) ? n : d;
                    };
                    const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
                    const money = (c: number) => moneyFromCent(Math.round(c || 0), currency);

                    const coinCent = clamp0(coinCostCentPerCoin || 0);

                    const spinCostCoinsForecast2 = Math.max(0, Math.round(toNum(spinCostCoinsDraft, 0)));
                    const spinsPerDayDraftRaw = String(spinsPerDayDraft ?? '').trim();
                    const spinsPerDayAuto =
                      period && period.days > 0 ? (period.spins / Math.max(1, period.days)) : 0;
                    const spinsPerDayBase =
                      spinsPerDayDraftRaw === ''
                        ? Math.max(0, spinsPerDayAuto)
                        : Math.max(0, toNum(spinsPerDayDraftRaw, 0));

                    const revenuePerSpinCent = clamp0(spinCostCoinsForecast2 * coinCent);
                    const avgPayoutPerSpinCent = clamp0(ev?.payoutCent ?? 0);
                    const avgProfitPerSpinCent = Math.round(revenuePerSpinCent - avgPayoutPerSpinCent);
                    const roi = revenuePerSpinCent > 0 ? (avgProfitPerSpinCent / revenuePerSpinCent) : null;

                    const sigmaPerSpinCent = (() => {
                      const s = (ev as any)?.sigmaCent;
                      if (Number.isFinite(s)) return Math.max(0, Math.round(s));
                      return Math.max(0, Math.round(avgPayoutPerSpinCent * 0.6));
                    })();

                    const calc = (spinsPerDay: number) => {
                      const spinsDay = Math.max(0, spinsPerDay);
                      const revDay = revenuePerSpinCent * spinsDay;
                      const payDay = avgPayoutPerSpinCent * spinsDay;
                      const profDay = (revenuePerSpinCent - avgPayoutPerSpinCent) * spinsDay;

                      const bandLow = profDay - sigmaPerSpinCent * spinsDay;
                      const bandHigh = profDay + sigmaPerSpinCent * spinsDay;

                      return {
                        spinsDay,
                        revDay,
                        payDay,
                        profDay,
                        bandLow,
                        bandHigh,
                        rev30: revDay * 30,
                        pay30: payDay * 30,
                        prof30: profDay * 30,
                      };
                    };

                    const scenarios = [
                      { key: 'safe' as const, title: 'Осторожно', k: 0.7, hint: 'меньше трафика/кручений' },
                      { key: 'base' as const, title: 'База', k: 1.0, hint: 'как сейчас' },
                      { key: 'aggr' as const, title: 'Агрессивно', k: 1.3, hint: 'акции/трафик выше' },
                    ];

                    const base = calc(spinsPerDayBase);

                    const getScenarioProfitDay = (key: 'safe' | 'base' | 'aggr') => {
                      const s = scenarios.find(x => x.key === key) || scenarios[1];
                      return calc(spinsPerDayBase * s.k).profDay;
                    };

                    const sc = scenarios.find(x => x.key === forecastScenario) || scenarios[1];
                    const chosen = calc(spinsPerDayBase * sc.k);

                    const profitToneCls = avgProfitPerSpinCent >= 0 ? 'forecastGood' : 'forecastBad';

                    const target = forecastTargetMargin;
                    const needRevenueBreakevenCent = avgPayoutPerSpinCent;
                    const needCoinsBreakeven = coinCent > 0 ? Math.ceil(needRevenueBreakevenCent / coinCent) : null;

                    const needRevenueTargetCent =
                      (1 - target) > 0 ? Math.ceil(avgPayoutPerSpinCent / (1 - target)) : avgPayoutPerSpinCent;
                    const needCoinsTarget = coinCent > 0 ? Math.ceil(needRevenueTargetCent / coinCent) : null;

                    const risksRaw = (ev as any)?.risks;
                    const risks: any[] = Array.isArray(risksRaw) ? risksRaw : (ev?.topRisk ? [ev.topRisk] : []);
                    const top3 = [...risks]
                      .sort((a, b) => (Number(b?.expCent ?? 0) - Number(a?.expCent ?? 0)))
                      .slice(0, 3);

                    const recs: Array<{ tone?: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];

                    if (coinCent > 0) {
                      if (avgProfitPerSpinCent < 0) {
                        recs.push({
                          tone: 'bad',
                          title: 'Подними цену спина (быстрый фикс)',
                          body:
                            `Чтобы выйти в ноль: ≈ ${needCoinsBreakeven ?? '—'} монет/спин (сейчас ${spinCostCoinsForecast2}). ` +
                            `Для цели маржи ${Math.round(target * 100)}%: ≈ ${needCoinsTarget ?? '—'} монет/спин.`,
                        });
                      } else {
                        recs.push({
                          tone: 'good',
                          title: 'Цена спина выглядит ок',
                          body:
                            `Плановая прибыль/спин ≈ ${money(avgProfitPerSpinCent)}. ` +
                            `Чтобы держать цель маржи ${Math.round(target * 100)}% при текущих расходах — держи цену не ниже ≈ ${needCoinsTarget ?? '—'} монет/спин.`,
                        });
                      }
                    } else {
                      recs.push({
                        tone: 'warn',
                        title: 'Заполни стоимость монеты',
                        body: 'Для корректного прогноза нужен курс: “1 монета = …” в блоке ниже “Склад”.',
                      });
                    }

                    if (top3.length && avgProfitPerSpinCent < 0) {
                      const top = top3[0];
                      const needCutCent = Math.min(Math.abs(avgProfitPerSpinCent), Math.round(top.expCent ?? 0));
                      const pct = (top.expCent ?? 0) > 0 ? Math.round((needCutCent / top.expCent) * 100) : 0;
                      recs.push({
                        tone: 'warn',
                        title: `Снизь влияние приза “${top.title}”`,
                        body:
                          `Он даёт ~${money(Math.round(top.expCent ?? 0))} расхода на спин. ` +
                          `Чтобы приблизиться к нулю — уменьши вклад примерно на ${money(needCutCent)} (~${pct}%). ` +
                          `Обычно это: уменьшить шанс (weight) или себестоимость.`,
                      });
                    }

                    recs.push({
                      tone: 'warn',
                      title: 'Для дефицитных призов включай “остатки + авто-выкл”',
                      body:
                        'Так дорогие призы не будут выпадать при нуле/дефиците. Это стабилизирует экономику колеса.',
                    });

                    const recsFinal = recs.slice(0, 4);

                    return (
                      <>
                        <div className="forecastGrid2" style={{ marginTop: 12 }}>
                          <div className="sg-pill forecastCard">
                            <div className="forecastHead">
                              <div className="forecastLbl">Цена спина (монет)</div>
                              <span
                                className="forecastTip"
                                data-tip="Только для прогноза. Реальная цена задаётся в настройках колеса."
                              />
                            </div>
                            <Input
                              value={spinCostCoinsDraft}
                              onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)}
                              placeholder="10"
                            />
                            <div className="forecastSub">
                              Выручка / спин ≈ <b>{money(revenuePerSpinCent)}</b>
                            </div>
                          </div>

                          <div className="sg-pill forecastCard">
                            <div className="forecastHead">
                              <div className="forecastLbl">Спинов / день</div>
                              <span
                                className="forecastTip"
                                data-tip="Пусто = авто по истории периода. Можно задать вручную."
                              />
                            </div>
                            <Input
                              value={spinsPerDayDraft}
                              onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                              placeholder="пусто = авто"
                            />
                            <div className="forecastSub">
                              авто: <b>{spinsPerDayAuto.toFixed(2)}</b> / день
                            </div>
                          </div>
                        </div>

                        <div className="wheelSummaryPro" style={{ paddingTop: 12 }}>
                          <div className="wheelSummaryTiles">
                            <div className="wheelSumTile">
                              <div className="wheelSumLbl">Выручка / спин</div>
                              <div className="wheelSumVal">{money(revenuePerSpinCent)}</div>
                              <div className="sg-muted" style={{ marginTop: 4 }}>
                                {spinCostCoinsForecast2} монет / спин
                              </div>
                            </div>

                            <div className="wheelSumTile">
                              <div className="wheelSumLbl">
                                Средний расход на призы / спин
                                <span
                                  className="forecastInlineTip"
                                  data-tip="EV (expected value) = средний расход на призы на один спин."
                                />
                              </div>
                              <div className="wheelSumVal">{money(avgPayoutPerSpinCent)}</div>
                              <div className="sg-muted" style={{ marginTop: 4 }}>
                                {(ev?.payoutCoins ?? 0).toFixed(2)} монет / спин
                              </div>
                            </div>

                            <div className={'wheelSumTile is-strong ' + profitToneCls}>
                              <div className="wheelSumLbl">Плановая прибыль / спин</div>
                              <div className="wheelSumVal">{money(avgProfitPerSpinCent)}</div>
                              <div className="sg-muted" style={{ marginTop: 4 }}>
                                {(ev?.profitCoins ?? 0).toFixed(2)} монет / спин
                              </div>
                            </div>
                          </div>

                          <div className="forecastGrid2" style={{ marginTop: 10 }}>
                            <div className="sg-pill forecastCardMini">
                              <div className="forecastLbl">План (база)</div>

                              <div className="forecastRow">
                                <span className="sg-muted">Выручка/день:</span> <b>{money(base.revDay)}</b>
                              </div>
                              <div className="forecastRow">
                                <span className="sg-muted">Расход/день:</span> <b>{money(base.payDay)}</b>
                              </div>
                              <div className="forecastRow forecastRowWrap">
                                <span className="sg-muted">Прибыль/день:</span> <b>{money(base.profDay)}</b>
                                <span className="forecastRange">
                                  диапазон: <b>{money(base.bandLow)}</b> … <b>{money(base.bandHigh)}</b>
                                </span>
                              </div>

                              <div className="forecastSub">
                                За 30 дней: прибыль ≈ <b>{money(base.prof30)}</b>
                              </div>
                            </div>

                            <div className="sg-pill forecastCardMini">
                              <div className="forecastLbl">Окупаемость</div>

                              <div className="forecastRow">
                                <span className="sg-muted">Маржа:</span> <b>{roi === null ? '—' : fmtPct(roi)}</b>
                              </div>
                              <div className="forecastRow">
                                <span className="sg-muted">Окупаемость (ярлык):</span> <b>{breakEvenLabel}</b>
                              </div>

                              <div className="forecastSub">
                                Цель маржи: <b>{Math.round(target * 100)}%</b>{' '}
                                {coinCent > 0 && needCoinsTarget !== null ? (
                                  <span className="sg-muted">· цена спина ≈ {needCoinsTarget} монет</span>
                                ) : null}
                              </div>

                              <div className="forecastTargetBar">
                                <button
                                  type="button"
                                  className={'forecastTargetBtn ' + (forecastTargetMargin === 0.1 ? 'is-active' : '')}
                                  onClick={() => setForecastTargetMargin(0.1)}
                                >
                                  10%
                                </button>
                                <button
                                  type="button"
                                  className={'forecastTargetBtn ' + (forecastTargetMargin === 0.2 ? 'is-active' : '')}
                                  onClick={() => setForecastTargetMargin(0.2)}
                                >
                                  20%
                                </button>
                                <button
                                  type="button"
                                  className={'forecastTargetBtn ' + (forecastTargetMargin === 0.3 ? 'is-active' : '')}
                                  onClick={() => setForecastTargetMargin(0.3)}
                                >
                                  30%
                                </button>
                              </div>
                            </div>
                          </div>

                          {top3.length ? (
                            <div className="sg-pill forecastRisk" style={{ marginTop: 10 }}>
                              <div className="forecastLbl">Что сильнее всего “съедает” прибыль</div>

                              <div className="forecastRiskList">
                                {top3.map((x, idx) => (
                                  <div key={idx} className="forecastRiskRow">
                                    <div className="forecastRiskTitle">
                                      <b>{x.title}</b>
                                      <span className="sg-muted"> · вклад в средний расход:</span>{' '}
                                      <b>{money(Math.round(x.expCent ?? 0))}</b>
                                      <span className="sg-muted"> / спин</span>
                                    </div>
                                    <div className="forecastRiskSub sg-muted">
                                      подсказка: уменьши шанс / себестоимость / включи остатки и авто-выкл (если приз дефицитный)
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {recsFinal.length ? (
                            <div className="sg-pill forecastRecs" style={{ marginTop: 10 }}>
                              <div className="forecastLbl">Рекомендации</div>
                              <div className="forecastRecsGrid">
                                {recsFinal.map((r, i) => (
                                  <div key={i} className={'forecastRecCard ' + (r.tone ? `is-${r.tone}` : '')}>
                                    <div className="forecastRecTitle">{r.title}</div>
                                    <div className="forecastRecBody">{r.body}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="sg-pill forecastScenarios" style={{ marginTop: 10 }}>
                            <div className="forecastScTop">
                              <div className="forecastLbl">Сценарии</div>

                              <div className="forecastTabs">
                                {(['safe', 'base', 'aggr'] as const).map((k) => {
                                  const pDay = getScenarioProfitDay(k);
                                  const badgeCls = pDay >= 0 ? 'is-good' : 'is-bad';
                                  const title = scenarios.find(s => s.key === k)?.title || k;
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      className={'forecastTabBtn ' + (forecastScenario === k ? 'is-active' : '')}
                                      onClick={() => setForecastScenario(k)}
                                    >
                                      <span className="forecastTabTitle">{title}</span>
                                      <span className={'forecastTabBadge ' + badgeCls}>
                                        {money(pDay)}
                                        <span className="forecastTabBadgeSub">/день</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="forecastScBody">
                              <div className="forecastScMeta">
                                <div className="forecastScTitle">
                                  <b>{sc.title}</b>
                                  <span className="sg-muted"> · {sc.hint}</span>
                                </div>
                                <div className="forecastScNumbers">
                                  <span className="sg-muted">спины/день:</span> <b>{chosen.spinsDay.toFixed(1)}</b>
                                </div>
                              </div>

                              <div className="forecastGrid2" style={{ marginTop: 10 }}>
                                <div className="forecastScenarioCard">
                                  <div className="forecastLbl">В день</div>
                                  <div className="forecastRow"><span className="sg-muted">Выручка:</span> <b>{money(chosen.revDay)}</b></div>
                                  <div className="forecastRow"><span className="sg-muted">Расход:</span> <b>{money(chosen.payDay)}</b></div>
                                  <div className="forecastRow forecastRowWrap">
                                    <span className="sg-muted">Прибыль:</span> <b>{money(chosen.profDay)}</b>
                                    <span className="forecastRange">
                                      диапазон: <b>{money(chosen.bandLow)}</b> … <b>{money(chosen.bandHigh)}</b>
                                    </span>
                                  </div>
                                </div>

                                <div className="forecastScenarioCard">
                                  <div className="forecastLbl">За 30 дней</div>
                                  <div className="forecastRow"><span className="sg-muted">Выручка:</span> <b>{money(chosen.rev30)}</b></div>
                                  <div className="forecastRow"><span className="sg-muted">Расход:</span> <b>{money(chosen.pay30)}</b></div>
                                  <div className="forecastRow"><span className="sg-muted">Прибыль:</span> <b>{money(chosen.prof30)}</b></div>
                                  <div className="forecastSub">Это планирование “по текущим настройкам”.</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="sg-muted" style={{ marginTop: 12 }}>
                            ДЛЯ РАЗРАБОТЧИКА: Вычислять среднюю себестоимость призов из реальной картины и расчитывать на шанс и использовать в расчетах рекомендациях.
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ===== TAB: STOCK (ТОЛЬКО СКЛАД) ===== */}
              {tab === 'stock' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Склад призов</div>
                      <div className="wheelCardSub">
                        Тут правим live-поля в <b>wheel_prizes</b>: <b>active / track_qty / qty_left / stop_when_zero</b>.
                        <br />
                        Если включены <b>track_qty</b> + <b>stop_when_zero</b> и <b>qty_left ≤ 0</b> — приз <b>не выпадает</b>.
                      </div>
                    </div>
                  </div>

                  <div className="wheelTableWrap stockWrap" style={{ marginTop: 12 }}>
                    <table className="sg-table stockTable">
                      <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                      </colgroup>

                      <thead>
                        <tr>
                          <th>Название</th>
                          <th className="stockThCtr">Активен</th>
                          <th className="stockThCtr">Учёт остатков</th>
                          <th className="stockThCtr">Остаток</th>
                          <th className="stockThCtr">Авто-выкл</th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map((p) => {
                          const code = p.prize_code;

                          const d = draft[code] || {
                            active: !!p.active,
                            track_qty: !!p.track_qty,
                            qty_left: (p.qty_left === null || p.qty_left === undefined) ? '' : String(p.qty_left),
                            stop_when_zero: !!p.stop_when_zero,
                          };

                          const active = !!d.active;

                          const tracked = active && !!d.track_qty;

                          const qRaw = String(d.qty_left ?? '').trim();
                          const baseQty = qtyLeft(p) ?? 0;
                          const qNum = tracked ? (qRaw === '' ? baseQty : Math.max(0, toInt(qRaw, 0))) : null;

                          const out = tracked && (qNum !== null && qNum <= 0);
                          const low = tracked && (qNum !== null && qNum > 0 && qNum <= inventory.lowThreshold);
                          const swz = tracked && !!d.stop_when_zero;

                          const rowCls =
                            !active
                              ? 'stockRowState is-off'
                              : tracked
                                ? (out ? 'stockRowState is-out' : (low ? 'stockRowState is-low' : 'stockRowState is-on'))
                                : 'stockRowState is-on';

                          const tipActive = active ? 'Включен · приз участвует' : 'Выключен · приз не выпадает';

                          const tipTrack = !active
                            ? 'Выключено · сначала включи приз'
                            : (tracked ? 'Включен · учитываем qty_left' : 'Выключен · склад не считаем');

                          const tipQty = !active
                            ? 'Выключено · сначала включи приз'
                            : (tracked ? 'Ввод · кол-во на складе' : 'Выключено · включи учёт остатков');

                          const tipSwz = !active
                            ? 'Выключено · сначала включи приз'
                            : (!tracked
                              ? 'Выключено · включи учёт остатков'
                              : (swz ? 'Включен · при 0 приз не выпадает' : 'Выключен · при 0 приз может выпадать'));

                          return (
                            <tr key={code} className={rowCls}>
                              <td className="stockTdTitle">
                                <div className="stockTitle">
                                  <div className="stockTitleMain">{p.title || code}</div>
                                  <div className="stockTitleSub">
                                    {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'}
                                    <span className="stockDot">·</span>
                                    <span className="sg-muted">код:</span> <b>{code}</b>
                                  </div>
                                </div>
                              </td>

                              <td className="stockTdCtr">
                                <div className="stockCtlCtr">
                                  <div className="stockTip" data-tip={tipActive}>
                                    <Switch
                                      checked={active}
                                      disabled={false}
                                      onChange={(v: boolean) => {
                                        if (!v) {
                                          patchDraft(code, {
                                            active: false,
                                            track_qty: false,
                                            stop_when_zero: false,
                                            qty_left: '',
                                          });
                                          return;
                                        }
                                        patchDraft(code, { active: true });
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="stockTdCtr">
                                <div className="stockCtlCtr">
                                  <div className={'stockTip ' + (!active ? 'is-disabled' : '')} data-tip={tipTrack}>
                                    <Switch
                                      checked={tracked}
                                      disabled={!active}
                                      onChange={(v: boolean) => {
                                        if (!active) return;
                                        if (!v) {
                                          patchDraft(code, { track_qty: false, stop_when_zero: false, qty_left: '' });
                                          return;
                                        }
                                        patchDraft(code, { track_qty: true });
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="stockTdCtr">
                                <div className="stockQtyCell">
                                  {out && swz ? (
                                    <div className="stockWarn is-out">Закончились — приз не выпадает</div>
                                  ) : null}

                                  {!out && low ? (
                                    <div className="stockWarn is-low">Скоро закончатся (≤ {inventory.lowThreshold})</div>
                                  ) : null}

                                  <div className={'stockTip ' + (!tracked ? 'is-disabled' : '')} data-tip={tipQty}>
                                    <Input
                                      type="number"
                                      inputMode="numeric"
                                      value={tracked ? d.qty_left : ''}
                                      disabled={!tracked}
                                      onChange={(e: any) => patchDraft(code, { qty_left: e.target.value })}
                                      placeholder={tracked ? '0' : '—'}
                                      className="stockQtyInput"
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="stockTdCtr">
                                <div className="stockCtlCtr">
                                  <div className={'stockTip ' + (!tracked ? 'is-disabled' : '')} data-tip={tipSwz}>
                                    <Switch
                                      checked={swz}
                                      disabled={!tracked}
                                      onChange={(v: boolean) => {
                                        if (!tracked) return;
                                        patchDraft(code, { stop_when_zero: v });
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {!items.length && !qStats.isLoading && (
                          <tr>
                            <td colSpan={5} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="stockBottomBar">
                    <div className="sg-muted">
                      {saveMsg ? <b>{saveMsg}</b> : 'Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.'}
                    </div>

                    <button
                      type="button"
                      className="sg-tab is-active stockSaveBtn"
                      disabled={saving || qStats.isLoading || !appId}
                      onClick={saveStock}
                    >
                      {saving ? 'Сохраняю…' : 'Сохранить склад'}
                    </button>
                  </div>

                  <div className="sg-pill" style={{ padding: '12px 12px', marginTop: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Стоимость монеты и валюта</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'end' }}>
                      <div>
                        <div className="sg-muted" style={{ marginBottom: 6 }}>
                          Стоимость 1 монеты ({currencyLabel(currencyDraft)})
                        </div>
                        <Input
                          value={coinValueDraft}
                          onChange={(e: any) => setCoinValueDraft(e.target.value)}
                          placeholder="1.00"
                        />
                        <div className="sg-muted" style={{ marginTop: 6 }}>
                          = {moneyFromCent(coinCostCentPerCoin, currencyDraft)} / монета
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
                      <button
                        type="button"
                        className="sg-tab is-active"
                        onClick={saveAppSettings}
                        disabled={savingCoin || !appId}
                      >
                        {savingCoin ? 'Сохраняю…' : 'Сохранить'}
                      </button>

                      {coinMsg ? <span className="sg-muted">{coinMsg}</span> : null}
                      {qSettings.isError ? <span className="sg-muted">settings: ошибка</span> : null}

                      <span className="sg-muted" style={{ marginLeft: 'auto' }}>
                        пример: USD + 0.10 = “1 монета = 10 центов” ✅
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          <Card className="wheelCard" style={{ marginBottom: 12 }}>
            <div className="wheelRedeemBar" style={{ marginTop: 0 }}>
              <div className="wheelRedeemTop">
                <div className="wheelRedeemName">Выдача призов</div>
                <div className={"wheelRedeemBadge " + redeemTag.cls}>
                  {redeemTag.text}
                </div>
              </div>

              <div className="wheelBarTrack" aria-hidden="true">
                <div
                  className="wheelBarFill"
                  style={{ width: `${Math.max(0, Math.min(100, fact.redeemRatePct))}%` }}
                />
              </div>

              <div className="wheelRedeemMeta">
                <span className="sg-muted">Выигрышей: <b>{fact.wins}</b></span>
                <span className="sg-muted">Выдано: <b>{fact.redeemed}</b></span>
              </div>
            </div>
          </Card>

          <Card className="wheelCard wheelStickyTop">
            <div className="wheelCardHead wheelTopHead">
              <div className="wheelCardTitle">Топ призов</div>

              <div className="sg-tabs wheelMiniTabs">
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric === 'wins' ? 'is-active' : '')}
                  onClick={() => setTopMetric('wins')}
                >
                  Выигрыши
                </button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric === 'redeemed' ? 'is-active' : '')}
                  onClick={() => setTopMetric('redeemed')}
                >
                  Выдачи
                </button>
              </div>
            </div>

            <div className="wheelTopList">
              {top.map((p, idx) => {
                const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
                const val = Number((p as any)[topMetric]) || 0;
                const w = Math.round((val / max) * 100);

                return (
                  <div className={"wheelTopRowPro " + (idx < 3 ? "is-top" : "")} key={p.prize_code}>
                    <div className={"wheelTopMedal m" + (idx + 1)}>{idx + 1}</div>

                    <div className="wheelTopMid">
                      <div className="wheelTopTitle">{p.title}</div>

                      <div className="wheelTopMini">
                        {topMetric === 'wins'
                          ? `выдачи: ${Number(p.redeemed) || 0}`
                          : `выигрыши: ${Number(p.wins) || 0}`
                        }
                      </div>

                      <div className="wheelTopBar">
                        <div className="wheelTopBarFill" style={{ width: `${w}%` }} />
                      </div>
                    </div>

                    <div className="wheelTopRight">
                      <div className="wheelTopCount">{val}</div>
                    </div>
                  </div>
                );
              })}

              {!top.length && <div className="sg-muted">Пока пусто</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
