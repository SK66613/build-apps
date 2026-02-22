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

  kind?: string;          // "coins" | "item"
  coins?: number;         // for coins-prize

  // ✅ new source of truth for item cost (in coins)
  cost_coins?: number;

  // legacy for UI (may be present)
  cost_cent?: number;
  cost_currency?: string;

  track_qty?: number;       // 0|1
  qty_left?: number | null; // number
  stop_when_zero?: number;  // 0|1
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

function clampN(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
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
function Toggle({
  checked,
  onChange,
  disabled,
  labelOn = 'вкл',
  labelOff = 'выкл',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button
      type="button"
      className={'sg-toggle ' + (checked ? 'is-on' : 'is-off') + (disabled ? ' is-disabled' : '')}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      aria-pressed={checked}
      aria-disabled={!!disabled}
      title={checked ? labelOn : labelOff}
    >
      <span className="sg-toggle__knob" />
      <span className="sg-toggle__txt">{checked ? labelOn : labelOff}</span>
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
    setQuick('custom');
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

  // FACT avg profit/spin for forecast (money)
  const profitPerSpinFact = React.useMemo(() => {
    if (period.spins <= 0) return 0;
    return Math.round(period.profit / Math.max(1, period.spins));
  }, [period.profit, period.spins]);

  const profitPerDayForecast = React.useMemo(() => {
    const manual = Number(String(spinsPerDayDraft).replace(',', '.'));
    const days = Math.max(1, period.days);

    const spinsPerDay =
      (Number.isFinite(manual) && manual >= 0)
        ? manual
        : (period.spins > 0 ? (period.spins / days) : 0);

    const raw = spinsPerDay * profitPerSpinFact;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [spinsPerDayDraft, period.days, period.spins, profitPerSpinFact]);

  const isLoading = qStats.isLoading || qTs.isLoading;
  const isError = qStats.isError || qTs.isError;

  return (
    <div className="sg-page wheelPage">
      {/* quick CSS for toggles (локально, чтобы не зависеть от глобальных) */}
      <style>{`
        .sg-toggle{
          display:inline-flex; align-items:center; gap:10px;
          height:34px; padding:0 10px;
          border-radius:999px;
          border:1px solid rgba(15,23,42,.14);
          background:rgba(255,255,255,.6);
          box-shadow:0 1px 0 rgba(15,23,42,.04);
          cursor:pointer;
          user-select:none;
        }
        .sg-toggle.is-disabled{ opacity:.45; cursor:not-allowed; }
        .sg-toggle__knob{
          width:18px; height:18px; border-radius:999px;
          background:rgba(15,23,42,.25);
          position:relative;
        }
        .sg-toggle.is-on .sg-toggle__knob{ background:var(--accent); }
        .sg-toggle__txt{ font-weight:900; font-size:12px; opacity:.9; }

.wheelChartBtn--text{
  width:auto;
  padding:0 12px;
  font-weight:800;
  font-size:13px;
  border-radius:12px; /* такой же как у обычных wheelChartBtn */
}


.wheelQuickWrap{
  display:flex;
  align-items:stretch;
  gap:0;              /* важно: без зазора между сегментом и датами */
  flex-wrap:nowrap;
}

.wheelQuickTabs{
  border-top-right-radius:0 !important;
  border-bottom-right-radius:0 !important;
}

.wheelQuickRange{
  display:flex;
  align-items:center;
  gap:8px;
  padding:8px 10px;
  border:1px solid rgba(15,23,42,.12);
  border-left:0;      /* чтобы выглядело как единый блок */
  border-top-right-radius:999px;
  border-bottom-right-radius:999px;
  background:rgba(255,255,255,.6);
}

.wheelQuickLbl{
  font-weight:900;
  opacity:.7;
  font-size:12px;
}

.wheelQuickDate{
  width:150px;
}

/* если не помещается по ширине — пусть красиво переносится */
@media (max-width: 1100px){
  .wheelQuickWrap{ flex-wrap:wrap; gap:10px; }
  .wheelQuickTabs{
    border-top-right-radius:999px !important;
    border-bottom-right-radius:999px !important;
  }
  .wheelQuickRange{
    border-left:1px solid rgba(15,23,42,.12);
    border-radius:999px;
  }
}

        
      `}</style>

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
    <button type="button" className={'sg-tab ' + (quick === 'day' ? 'is-active' : '')} onClick={() => pickQuick('day')}>
      День
    </button>
    <button type="button" className={'sg-tab ' + (quick === 'week' ? 'is-active' : '')} onClick={() => pickQuick('week')}>
      Неделя
    </button>
    <button type="button" className={'sg-tab ' + (quick === 'month' ? 'is-active' : '')} onClick={() => pickQuick('month')}>
      Месяц
    </button>
    <button type="button" className={'sg-tab ' + (quick === 'custom' ? 'is-active' : '')} onClick={() => pickQuick('custom')}>
      Свой период
    </button>
  </div>

  {quick === 'custom' && (
    <div className="wheelQuickRange">
      <span className="wheelQuickLbl">от</span>
      <Input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} className="wheelQuickDate" />
      <span className="wheelQuickLbl">до</span>
      <Input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} className="wheelQuickDate" />
      <Button variant="primary" onClick={() => applyRange(customFrom, customTo)} disabled={!customFrom || !customTo}>
        Применить
      </Button>
    </div>
  )}
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

            <div className={'wheelChart is-area'}>
              {isLoading && <div className="sg-muted">Загрузка…</div>}
              {isError && (
                <div className="sg-muted">
                  Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
                </div>
              )}

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

            {/* KPI mini row */}
            <div className="wheelKpiRow">
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Спинов (за период)</div>
                <div className="wheelKpiVal">{period.spins}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Прибыль/день (прогноз)</div>
                <div className="wheelKpiVal">{moneyFromCent(profitPerDayForecast, currency)}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Призы со складом</div>
                <div className="wheelKpiVal">{inventory.trackedCount}</div>
              </div>
            </div>

            <div className="wheelKpiRow" style={{ paddingTop: 0 }}>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Закончились</div>
                <div className="wheelKpiVal">{inventory.outOfStockCount}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Мало (≤ {inventory.lowThreshold})</div>
                <div className="wheelKpiVal">{inventory.lowStockCount}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Авто-выкл при нуле</div>
                <div className="wheelKpiVal">{inventory.autoOffCount}</div>
              </div>
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

              {/* ===== TAB: SUMMARY (ФАКТ) ===== */}
              {tab === 'summary' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Сводка (ФАКТ)</div>
                      <div className="wheelCardSub">История берётся из wheel_spins (timeseries).</div>
                    </div>
                  </div>

                  <div className="wheelSummaryPro" style={{ paddingTop: 0 }}>
                    <div className="wheelSummaryTiles">
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Спинов</div>
                        <div className="wheelSumVal">{period.spins}</div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Выручка</div>
                        <div className="wheelSumVal">{moneyFromCent(period.revenue, currency)}</div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Расход</div>
                        <div className="wheelSumVal">{moneyFromCent(period.payout, currency)}</div>
                        <div className="sg-muted" style={{ marginTop: 4 }}>
                          база: <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>
                        </div>
                      </div>

                      <div className="wheelSumTile is-strong">
                        <div className="wheelSumLbl" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          Прибыль
                          <span className={'wheelRedeemBadge ' + profitTag.cls}>{profitTag.text}</span>
                        </div>
                        <div className="wheelSumVal">{moneyFromCent(period.profit, currency)}</div>
                      </div>
                    </div>

                    <div className="wheelSummaryTiles" style={{ marginTop: 10 }}>
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Доля выдачи</div>
                        <div className="wheelSumVal">{fact.redeemRatePct}%</div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Активных призов</div>
                        <div className="wheelSumVal">{activeCount} / {items.length}</div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Окупаемость (прогноз)</div>
                        <div className="wheelSumVal">{breakEvenLabel}</div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">ROI (прогноз)</div>
                        <div className="wheelSumVal">{ev.roi === null ? '—' : fmtPct(ev.roi)}</div>
                      </div>
                    </div>



                    {ev.topRisk ? (
                      <div className="sg-pill" style={{ padding: '10px 12px', marginTop: 12 }}>
                        <span className="sg-muted">Главный риск по EV: </span>
                        <b>{ev.topRisk.title}</b>
                        <span className="sg-muted"> · вклад EV: </span>
                        <b>{moneyFromCent(Math.round(ev.topRisk.expCent), currency)}</b>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ===== TAB: FORECAST ===== */}
              {tab === 'forecast' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">

                    <div>
                      <div className="wheelCardTitle">Прогноз: окупаемость и экономика</div>
                      <div className="wheelCardSub">Это прогноз по текущим настройкам. История — в графике выше.</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="sg-pill" style={{ padding: '12px 12px' }}>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Цена спина (монет) — прогноз</div>
                      <Input
                        value={spinCostCoinsDraft}
                        onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)}
                        placeholder="10"
                      />
                      <div className="sg-muted" style={{ marginTop: 8 }}>
                        Выручка/спин = <b>{moneyFromCent(spinCostCoinsForecast * coinCostCentPerCoin, currency)}</b>
                      </div>
                    </div>

                    <div className="sg-pill" style={{ padding: '12px 12px' }}>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Спинов/день (для прогноза)</div>
                      <Input
                        value={spinsPerDayDraft}
                        onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                        placeholder="пусто = авто"
                      />
                      <div className="sg-muted" style={{ marginTop: 8 }}>
                        авто: <b>{period.days > 0 ? (period.spins / Math.max(1, period.days)).toFixed(2) : '0.00'}</b> / день
                      </div>
                    </div>
                  </div>

                  <div className="wheelSummaryPro" style={{ paddingTop: 12 }}>
                    <div className="wheelSummaryTiles">
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Выручка за 1 спин</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.spinRevenueCent, currency)}</div>
                        <div className="sg-muted" style={{ marginTop: 4 }}>
                          {ev.spinRevenueCoins} монет / спин
                        </div>
                      </div>

                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Ожидаемый расход (EV)</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.payoutCent, currency)}</div>
                        <div className="sg-muted" style={{ marginTop: 4 }}>
                          {ev.payoutCoins.toFixed(2)} монет / спин
                        </div>
                      </div>

                      <div className="wheelSumTile is-strong">
                        <div className="wheelSumLbl">Ожидаемая прибыль (EV)</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.profitCent, currency)}</div>
                        <div className="sg-muted" style={{ marginTop: 4 }}>
                          {ev.profitCoins.toFixed(2)} монет / спин
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="sg-pill" style={{ padding: '10px 12px' }}>
                        <span className="sg-muted">Маржа (ROI): </span>
                        <b>{ev.roi === null ? '—' : fmtPct(ev.roi)}</b>
                      </div>
                      <div className="sg-pill" style={{ padding: '10px 12px' }}>
                        <span className="sg-muted">Окупаемость: </span>
                        <b>{breakEvenLabel}</b>
                      </div>
                    </div>

                    {ev.topRisk ? (
                      <div className="sg-pill" style={{ padding: '10px 12px', marginTop: 10 }}>
                        <span className="sg-muted">Главный риск по EV: </span>
                        <b>{ev.topRisk.title}</b>
                        <span className="sg-muted"> · вклад EV: </span>
                        <b>{moneyFromCent(Math.round(ev.topRisk.expCent), currency)}</b>
                        <span className="sg-muted"> · </span>
                        <b>{ev.topRisk.expCoins.toFixed(2)} монет</b>
                      </div>
                    ) : null}

                    <div className="sg-muted" style={{ marginTop: 12 }}>
                      Покрытие себестоимости (есть cost_coins/coins): <b>{ev.costCoverage}%</b>.
                      <span className="sg-muted"> База расхода: </span>
                      <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>.
                    </div>
                  </div>
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
                        Если включены <b>track_qty</b> + <b>stop_when_zero</b> и <b>qty_left ≤ 0</b> — приз <b>не выпадает</b> (и монетный тоже).
                      </div>
                    </div>
                  </div>

                  <div className="wheelTableWrap" style={{ marginTop: 12 }}>
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th style={{ minWidth: 120 }}>Активен</th>
                          <th style={{ minWidth: 150 }}>Учёт остатков</th>
                          <th style={{ minWidth: 160 }}>Остаток</th>
                          <th style={{ minWidth: 180 }}>Авто-выкл при 0</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const d = draft[p.prize_code] || {
                            active: !!p.active,
                            track_qty: !!p.track_qty,
                            qty_left: (p.qty_left === null || p.qty_left === undefined) ? '' : String(p.qty_left),
                            stop_when_zero: !!p.stop_when_zero,
                          };

                          const tracked = !!d.track_qty;
                          const qRaw = String(d.qty_left ?? '').trim();
                          const qNum = qRaw === '' ? qtyLeft(p) : Math.max(0, toInt(qRaw, 0));
                          const swz = !!d.stop_when_zero;

                          const out = tracked && (qNum !== null && qNum <= 0);
                          const low = tracked && (qNum !== null && qNum > 0 && qNum <= inventory.lowThreshold);

                          return (
                            <tr key={p.prize_code}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div style={{ fontWeight: 900 }}>{p.title || p.prize_code}</div>
                                  <div className="sg-muted" style={{ fontSize: 12 }}>
                                    {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'}
                                    <span className="sg-muted"> · код: </span>
                                    <b>{p.prize_code}</b>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <Toggle
                                  checked={!!d.active}
                                  onChange={(v) => patchDraft(p.prize_code, { active: v })}
                                  labelOn="вкл"
                                  labelOff="выкл"
                                />
                              </td>

                              <td>
                                <Toggle
                                  checked={!!d.track_qty}
                                  onChange={(v) => patchDraft(p.prize_code, { track_qty: v })}
                                  labelOn="да"
                                  labelOff="нет"
                                />
                              </td>

                              <td>
                                {tracked ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                      <Input
                                        value={d.qty_left}
                                        onChange={(e: any) => patchDraft(p.prize_code, { qty_left: e.target.value })}
                                        placeholder="0"
                                        style={{ width: 120 }}
                                      />
                                      {out ? <span className="sg-muted">ноль</span> : null}
                                      {!out && low ? <span className="sg-muted">мало (≤ {inventory.lowThreshold})</span> : null}
                                    </div>
                                    {out && swz ? (
                                      <div className="sg-muted" style={{ fontSize: 12 }}>
                                        подсказка: при нуле + авто-выкл — приз не выпадает
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="sg-muted">—</span>
                                )}
                              </td>

                              <td>
                                {tracked ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <Toggle
                                      checked={!!d.stop_when_zero}
                                      onChange={(v) => patchDraft(p.prize_code, { stop_when_zero: v })}
                                      labelOn="да"
                                      labelOff="нет"
                                    />
                                    {out && d.stop_when_zero ? (
                                      <div className="sg-muted" style={{ fontSize: 12 }}>
                                        подсказка: сейчас выключен по нулю
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="sg-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {!items.length && !qStats.isLoading && (
                          <tr><td colSpan={5} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* save button at bottom (как ты просил) */}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="sg-muted">
                      {saveMsg ? <b>{saveMsg}</b> : 'Подсказка: если склад не включён — прочерки это нормально.'}
                    </div>
                    <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={saveStock}>
                      {saving ? 'Сохраняю…' : 'Сохранить склад'}
                    </Button>
                  </div>

                  {/* app_settings block BELOW stock (как обсудили) */}
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
                      <Button variant="primary" onClick={saveAppSettings} disabled={savingCoin || !appId}>
                        {savingCoin ? 'Сохраняю…' : 'Сохранить'}
                      </Button>
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
