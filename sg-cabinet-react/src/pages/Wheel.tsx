// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// ✅ SGP (у тебя уже задеплоено)
import { HealthBadge } from '../components/sgp/HealthBadge';
import { Tip } from '../components/sgp/Tip';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { Collapsible } from '../components/sgp/Collapsible';
import { IconBtn } from '../components/sgp/IconBtn';

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

function normalizeCoins(p: PrizeStat): number {
  const v = Number((p as any).coins);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function normalizeKind(p: PrizeStat): 'coins' | 'item' {
  const k = String((p as any).kind || '').trim().toLowerCase();
  return k === 'coins' ? 'coins' : 'item';
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

// mimic mini-runtime effWeight: track_qty + stop_when_zero + qty_left<=0 => effWeight=0
function effWeight(p: PrizeStat, w: number) {
  const tracked = isTracked(p);
  const swz = isStopWhenZero(p);
  const q = qtyLeft(p);
  if (tracked && swz && q !== null && q <= 0) return 0;
  return Math.max(0, w);
}

/** ====== inline-styled toggle (без вшитого CSS) ====== */
function Toggle({
  checked,
  onChange,
  disabled,
  labelOn = 'on',
  labelOff = 'off',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  const bg = checked ? 'rgba(34,197,94,.14)' : 'rgba(239,68,68,.08)';
  const bd = checked ? 'rgba(34,197,94,.22)' : 'rgba(239,68,68,.18)';
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      aria-disabled={!!disabled}
      style={{
        height: 30,
        minWidth: 66,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${bd}`,
        background: bg,
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: '.02em',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
      title={checked ? labelOn : labelOff}
    >
      {checked ? labelOn : labelOff}
    </button>
  );
}

export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  const [tab, setTab] = React.useState<'summary' | 'forecast' | 'stock'>('summary');

  // расход считать: при выигрыше или при выдаче
  const [costBasis, setCostBasis] = React.useState<'issued' | 'redeemed'>('issued');

  // Денежный график: слои
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showProfitBars, setShowProfitBars] = React.useState<boolean>(true);

  // Быстрые периоды
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // Right card Top prizes
  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');

  // SETTINGS from worker (app_settings)
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

  // drafts for coin value + currency
  const [coinValueDraft, setCoinValueDraft] = React.useState<string>('1');
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
      await qc.invalidateQueries({ queryKey: ['wheel_ts', appId] });
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

  // prizes stats
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });
  const items = qStats.data?.items || [];

  // timeseries
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
    qTs.data?.settings?.currency || qSettings.data?.settings?.currency || currencyDraft || 'RUB'
  ).toUpperCase();

  const coinCostCentPerCoin = React.useMemo(() => {
    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor(units * 100);
    return Number.isFinite(cents) ? Math.max(0, cents) : 0;
  }, [coinValueDraft]);

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

  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const spins = fact.spins;
    const revenue = fact.revenue_cents;
    const payout = fact.payout_cents;
    const profit = fact.profit_cents;

    const spinsPerDay = days > 0 ? spins / days : 0;
    return { days, spins, revenue, payout, profit, spinsPerDay };
  }, [range.from, range.to, fact.spins, fact.revenue_cents, fact.payout_cents, fact.profit_cents]);

  const activeCount = items.filter((i) => (Number(i.active) || 0) ? true : false).length;

  const top = [...items]
    .sort((a, b) => (Number((b as any)[topMetric]) || 0) - (Number((a as any)[topMetric]) || 0))
    .slice(0, 7);

  // ===== Stock draft (only live fields) =====
  type DraftRow = {
    active: boolean;
    track_qty: boolean;
    qty_left: string;
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
      const r = await apiFetch<{ ok: true; updated: number }>(`/api/cabinet/apps/${appId}/wheel/prizes`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      setSaveMsg(`Сохранено: ${r.updated}`);
      await qc.invalidateQueries({ queryKey: ['wheel', appId] });
      await qc.invalidateQueries({ queryKey: ['wheel_ts', appId] });
    } catch (e: any) {
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  // ===== Forecast controls =====
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10');
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');
  const [forecastScenario, setForecastScenario] = React.useState<'safe' | 'base' | 'aggr'>('base');
  const [forecastTargetMargin, setForecastTargetMargin] = React.useState<0.1 | 0.2 | 0.3>(0.2);

  const spinCostCoinsForecast = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

  // EV calc (uses items + draft stock)
  const ev = React.useMemo(() => {
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

  // inventory hints
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

  // chart series
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

  // ===== simple health labels =====
  const profitHealth: 'good' | 'warn' | 'bad' | 'neutral' = (() => {
    const revenue = period.revenue;
    const profit = period.profit;
    if (!(revenue > 0)) return 'neutral';
    const m = profit / revenue;
    if (m >= 0.25) return 'good';
    if (m >= 0.05) return 'warn';
    if (m >= 0) return 'warn';
    return 'bad';
  })();

  const redeemHealth: 'good' | 'warn' | 'bad' | 'neutral' = (() => {
    const wins = fact.wins;
    if (!(wins > 0)) return 'neutral';
    if (fact.redeemRatePct >= 70) return 'good';
    if (fact.redeemRatePct >= 40) return 'warn';
    return 'bad';
  })();

  return (
    <div className="sgpPage">
      {/* ===== Header ===== */}
      <div className="sgpSection">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="sgpH1">Колесо</h1>
            <div className="sgpSub">
              Факт по <b>wheel_spins</b> + прогноз EV/ROI (по весам/себестоимости/цене спина).
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="sgpSeg" role="tablist" aria-label="Период">
              <button type="button" className={'sgpSegBtn ' + (quick === 'day' ? 'isActive' : '')} onClick={() => pickQuick('day')}>
                День
              </button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'week' ? 'isActive' : '')} onClick={() => pickQuick('week')}>
                Неделя
              </button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'month' ? 'isActive' : '')} onClick={() => pickQuick('month')}>
                Месяц
              </button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'custom' ? 'isActive' : '')} onClick={() => pickQuick('custom')}>
                Свой
              </button>
            </div>

            {quick === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="sgpMeta">от</span>
                <Input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} />
                <span className="sgpMeta">до</span>
                <Input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} />
                <button
                  type="button"
                  className="sgpBtn"
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

      <div className="sgpGrid" style={{ alignItems: 'start' }}>
        {/* LEFT */}
        <div className="sgpGridMain">
          <Card className="sgpCard">
            <div className="sgpCardHead" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="sgpCardTitle">Факт: выручка / расход / прибыль</div>
                <div className="sgpCardSub">{range.from} — {range.to}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="sgpSeg" role="tablist" aria-label="База расхода">
                  <button
                    type="button"
                    className={'sgpSegBtn ' + (costBasis === 'issued' ? 'isActive' : '')}
                    onClick={() => setCostBasis('issued')}
                  >
                    при выигрыше
                  </button>
                  <button
                    type="button"
                    className={'sgpSegBtn ' + (costBasis === 'redeemed' ? 'isActive' : '')}
                    onClick={() => setCostBasis('redeemed')}
                  >
                    при выдаче
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <IconBtn active={showRevenue} title="Выручка" onClick={() => setShowRevenue(v => !v)}>
                    $
                  </IconBtn>
                  <IconBtn active={showPayout} title="Расход" onClick={() => setShowPayout(v => !v)}>
                    —
                  </IconBtn>
                  <IconBtn active={showProfitBars} title="Прибыль (столбики)" onClick={() => setShowProfitBars(v => !v)}>
                    П
                  </IconBtn>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', height: 320 }}>
              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={moneySeries.series} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
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
                      <Bar yAxisId="day" dataKey="profit" name="profit" fill="var(--accent)" fillOpacity={0.22} radius={[10, 10, 10, 10]} />
                    )}
                    {showRevenue && (
                      <Line yAxisId="day" type="monotone" dataKey="revenue" name="revenue" stroke="var(--accent2)" strokeWidth={2} dot={false} />
                    )}
                    {showPayout && (
                      <Line yAxisId="day" type="monotone" dataKey="payout" name="payout" stroke="var(--accent2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {isLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 'min(520px, 92%)' }}>
                    <ShimmerLine />
                    <div className="sgpMeta" style={{ marginTop: 10, textAlign: 'center' }}>Загрузка…</div>
                  </div>
                </div>
              )}

              {isError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="sgpMeta">
                    Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="sgpSeg" role="tablist" aria-label="Раздел">
                <button className={'sgpSegBtn ' + (tab === 'summary' ? 'isActive' : '')} onClick={() => setTab('summary')}>
                  Сводка
                </button>
                <button className={'sgpSegBtn ' + (tab === 'forecast' ? 'isActive' : '')} onClick={() => setTab('forecast')}>
                  Прогноз
                </button>
                <button className={'sgpSegBtn ' + (tab === 'stock' ? 'isActive' : '')} onClick={() => setTab('stock')}>
                  Склад
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <HealthBadge variant={profitHealth}>
                  прибыль: {profitHealth === 'neutral' ? '—' : profitHealth}
                </HealthBadge>
                <HealthBadge variant={redeemHealth}>
                  выдача: {redeemHealth === 'neutral' ? '—' : redeemHealth}
                </HealthBadge>
              </div>
            </div>

            {/* ===== TAB: SUMMARY ===== */}
            {tab === 'summary' && (
              <div style={{ marginTop: 12 }}>
                <Collapsible title="Сводка (ФАКТ)" subtitle={`База расхода: ${costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}`} defaultOpen>
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

                    return (
                      <div className="sgpGrid2" style={{ marginTop: 10 }}>
                        <div className="sgpCard" style={{ padding: 12 }}>
                          <div className="sgpCardTitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span>Ключевые метрики</span>
                            <HealthBadge variant={profitHealth}>
                              {profitHealth === 'neutral' ? 'нет данных' : profitHealth}
                            </HealthBadge>
                          </div>

                          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Спинов</div>
                              </div>
                              <div className="sgpRowRight"><b>{spins}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Выручка</div>
                              </div>
                              <div className="sgpRowRight"><b>{moneyFromCent(revenue, currency)}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Расход</div>
                              </div>
                              <div className="sgpRowRight"><b>{moneyFromCent(payout, currency)}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Прибыль</div>
                                <div className="sgpRowSub">
                                  база: <b>{costBasis === 'issued' ? 'выигрыш' : 'выдача'}</b>
                                </div>
                              </div>
                              <div className="sgpRowRight"><b>{moneyFromCent(profit, currency)}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">На 1 спин</div>
                                <div className="sgpRowSub">выручка / расход / прибыль</div>
                              </div>
                              <div className="sgpRowRight">
                                <b>
                                  {moneyFromCent(revPerSpin, currency)} / {moneyFromCent(payPerSpin, currency)} / {moneyFromCent(profPerSpin, currency)}
                                </b>
                              </div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">В день (среднее)</div>
                                <div className="sgpRowSub">по периоду</div>
                              </div>
                              <div className="sgpRowRight">
                                <b>
                                  {moneyFromCent(revPerDay, currency)} / {moneyFromCent(payPerDay, currency)} / {moneyFromCent(profPerDay, currency)}
                                </b>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="sgpCard" style={{ padding: 12 }}>
                          <div className="sgpCardTitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span>Операционка</span>
                            <HealthBadge variant={redeemHealth}>
                              {wins > 0 ? `${redeemRatePct}%` : '—'}
                            </HealthBadge>
                          </div>

                          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                            <div className="sgpRow">
                              <div className="sgpRowHead"><div className="sgpRowTitle">Выигрышей</div></div>
                              <div className="sgpRowRight"><b>{wins}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead"><div className="sgpRowTitle">Выдано</div></div>
                              <div className="sgpRowRight"><b>{redeemed}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead"><div className="sgpRowTitle">Активных призов</div></div>
                              <div className="sgpRowRight"><b>{activePrizes} / {totalPrizes}</b></div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Склад</div>
                                <div className="sgpRowSub">ноль / мало / авто-выкл</div>
                              </div>
                              <div className="sgpRowRight">
                                <b>{trackedCount > 0 ? `${outCount} / ${lowCount} / ${autoOffCount}` : 'выкл'}</b>
                              </div>
                            </div>

                            <div className="sgpRow">
                              <div className="sgpRowHead">
                                <div className="sgpRowTitle">Порог “мало”</div>
                              </div>
                              <div className="sgpRowRight"><b>≤ {lowThr}</b></div>
                            </div>
                          </div>
                        </div>

                        <div className="sgpCard" style={{ gridColumn: '1 / -1', padding: 12 }}>
                          <div className="sgpCardTitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span>Что сильнее всего “съедает” расход</span>
                            <div className="sgpMeta">
                              оценка: <b>{costBasis === 'issued' ? 'wins×cost' : 'redeemed×cost'}</b>
                            </div>
                          </div>

                          {topEaters.list.length ? (
                            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                              {topEaters.list.map((r) => (
                                <div key={r.code} className="sgpRow">
                                  <div className="sgpRowHead">
                                    <div className="sgpRowTitle">{r.title}</div>
                                    <div className="sgpRowSub">
                                      {r.kind === 'coins' ? 'монеты' : 'товар'} · {r.sharePct}% · {r.qty} шт
                                      {r.out ? <span style={{ marginLeft: 8 }}><HealthBadge variant="bad">ноль+авто-выкл</HealthBadge></span> : null}
                                    </div>
                                  </div>
                                  <div className="sgpRowRight"><b>{moneyFromCent(r.estCent, currency)}</b></div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="sgpMeta" style={{ marginTop: 10 }}>
                              Пока нечего показать: нет себестоимости (cost_coins/coins) или нет wins/redeemed за период.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </Collapsible>
              </div>
            )}

            {/* ===== TAB: FORECAST ===== */}
            {tab === 'forecast' && (
              <div style={{ marginTop: 12 }}>
                <Collapsible
                  title="Прогноз: прибыль и окупаемость"
                  subtitle={`Расход фиксируем: ${costBasis === 'issued' ? 'в момент выигрыша' : 'в момент выдачи'}`}
                  defaultOpen
                >
                  {(() => {
                    const toNum = (v: any, d = 0) => {
                      const n = Number(String(v ?? '').replace(',', '.').trim());
                      return Number.isFinite(n) ? n : d;
                    };
                    const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
                    const money = (c: number) => moneyFromCent(Math.round(c || 0), currency);

                    const coinCent = clamp0(coinCostCentPerCoin || 0);
                    const spinCostCoinsForecastLocal = Math.max(0, Math.round(toNum(spinCostCoinsDraft, 0)));
                    const spinsPerDayDraftRaw = String(spinsPerDayDraft ?? '').trim();
                    const spinsPerDayAuto =
                      period && period.days > 0 ? (period.spins / Math.max(1, period.days)) : 0;
                    const spinsPerDayBase =
                      spinsPerDayDraftRaw === ''
                        ? Math.max(0, spinsPerDayAuto)
                        : Math.max(0, toNum(spinsPerDayDraftRaw, 0));

                    const revenuePerSpinCent = clamp0(spinCostCoinsForecastLocal * coinCent);
                    const avgPayoutPerSpinCent = clamp0(ev?.payoutCent ?? 0);
                    const avgProfitPerSpinCent = Math.round(revenuePerSpinCent - avgPayoutPerSpinCent);
                    const roi = revenuePerSpinCent > 0 ? (avgProfitPerSpinCent / revenuePerSpinCent) : null;

                    const sigmaPerSpinCent = Math.max(0, Math.round(avgPayoutPerSpinCent * 0.6));

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

                    const target = forecastTargetMargin;
                    const needRevenueBreakevenCent = avgPayoutPerSpinCent;
                    const needCoinsBreakeven = coinCent > 0 ? Math.ceil(needRevenueBreakevenCent / coinCent) : null;

                    const needRevenueTargetCent =
                      (1 - target) > 0 ? Math.ceil(avgPayoutPerSpinCent / (1 - target)) : avgPayoutPerSpinCent;
                    const needCoinsTarget = coinCent > 0 ? Math.ceil(needRevenueTargetCent / coinCent) : null;

                    const recs: Array<{ tone?: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];

                    if (coinCent > 0) {
                      if (avgProfitPerSpinCent < 0) {
                        recs.push({
                          tone: 'bad',
                          title: 'Подними цену спина (быстрый фикс)',
                          body:
                            `Чтобы выйти в ноль: ≈ ${needCoinsBreakeven ?? '—'} монет/спин (сейчас ${spinCostCoinsForecastLocal}). ` +
                            `Для цели маржи ${Math.round(target * 100)}%: ≈ ${needCoinsTarget ?? '—'} монет/спин.`,
                        });
                      } else {
                        recs.push({
                          tone: 'good',
                          title: 'Цена спина выглядит ок',
                          body:
                            `Плановая прибыль/спин ≈ ${money(avgProfitPerSpinCent)}. ` +
                            `Чтобы держать цель маржи ${Math.round(target * 100)}% — держи цену не ниже ≈ ${needCoinsTarget ?? '—'} монет/спин.`,
                        });
                      }
                    } else {
                      recs.push({
                        tone: 'warn',
                        title: 'Заполни стоимость монеты',
                        body: 'Для корректного прогноза нужен курс: “1 монета = …” в блоке “Стоимость монеты и валюта”.',
                      });
                    }

                    recs.push({
                      tone: 'warn',
                      title: 'Для дефицитных призов включай “остатки + авто-выкл”',
                      body: 'Так дорогие позиции не будут выпадать при нуле. Это стабилизирует экономику и UX.',
                    });

                    const recsFinal = recs.slice(0, 4);

                    const profitVariant: 'good' | 'bad' | 'warn' = avgProfitPerSpinCent >= 0 ? 'good' : 'bad';

                    return (
                      <div style={{ marginTop: 10 }}>
                        <div className="sgpGrid2">
                          <div className="sgpCard" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div className="sgpCardTitle">Цена спина (монет)</div>
                              <Tip text="Только для прогноза. Реальная цена задаётся в настройках колеса." />
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                            </div>
                            <div className="sgpMeta" style={{ marginTop: 8 }}>
                              Выручка/спин ≈ <b>{money(revenuePerSpinCent)}</b>
                            </div>
                          </div>

                          <div className="sgpCard" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div className="sgpCardTitle">Спинов / день</div>
                              <Tip text="Пусто = авто по истории периода. Можно задать вручную." />
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Input value={spinsPerDayDraft} onChange={(e: any) => setSpinsPerDayDraft(e.target.value)} placeholder="пусто = авто" />
                            </div>
                            <div className="sgpMeta" style={{ marginTop: 8 }}>
                              авто: <b>{spinsPerDayAuto.toFixed(2)}</b> / день
                            </div>
                          </div>
                        </div>

                        <div className="sgpGrid2" style={{ marginTop: 12 }}>
                          <div className="sgpCard" style={{ padding: 12 }}>
                            <div className="sgpCardTitle">Экономика / спин</div>

                            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                              <div className="sgpRow">
                                <div className="sgpRowHead">
                                  <div className="sgpRowTitle">Выручка / спин</div>
                                  <div className="sgpRowSub">{spinCostCoinsForecastLocal} монет</div>
                                </div>
                                <div className="sgpRowRight"><b>{money(revenuePerSpinCent)}</b></div>
                              </div>

                              <div className="sgpRow">
                                <div className="sgpRowHead">
                                  <div className="sgpRowTitle">Средний расход на призы / спин</div>
                                  <div className="sgpRowSub">EV</div>
                                </div>
                                <div className="sgpRowRight"><b>{money(avgPayoutPerSpinCent)}</b></div>
                              </div>

                              <div className="sgpRow">
                                <div className="sgpRowHead">
                                  <div className="sgpRowTitle">Плановая прибыль / спин</div>
                                  <div className="sgpRowSub">
                                    <HealthBadge variant={profitVariant}>{roi === null ? '—' : fmtPct(roi)}</HealthBadge>
                                  </div>
                                </div>
                                <div className="sgpRowRight"><b>{money(avgProfitPerSpinCent)}</b></div>
                              </div>
                            </div>
                          </div>

                          <div className="sgpCard" style={{ padding: 12 }}>
                            <div className="sgpCardTitle">Окупаемость</div>

                            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                              <div className="sgpRow">
                                <div className="sgpRowHead"><div className="sgpRowTitle">Маржа</div></div>
                                <div className="sgpRowRight"><b>{roi === null ? '—' : fmtPct(roi)}</b></div>
                              </div>

                              <div className="sgpRow">
                                <div className="sgpRowHead"><div className="sgpRowTitle">Окупаемость (ярлык)</div></div>
                                <div className="sgpRowRight"><b>{breakEvenLabel}</b></div>
                              </div>

                              <div className="sgpRow">
                                <div className="sgpRowHead">
                                  <div className="sgpRowTitle">Цель маржи</div>
                                  <div className="sgpRowSub">для текущих расходов</div>
                                </div>
                                <div className="sgpRowRight"><b>{Math.round(target * 100)}%</b></div>
                              </div>
                            </div>

                            <div className="sgpSeg" style={{ marginTop: 10 }}>
                              <button className={'sgpSegBtn ' + (forecastTargetMargin === 0.1 ? 'isActive' : '')} onClick={() => setForecastTargetMargin(0.1)}>10%</button>
                              <button className={'sgpSegBtn ' + (forecastTargetMargin === 0.2 ? 'isActive' : '')} onClick={() => setForecastTargetMargin(0.2)}>20%</button>
                              <button className={'sgpSegBtn ' + (forecastTargetMargin === 0.3 ? 'isActive' : '')} onClick={() => setForecastTargetMargin(0.3)}>30%</button>
                            </div>

                            <div className="sgpMeta" style={{ marginTop: 10 }}>
                              {coinCent > 0 && needCoinsTarget !== null ? (
                                <>цена спина для цели ≈ <b>{needCoinsTarget}</b> монет</>
                              ) : (
                                <>заполни “стоимость монеты”, чтобы считать цену для цели</>
                              )}
                            </div>
                          </div>
                        </div>

                        {recsFinal.length ? (
                          <div className="sgpCard" style={{ padding: 12, marginTop: 12 }}>
                            <div className="sgpCardTitle">Рекомендации</div>
                            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              {recsFinal.map((r, i) => (
                                <div key={i} className="sgpRow">
                                  <div className="sgpRowHead">
                                    <div className="sgpRowTitle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      {r.title}
                                      {r.tone ? <HealthBadge variant={r.tone === 'good' ? 'good' : (r.tone === 'bad' ? 'bad' : 'warn')}>{r.tone}</HealthBadge> : null}
                                    </div>
                                    <div className="sgpRowSub">{r.body}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="sgpCard" style={{ padding: 12, marginTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div className="sgpCardTitle">Сценарии</div>
                            <div className="sgpSeg">
                              {(['safe', 'base', 'aggr'] as const).map((k) => {
                                const pDay = getScenarioProfitDay(k);
                                const badge = pDay >= 0 ? 'good' : 'bad';
                                const title = scenarios.find(s => s.key === k)?.title || k;
                                return (
                                  <button
                                    key={k}
                                    className={'sgpSegBtn ' + (forecastScenario === k ? 'isActive' : '')}
                                    onClick={() => setForecastScenario(k)}
                                    type="button"
                                  >
                                    {title}{' '}
                                    <span style={{ marginLeft: 8 }}>
                                      <HealthBadge variant={badge}>{money(pDay)}/д</HealthBadge>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="sgpGrid2" style={{ marginTop: 12 }}>
                            <div className="sgpCard" style={{ padding: 12 }}>
                              <div className="sgpCardTitle">В день</div>
                              <div className="sgpMeta" style={{ marginTop: 6 }}>
                                спины/день: <b>{chosen.spinsDay.toFixed(1)}</b> · {sc.hint}
                              </div>

                              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                                <div className="sgpRow">
                                  <div className="sgpRowHead"><div className="sgpRowTitle">Выручка</div></div>
                                  <div className="sgpRowRight"><b>{money(chosen.revDay)}</b></div>
                                </div>
                                <div className="sgpRow">
                                  <div className="sgpRowHead"><div className="sgpRowTitle">Расход</div></div>
                                  <div className="sgpRowRight"><b>{money(chosen.payDay)}</b></div>
                                </div>
                                <div className="sgpRow">
                                  <div className="sgpRowHead">
                                    <div className="sgpRowTitle">Прибыль</div>
                                    <div className="sgpRowSub">диапазон: {money(chosen.bandLow)} … {money(chosen.bandHigh)}</div>
                                  </div>
                                  <div className="sgpRowRight"><b>{money(chosen.profDay)}</b></div>
                                </div>
                              </div>
                            </div>

                            <div className="sgpCard" style={{ padding: 12 }}>
                              <div className="sgpCardTitle">За 30 дней</div>
                              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                                <div className="sgpRow">
                                  <div className="sgpRowHead"><div className="sgpRowTitle">Выручка</div></div>
                                  <div className="sgpRowRight"><b>{money(chosen.rev30)}</b></div>
                                </div>
                                <div className="sgpRow">
                                  <div className="sgpRowHead"><div className="sgpRowTitle">Расход</div></div>
                                  <div className="sgpRowRight"><b>{money(chosen.pay30)}</b></div>
                                </div>
                                <div className="sgpRow">
                                  <div className="sgpRowHead"><div className="sgpRowTitle">Прибыль</div></div>
                                  <div className="sgpRowRight"><b>{money(chosen.prof30)}</b></div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="sgpMeta" style={{ marginTop: 10 }}>
                            Прогноз — это планирование по текущим настройкам. История не меняется.
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </Collapsible>
              </div>
            )}

            {/* ===== TAB: STOCK ===== */}
            {tab === 'stock' && (
              <div style={{ marginTop: 12 }}>
                <Collapsible
                  title="Склад призов"
                  subtitle="live-поля: active / track_qty / qty_left / stop_when_zero"
                  defaultOpen
                >
                  <div className="sgpMeta" style={{ marginTop: 4 }}>
                    Если включены <b>track_qty</b> + <b>stop_when_zero</b> и <b>qty_left ≤ 0</b> — приз <b>не выпадает</b>.
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
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

                      const stateBadge: 'good' | 'warn' | 'bad' | 'neutral' = !active
                        ? 'neutral'
                        : (tracked ? (out ? 'bad' : (low ? 'warn' : 'good')) : 'neutral');

                      return (
                        <div key={code} className="sgpRow">
                          <div className="sgpRowHead">
                            <div className="sgpRowTitle" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {p.title || code}
                              <HealthBadge variant={stateBadge}>
                                {!active ? 'выкл' : (tracked ? (out ? 'ноль' : (low ? 'мало' : 'ok')) : 'без склада')}
                              </HealthBadge>
                            </div>

                            <div className="sgpRowSub">
                              {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'} · код: <b>{code}</b>
                            </div>

                            <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="sgpMeta">Активен</span>
                                <Toggle
                                  checked={active}
                                  labelOn="on"
                                  labelOff="off"
                                  onChange={(v) => {
                                    if (!v) {
                                      patchDraft(code, { active: false, track_qty: false, stop_when_zero: false, qty_left: '' });
                                      return;
                                    }
                                    patchDraft(code, { active: true });
                                  }}
                                />
                                <Tip text={active ? 'Включен · приз участвует' : 'Выключен · приз не выпадает'} />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="sgpMeta">Учёт остатков</span>
                                <Toggle
                                  checked={tracked}
                                  disabled={!active}
                                  labelOn="on"
                                  labelOff="off"
                                  onChange={(v) => {
                                    if (!active) return;
                                    if (!v) {
                                      patchDraft(code, { track_qty: false, stop_when_zero: false, qty_left: '' });
                                      return;
                                    }
                                    patchDraft(code, { track_qty: true });
                                  }}
                                />
                                <Tip text={!active ? 'Сначала включи приз' : (tracked ? 'Учитываем qty_left' : 'Склад не считаем')} />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="sgpMeta">Остаток</span>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={tracked ? d.qty_left : ''}
                                  disabled={!tracked}
                                  onChange={(e: any) => patchDraft(code, { qty_left: e.target.value })}
                                  placeholder={tracked ? '0' : '—'}
                                  style={{ width: 120, textAlign: 'center', fontWeight: 900 }}
                                />
                                <Tip
                                  text={
                                    !active
                                      ? 'Сначала включи приз'
                                      : (tracked ? 'Ввод · кол-во на складе' : 'Включи учёт остатков')
                                  }
                                />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className="sgpMeta">Авто-выкл при 0</span>
                                <Toggle
                                  checked={swz}
                                  disabled={!tracked}
                                  labelOn="on"
                                  labelOff="off"
                                  onChange={(v) => {
                                    if (!tracked) return;
                                    patchDraft(code, { stop_when_zero: v });
                                  }}
                                />
                                <Tip
                                  text={
                                    !active
                                      ? 'Сначала включи приз'
                                      : (!tracked
                                        ? 'Сначала включи учёт остатков'
                                        : (swz ? 'При 0 приз не выпадает' : 'При 0 приз может выпадать'))
                                  }
                                />
                              </div>
                            </div>

                            {out && swz ? (
                              <div className="sgpMeta" style={{ marginTop: 10 }}>
                                <HealthBadge variant="bad">Закончились — приз не выпадает</HealthBadge>
                              </div>
                            ) : null}

                            {!out && low ? (
                              <div className="sgpMeta" style={{ marginTop: 10 }}>
                                <HealthBadge variant="warn">Скоро закончатся (≤ {inventory.lowThreshold})</HealthBadge>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {!items.length && !qStats.isLoading && (
                      <div className="sgpMeta">Нет призов.</div>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="sgpMeta">{saveMsg ? <b>{saveMsg}</b> : 'Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.'}</div>
                    <button
                      type="button"
                      className="sgpBtn"
                      disabled={saving || qStats.isLoading || !appId}
                      onClick={saveStock}
                    >
                      {saving ? 'Сохраняю…' : 'Сохранить склад'}
                    </button>
                  </div>

                  {/* app_settings BELOW stock */}
                  <div className="sgpCard" style={{ padding: 12, marginTop: 12 }}>
                    <div className="sgpCardTitle">Стоимость монеты и валюта</div>

                    <div className="sgpGrid2" style={{ marginTop: 10, alignItems: 'end' }}>
                      <div>
                        <div className="sgpMeta" style={{ marginBottom: 6 }}>
                          Стоимость 1 монеты ({currencyLabel(currencyDraft)})
                        </div>
                        <Input value={coinValueDraft} onChange={(e: any) => setCoinValueDraft(e.target.value)} placeholder="1.00" />
                        <div className="sgpMeta" style={{ marginTop: 6 }}>
                          = <b>{moneyFromCent(coinCostCentPerCoin, currencyDraft)}</b> / монета
                        </div>
                      </div>

                      <div>
                        <div className="sgpMeta" style={{ marginBottom: 6 }}>Валюта</div>
                        <select
                          value={currencyDraft}
                          onChange={(e: any) => setCurrencyDraft(String(e.target.value || 'RUB').toUpperCase())}
                          className="sgpInput"
                          style={{ height: 38, width: '100%' }}
                        >
                          <option value="RUB">RUB (₽)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" className="sgpBtn" onClick={saveAppSettings} disabled={savingCoin || !appId}>
                        {savingCoin ? 'Сохраняю…' : 'Сохранить'}
                      </button>

                      {coinMsg ? <span className="sgpMeta">{coinMsg}</span> : null}
                      {qSettings.isError ? <span className="sgpMeta">settings: ошибка</span> : null}

                      <span className="sgpMeta" style={{ marginLeft: 'auto' }}>
                        пример: USD + 0.10 = “1 монета = 10 центов”
                      </span>
                    </div>
                  </div>
                </Collapsible>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="sgpGridSide">
          <Card className="sgpCard">
            <div className="sgpCardHead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="sgpCardTitle">Выдача призов</div>
                <div className="sgpCardSub">
                  Выигрышей: <b>{fact.wins}</b> · Выдано: <b>{fact.redeemed}</b>
                </div>
              </div>
              <HealthBadge variant={redeemHealth}>{fact.wins > 0 ? `${fact.redeemRatePct}%` : '—'}</HealthBadge>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ height: 10, borderRadius: 999, background: 'rgba(15,23,42,.06)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, fact.redeemRatePct))}%`,
                    background: 'rgba(34,197,94,.35)',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          </Card>

          <Card className="sgpCard" style={{ marginTop: 12 }}>
            <div className="sgpCardHead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="sgpCardTitle">Топ призов</div>

              <div className="sgpSeg">
                <button className={'sgpSegBtn ' + (topMetric === 'wins' ? 'isActive' : '')} onClick={() => setTopMetric('wins')} type="button">
                  Выигрыши
                </button>
                <button className={'sgpSegBtn ' + (topMetric === 'redeemed' ? 'isActive' : '')} onClick={() => setTopMetric('redeemed')} type="button">
                  Выдачи
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              {top.map((p, idx) => {
                const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
                const val = Number((p as any)[topMetric]) || 0;
                const w = Math.round((val / max) * 100);

                return (
                  <div key={p.prize_code} className="sgpRow">
                    <div className="sgpRowHead">
                      <div className="sgpRowTitle" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ opacity: 0.7, fontWeight: 900 }}>{idx + 1}.</span>
                        {p.title}
                      </div>
                      <div className="sgpRowSub">
                        {topMetric === 'wins'
                          ? `выдачи: ${Number(p.redeemed) || 0}`
                          : `выигрыши: ${Number(p.wins) || 0}`
                        }
                      </div>

                      <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: 'rgba(15,23,42,.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${w}%`, borderRadius: 999, background: 'rgba(34,197,94,.35)' }} />
                      </div>
                    </div>

                    <div className="sgpRowRight">
                      <b>{val}</b>
                    </div>
                  </div>
                );
              })}

              {!top.length && <div className="sgpMeta">Пока пусто</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
