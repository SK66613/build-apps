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

// ✅ SG Premium UI kit (already in repo)
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
      className={'sgpSwitch ' + (checked ? 'is-on' : 'is-off') + (disabled ? ' is-disabled' : '')}
      onClick={(e) => {
        if (disabled) return;
        try { (e.currentTarget as any).blur?.(); } catch (_) {}
        onChange(!checked);
      }}
      aria-pressed={checked}
      aria-disabled={!!disabled}
    >
      <span className="sgpSwitch__knob" />
    </button>
  );
}

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

export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  // ===== Under-chart tabs =====
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

  // ===== Collapsible states (fix “accordion not opening”) =====
  const [openSummary, setOpenSummary] = React.useState(true);
  const [openForecast, setOpenForecast] = React.useState(true);
  const [openStock, setOpenStock] = React.useState(true);

  // ===== SETTINGS from worker (app_settings) =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

  // local drafts for app_settings (coin value + currency)
  const [coinValueDraft, setCoinValueDraft] = React.useState<string>('1'); // in currency units
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
    // quick не трогаем
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

  // ===== SETTINGS draft (ТОЛЬКО СКЛАД) =====
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

  // ===== inventory (for tips) =====
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

  // ===== EV/ROI (current config; НЕ влияет на факт) =====
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

      perPrize,
      topRisk: [...perPrize].sort((a, b) => b.expCoins - a.expCoins)[0] || null,
    };
  }, [items, draft, spinCostCoinsForecast, coinCostCentPerCoin, fact.redeemRate, costBasis]);

  // ===== MONEY SERIES (FACT DAYS) =====
  const moneySeries = React.useMemo(() => {
    const map = new Map<string, WheelTimeseriesDay>();
    for (const r of (qTs.data?.days || [])) {
      if (r?.date) map.set(String(r.date), r);
    }

    const dates = listDaysISO(range.from, range.to);
    let cum = 0;

    const series = dates.map((iso) => {
      const r = map.get(iso);

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

  const activeCount = items.filter((i) => (Number(i.active) || 0) ? true : false).length;

  // Top prizes
  const top = [...items]
    .sort((a, b) => (Number((b as any)[topMetric]) || 0) - (Number((a as any)[topMetric]) || 0))
    .slice(0, 7);

  // ===== Right: redeem health =====
  const redeemTone: 'good' | 'warn' | 'bad' = fact.wins <= 0 ? 'warn' : (fact.redeemRatePct >= 70 ? 'good' : (fact.redeemRatePct >= 40 ? 'warn' : 'bad'));

  return (
    <div className="sg-page wheelPage sgpPage">
      <div className="sgpHead">
        <div className="sgpHead__left">
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">
            Факт по <b>wheel_spins</b> + прогноз EV/ROI (по весам/себестоимости/цене спина).
          </div>
        </div>

        {/* period */}
        <div className="sgpHead__right">
          <div className="sgpRangeBar">
            <div className="sgpSeg">
              <button type="button" className={'sgpSegBtn ' + (quick === 'day' ? 'is-active' : '')} onClick={() => pickQuick('day')}>День</button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'week' ? 'is-active' : '')} onClick={() => pickQuick('week')}>Неделя</button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'month' ? 'is-active' : '')} onClick={() => pickQuick('month')}>Месяц</button>
              <button type="button" className={'sgpSegBtn ' + (quick === 'custom' ? 'is-active' : '')} onClick={() => pickQuick('custom')}>Свой</button>
            </div>

            {quick === 'custom' ? (
              <div className="sgpRangeBar__custom">
                <span className="sgpLbl">от</span>
                {/* IMPORTANT: do NOT use <Input> here, it inherits big height from global.
                   We use plain input with sg-input + sgpDate to keep it compact. */}
                <input
                  type="date"
                  className="sg-input sgpDate"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className="sgpLbl">до</span>
                <input
                  type="date"
                  className="sg-input sgpDate"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
                <button
                  type="button"
                  className="sgpBtn"
                  onClick={() => applyRange(customFrom, customTo)}
                  disabled={!customFrom || !customTo}
                >
                  Применить
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          <Card className="wheelCard sgpCard">
            <div className="sgpCardHead">
              <div>
                <div className="wheelCardTitle">Факт: выручка / расход / прибыль</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="sgpChartBtns">
                <div className="sgpSeg">
                  <button
                    type="button"
                    className={'sgpSegBtn ' + (costBasis === 'issued' ? 'is-active' : '')}
                    onClick={() => setCostBasis('issued')}
                    title="Расход считаем в момент выигрыша"
                  >
                    при выигрыше
                  </button>
                  <button
                    type="button"
                    className={'sgpSegBtn ' + (costBasis === 'redeemed' ? 'is-active' : '')}
                    onClick={() => setCostBasis('redeemed')}
                    title="Расход считаем по факту выдачи"
                  >
                    при выдаче
                  </button>
                </div>

                <IconBtn active={showRevenue} onClick={() => setShowRevenue(v => !v)} title="Выручка">
                  <IcoMoney />
                </IconBtn>
                <IconBtn active={showPayout} onClick={() => setShowPayout(v => !v)} title="Расход">
                  <IcoPay />
                </IconBtn>
                <IconBtn active={showProfitBars} onClick={() => setShowProfitBars(v => !v)} title="Прибыль">
                  П
                </IconBtn>
              </div>
            </div>

            <div className="sgpChartWrap">
              {!isLoading && !isError && (
                <ResponsiveContainer width="100%" height={320}>
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

                    {showProfitBars ? (
                      <Bar yAxisId="day" dataKey="profit" name="profit" fill="var(--accent)" fillOpacity={0.22} radius={[10, 10, 10, 10]} />
                    ) : null}

                    {showRevenue ? (
                      <Line yAxisId="day" type="monotone" dataKey="revenue" name="revenue" stroke="var(--accent2)" strokeWidth={2} dot={false} />
                    ) : null}

                    {showPayout ? (
                      <Line yAxisId="day" type="monotone" dataKey="payout" name="payout" stroke="var(--accent2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {isLoading ? (
                <div className="sgpChartOverlay">
                  <ShimmerLine />
                  <div className="sgpMuted">Загрузка…</div>
                </div>
              ) : null}

              {isError ? (
                <div className="sgpChartOverlay">
                  <div className="sgpMuted">
                    Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
                  </div>
                </div>
              ) : null}
            </div>

            {/* under chart tabs */}
            <div className="sgpUnderTabs">
              <button type="button" className={'sgpTab ' + (tab === 'summary' ? 'is-active' : '')} onClick={() => setTab('summary')}>Сводка</button>
              <button type="button" className={'sgpTab ' + (tab === 'forecast' ? 'is-active' : '')} onClick={() => setTab('forecast')}>Прогноз</button>
              <button type="button" className={'sgpTab ' + (tab === 'stock' ? 'is-active' : '')} onClick={() => setTab('stock')}>Склад</button>
            </div>

            {/* ===== TAB: SUMMARY ===== */}
            {tab === 'summary' ? (
              <div className="sgpUnderBody">
                <Collapsible
                  title="Сводка (ФАКТ)"
                  sub={`История из wheel_spins (timeseries). База расхода: ${costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}.`}
                  open={openSummary}
                  onToggle={() => setOpenSummary(v => !v)}
                  healthTone={fact.revenue_cents <= 0 ? 'warn' : (fact.profit_cents >= 0 ? 'good' : 'bad')}
                  healthTitle={fact.revenue_cents <= 0 ? 'нет данных' : (fact.profit_cents >= 0 ? 'в плюс' : 'в минус')}
                >
                  <div className="sgpGrid2">
                    <div className="sgpPanel">
                      <div className="sgpPanelHead">
                        <b>Ключевые метрики</b>
                        <HealthBadge tone={fact.revenue_cents <= 0 ? 'warn' : (fact.profit_cents >= 0 ? 'good' : 'bad')} title={fact.revenue_cents <= 0 ? 'нет данных' : (fact.profit_cents >= 0 ? 'ok' : 'минус')} />
                      </div>

                      <div className="sgpRows">
                        <div className="sgpRow"><span className="sgpMuted">Спинов</span><b>{fact.spins}</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Выручка</span><b>{moneyFromCent(fact.revenue_cents, currency)}</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Расход</span><b>{moneyFromCent(fact.payout_cents, currency)}</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Прибыль</span><b>{moneyFromCent(fact.profit_cents, currency)}</b></div>
                      </div>
                    </div>

                    <div className="sgpPanel">
                      <div className="sgpPanelHead">
                        <b>Операционка</b>
                        <HealthBadge tone={redeemTone} title={`выдача ${fact.redeemRatePct}%`} />
                      </div>

                      <div className="sgpRows">
                        <div className="sgpRow"><span className="sgpMuted">Выигрышей</span><b>{fact.wins}</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Выдано</span><b>{fact.redeemed}</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Доля выдачи</span><b>{fact.redeemRatePct}%</b></div>
                        <div className="sgpRow"><span className="sgpMuted">Активных призов</span><b>{activeCount} / {items.length}</b></div>
                      </div>
                    </div>
                  </div>

                  {/* eater list */}
                  <div className="sgpPanel" style={{ marginTop: 12 }}>
                    <div className="sgpPanelHead">
                      <b>Что сильнее всего “съедает” расход</b>
                      <Tip text={`Оценка: ${costBasis === 'issued' ? 'wins×cost' : 'redeemed×cost'}`} />
                    </div>

                    {(() => {
                      const coinCent = Math.max(0, Number(coinCostCentPerCoin || 0) || 0);
                      const basis = costBasis;
                      const rows = (Array.isArray(items) ? items : []).map((p) => {
                        const kind = normalizeKind(p);
                        const costCoins = kind === 'coins' ? Math.max(0, Number((p as any).coins || 0)) : Math.max(0, Number((p as any).cost_coins || 0));
                        const qty = basis === 'redeemed' ? Math.max(0, Number((p as any).redeemed || 0)) : Math.max(0, Number((p as any).wins || 0));
                        const estCent = Math.round(costCoins * qty * coinCent);
                        return { code: p.prize_code, title: p.title || p.prize_code, kind, qty, estCent };
                      });

                      const total = rows.reduce((s, r) => s + r.estCent, 0);
                      const list = rows
                        .filter((r) => r.estCent > 0 && r.qty > 0)
                        .sort((a, b) => b.estCent - a.estCent)
                        .slice(0, 6)
                        .map((r) => ({ ...r, sharePct: total > 0 ? Math.round((r.estCent / total) * 100) : 0 }));

                      if (!list.length) return <div className="sgpMuted">Пока нечего показать: нет себестоимости или нет wins/redeemed за период.</div>;

                      return (
                        <div className="sgpList">
                          {list.map((r) => (
                            <div key={r.code} className="sgpListRow">
                              <div className="sgpListLeft">
                                <div className="sgpListTitle">
                                  <b className="sgpEll">{r.title}</b>
                                  <span className="sgpMuted"> · {r.kind === 'coins' ? 'монеты' : 'товар'}</span>
                                </div>
                                <div className="sgpBar"><div className="sgpBarFill" style={{ width: `${Math.max(3, Math.min(100, r.sharePct))}%` }} /></div>
                              </div>
                              <div className="sgpListRight">
                                <div className="sgpMoney">{moneyFromCent(r.estCent, currency)}</div>
                                <div className="sgpMuted">{r.sharePct}% · {r.qty} шт</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </Collapsible>
              </div>
            ) : null}

            {/* ===== TAB: FORECAST ===== */}
            {tab === 'forecast' ? (
              <div className="sgpUnderBody">
                <Collapsible
                  title="Прогноз: прибыль и окупаемость"
                  sub={`Планирование по текущим настройкам (не история). Расход фиксируем ${costBasis === 'issued' ? 'в момент выигрыша' : 'в момент выдачи'}.`}
                  open={openForecast}
                  onToggle={() => setOpenForecast(v => !v)}
                  healthTone={(ev?.profitCent ?? 0) >= 0 ? 'good' : 'bad'}
                  healthTitle={(ev?.profitCent ?? 0) >= 0 ? 'плюс' : 'минус'}
                  right={<Tip text="EV = средний расход на призы на 1 спин" />}
                >
                  <div className="sgpGrid2">
                    <div className="sgpPanel">
                      <div className="sgpPanelHead">
                        <b>Цена спина (монет)</b>
                        <Tip text="Только для прогноза. Реальная цена задаётся в настройках колеса." />
                      </div>
                      <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                      <div className="sgpMuted" style={{ marginTop: 6 }}>
                        Выручка / спин ≈ <b>{moneyFromCent(spinCostCoinsForecast * coinCostCentPerCoin, currency)}</b>
                      </div>
                    </div>

                    <div className="sgpPanel">
                      <div className="sgpPanelHead">
                        <b>Спинов / день</b>
                        <Tip text="Пусто = авто по истории периода. Можно задать вручную." />
                      </div>
                      <Input value={spinsPerDayDraft} onChange={(e: any) => setSpinsPerDayDraft(e.target.value)} placeholder="пусто = авто" />
                      <div className="sgpMuted" style={{ marginTop: 6 }}>
                        авто: <b>{(() => {
                          const days = Math.max(1, listDaysISO(range.from, range.to).length || 1);
                          const s = fact.spins / days;
                          return Number.isFinite(s) ? s.toFixed(2) : '0.00';
                        })()}</b> / день
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const toNum = (v: any, d = 0) => {
                      const n = Number(String(v ?? '').replace(',', '.').trim());
                      return Number.isFinite(n) ? n : d;
                    };
                    const spinsPerDayAuto = (() => {
                      const days = Math.max(1, listDaysISO(range.from, range.to).length || 1);
                      return fact.spins / days;
                    })();
                    const spinsPerDayBase = String(spinsPerDayDraft ?? '').trim() === '' ? Math.max(0, spinsPerDayAuto) : Math.max(0, toNum(spinsPerDayDraft, 0));

                    const coinCent = Math.max(0, Number(coinCostCentPerCoin || 0) || 0);
                    const revenuePerSpinCent = spinCostCoinsForecast * coinCent;
                    const avgPayoutPerSpinCent = Math.max(0, Number(ev?.payoutCent ?? 0) || 0);
                    const avgProfitPerSpinCent = Math.round(revenuePerSpinCent - avgPayoutPerSpinCent);
                    const roi = revenuePerSpinCent > 0 ? (avgProfitPerSpinCent / revenuePerSpinCent) : null;

                    const target = forecastTargetMargin;
                    const needRevenueTargetCent = (1 - target) > 0 ? Math.ceil(avgPayoutPerSpinCent / (1 - target)) : avgPayoutPerSpinCent;
                    const needCoinsTarget = coinCent > 0 ? Math.ceil(needRevenueTargetCent / coinCent) : null;

                    const scenarios = [
                      { key: 'safe' as const, title: 'Осторожно', k: 0.7 },
                      { key: 'base' as const, title: 'База', k: 1.0 },
                      { key: 'aggr' as const, title: 'Агрессивно', k: 1.3 },
                    ];
                    const calcProfDay = (k: number) => Math.round(avgProfitPerSpinCent * (spinsPerDayBase * k));

                    const recs: Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];
                    if (coinCent <= 0) {
                      recs.push({ tone: 'warn', title: 'Заполни стоимость монеты', body: 'Для корректного прогноза нужен курс: “1 монета = …” в блоке “Склад” → “Стоимость монеты и валюта”.' });
                    } else if (avgProfitPerSpinCent < 0) {
                      recs.push({
                        tone: 'bad',
                        title: 'Подними цену спина',
                        body: `Чтобы держать цель маржи ${Math.round(target * 100)}% — цена спина ≈ ${needCoinsTarget ?? '—'} монет (сейчас ${spinCostCoinsForecast}).`,
                      });
                    } else {
                      recs.push({
                        tone: 'good',
                        title: 'Цена спина выглядит ок',
                        body: `Плановая прибыль/спин ≈ ${moneyFromCent(avgProfitPerSpinCent, currency)}. Для цели маржи ${Math.round(target * 100)}% держи цену не ниже ≈ ${needCoinsTarget ?? '—'} монет.`,
                      });
                    }

                    return (
                      <>
                        <div className="sgpTiles" style={{ marginTop: 12 }}>
                          <div className="sgpTile">
                            <div className="sgpTileLbl">Выручка / спин</div>
                            <div className="sgpTileVal">{moneyFromCent(revenuePerSpinCent, currency)}</div>
                            <div className="sgpMuted">{spinCostCoinsForecast} монет / спин</div>
                          </div>
                          <div className="sgpTile">
                            <div className="sgpTileLbl">
                              EV расход / спин <Tip text="Expected Value — средний расход на призы на один спин." />
                            </div>
                            <div className="sgpTileVal">{moneyFromCent(avgPayoutPerSpinCent, currency)}</div>
                            <div className="sgpMuted">{(ev?.payoutCoins ?? 0).toFixed(2)} монет / спин</div>
                          </div>
                          <div className={'sgpTile is-strong ' + (avgProfitPerSpinCent >= 0 ? 'is-good' : 'is-bad')}>
                            <div className="sgpTileLbl">Плановая прибыль / спин</div>
                            <div className="sgpTileVal">{moneyFromCent(avgProfitPerSpinCent, currency)}</div>
                            <div className="sgpMuted">{(ev?.profitCoins ?? 0).toFixed(2)} монет / спин</div>
                          </div>
                        </div>

                        <div className="sgpPanel" style={{ marginTop: 12 }}>
                          <div className="sgpPanelHead">
                            <b>Цель маржи</b>
                            <span className="sgpMuted">ROI: <b>{roi === null ? '—' : fmtPct(roi)}</b></span>
                          </div>

                          <div className="sgpSeg">
                            <button type="button" className={'sgpSegBtn ' + (forecastTargetMargin === 0.1 ? 'is-active' : '')} onClick={() => setForecastTargetMargin(0.1)}>10%</button>
                            <button type="button" className={'sgpSegBtn ' + (forecastTargetMargin === 0.2 ? 'is-active' : '')} onClick={() => setForecastTargetMargin(0.2)}>20%</button>
                            <button type="button" className={'sgpSegBtn ' + (forecastTargetMargin === 0.3 ? 'is-active' : '')} onClick={() => setForecastTargetMargin(0.3)}>30%</button>
                          </div>

                          <div className="sgpMuted" style={{ marginTop: 8 }}>
                            Для цели {Math.round(target * 100)}% цена спина ≈ <b>{needCoinsTarget ?? '—'}</b> монет.
                          </div>
                        </div>

                        <div className="sgpPanel" style={{ marginTop: 12 }}>
                          <div className="sgpPanelHead"><b>Сценарии (прибыль/день)</b></div>
                          <div className="sgpSeg">
                            {scenarios.map((s) => {
                              const val = calcProfDay(s.k);
                              const tone: 'good' | 'bad' = val >= 0 ? 'good' : 'bad';
                              return (
                                <button key={s.key} type="button" className={'sgpSegBtn ' + (forecastScenario === s.key ? 'is-active' : '')} onClick={() => setForecastScenario(s.key)}>
                                  {s.title} <HealthBadge tone={tone} title={moneyFromCent(val, currency) + '/д'} />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {recs.length ? (
                          <div className="sgpPanel" style={{ marginTop: 12 }}>
                            <div className="sgpPanelHead"><b>Рекомендации</b></div>
                            <div className="sgpRecs">
                              {recs.slice(0, 3).map((r, i) => (
                                <div key={i} className={'sgpRec ' + `is-${r.tone}`}>
                                  <div className="sgpRecTitle">{r.title}</div>
                                  <div className="sgpRecBody">{r.body}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </Collapsible>
              </div>
            ) : null}

            {/* ===== TAB: STOCK ===== */}
            {tab === 'stock' ? (
              <div className="sgpUnderBody">
                <Collapsible
                  title="Склад призов"
                  sub="Live-поля в wheel_prizes: active / track_qty / qty_left / stop_when_zero."
                  open={openStock}
                  onToggle={() => setOpenStock(v => !v)}
                  right={<Tip text="Если track_qty+stop_when_zero и qty_left ≤ 0 — приз не выпадает" />}
                >
                  <div className="sgpTableWrap">
                    <table className="sgpTable">
                      <colgroup>
                        <col style={{ width: '34%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '18%' }} />
                      </colgroup>

                      <thead>
                        <tr>
                          <th>Название</th>
                          <th style={{ textAlign: 'center' }}>Активен</th>
                          <th style={{ textAlign: 'center' }}>Учёт</th>
                          <th style={{ textAlign: 'center' }}>Остаток</th>
                          <th style={{ textAlign: 'center' }}>Авто-выкл</th>
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

                          const rowTone = !active ? 'off' : (tracked ? (out ? 'out' : (low ? 'low' : 'on')) : 'on');

                          return (
                            <tr key={code} className={'sgpTr ' + `is-${rowTone}`}>
                              <td>
                                <div className="sgpTitleMain">{p.title || code}</div>
                                <div className="sgpTitleSub">
                                  {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'}
                                  <span className="sgpDot">·</span>
                                  <span className="sgpMuted">код:</span> <b>{code}</b>
                                </div>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <Tip text={active ? 'Включен · приз участвует' : 'Выключен · приз не выпадает'}>
                                  <Switch
                                    checked={active}
                                    disabled={false}
                                    onChange={(v: boolean) => {
                                      if (!v) {
                                        patchDraft(code, { active: false, track_qty: false, stop_when_zero: false, qty_left: '' });
                                        return;
                                      }
                                      patchDraft(code, { active: true });
                                    }}
                                  />
                                </Tip>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <Tip text={!active ? 'Выключено · сначала включи приз' : (tracked ? 'Включен · учитываем qty_left' : 'Выключен · склад не считаем')}>
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
                                </Tip>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <div className="sgpQtyCell">
                                  {out && swz ? <div className="sgpWarn is-out">Закончились — приз не выпадает</div> : null}
                                  {!out && low ? <div className="sgpWarn is-low">Скоро закончатся (≤ {inventory.lowThreshold})</div> : null}

                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    className="sg-input sgpQty"
                                    value={tracked ? d.qty_left : ''}
                                    disabled={!tracked}
                                    onChange={(e) => patchDraft(code, { qty_left: (e.target as any).value })}
                                    placeholder={tracked ? '0' : '—'}
                                  />
                                </div>
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <Tip text={!active ? 'Выключено · сначала включи приз' : (!tracked ? 'Выключено · включи учёт' : (swz ? 'Включен · при 0 приз не выпадает' : 'Выключен · при 0 приз может выпадать'))}>
                                  <Switch
                                    checked={swz}
                                    disabled={!tracked}
                                    onChange={(v: boolean) => {
                                      if (!tracked) return;
                                      patchDraft(code, { stop_when_zero: v });
                                    }}
                                  />
                                </Tip>
                              </td>
                            </tr>
                          );
                        })}

                        {!items.length && !qStats.isLoading ? (
                          <tr><td colSpan={5} className="sgpMuted" style={{ padding: 14 }}>Нет призов.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="sgpBottomBar">
                    <div className="sgpMuted">
                      {saveMsg ? <b>{saveMsg}</b> : 'Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.'}
                    </div>

                    <button
                      type="button"
                      className="sgpBtn"
                      disabled={saving || qStats.isLoading || !appId}
                      onClick={saveStock}
                    >
                      {saving ? 'Сохраняю…' : 'Сохранить склад'}
                    </button>
                  </div>

                  {/* app_settings block BELOW stock */}
                  <div className="sgpPanel" style={{ marginTop: 12 }}>
                    <div className="sgpPanelHead">
                      <b>Стоимость монеты и валюта</b>
                      <Tip text="Влияет на денежные расчёты и прогноз." />
                    </div>

                    <div className="sgpGrid2" style={{ marginTop: 8 }}>
                      <div>
                        <div className="sgpMuted" style={{ marginBottom: 6 }}>
                          Стоимость 1 монеты ({currencyLabel(currencyDraft)})
                        </div>
                        <Input value={coinValueDraft} onChange={(e: any) => setCoinValueDraft(e.target.value)} placeholder="1.00" />
                        <div className="sgpMuted" style={{ marginTop: 6 }}>
                          = {moneyFromCent(coinCostCentPerCoin, currencyDraft)} / монета
                        </div>
                      </div>

                      <div>
                        <div className="sgpMuted" style={{ marginBottom: 6 }}>Валюта</div>
                        <select
                          value={currencyDraft}
                          onChange={(e) => setCurrencyDraft(String((e.target as any).value || 'RUB').toUpperCase())}
                          className="sg-input"
                        >
                          <option value="RUB">RUB (₽)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                      </div>
                    </div>

                    <div className="sgpActions">
                      <button type="button" className="sgpBtn" onClick={saveAppSettings} disabled={savingCoin || !appId}>
                        {savingCoin ? 'Сохраняю…' : 'Сохранить'}
                      </button>

                      {coinMsg ? <span className="sgpMuted">{coinMsg}</span> : null}
                      {qSettings.isError ? <span className="sgpMuted">settings: ошибка</span> : null}

                      <span className="sgpMuted" style={{ marginLeft: 'auto' }}>
                        пример: USD + 0.10 = “1 монета = 10 центов”
                      </span>
                    </div>
                  </div>
                </Collapsible>
              </div>
            ) : null}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          <Card className="wheelCard sgpCard" style={{ marginBottom: 12 }}>
            <div className="sgpRedeem">
              <div className="sgpRedeemTop">
                <div className="sgpRedeemTitle">Выдача призов</div>
                <HealthBadge tone={redeemTone} title={redeemTone === 'good' ? 'OK' : (redeemTone === 'warn' ? 'РИСК' : 'ПЛОХО')} />
              </div>

              <div className="sgpBarTrack" aria-hidden="true">
                <div className="sgpBarFill" style={{ width: `${Math.max(0, Math.min(100, fact.redeemRatePct))}%` }} />
              </div>

              <div className="sgpRedeemMeta">
                <span className="sgpMuted">Выигрышей: <b>{fact.wins}</b></span>
                <span className="sgpMuted">Выдано: <b>{fact.redeemed}</b></span>
              </div>
            </div>
          </Card>

          <Card className="wheelCard wheelStickyTop sgpCard">
            <div className="sgpCardHead">
              <div className="wheelCardTitle">Топ призов</div>

              <div className="sgpSeg">
                <button type="button" className={'sgpSegBtn ' + (topMetric === 'wins' ? 'is-active' : '')} onClick={() => setTopMetric('wins')}>Выигрыши</button>
                <button type="button" className={'sgpSegBtn ' + (topMetric === 'redeemed' ? 'is-active' : '')} onClick={() => setTopMetric('redeemed')}>Выдачи</button>
              </div>
            </div>

            <div className="sgpTopList">
              {top.map((p, idx) => {
                const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
                const val = Number((p as any)[topMetric]) || 0;
                const w = Math.round((val / max) * 100);

                return (
                  <div className={'sgpTopRow ' + (idx < 3 ? 'is-top' : '')} key={p.prize_code}>
                    <div className={'sgpMedal m' + (idx + 1)}>{idx + 1}</div>

                    <div className="sgpTopMid">
                      <div className="sgpTopTitle">{p.title}</div>
                      <div className="sgpMuted" style={{ marginTop: 2 }}>
                        {topMetric === 'wins' ? `выдачи: ${Number(p.redeemed) || 0}` : `выигрыши: ${Number(p.wins) || 0}`}
                      </div>
                      <div className="sgpBar" style={{ marginTop: 8 }}>
                        <div className="sgpBarFill" style={{ width: `${w}%` }} />
                      </div>
                    </div>

                    <div className="sgpTopRight">
                      <div className="sgpTopCount">{val}</div>
                    </div>
                  </div>
                );
              })}

              {!top.length ? <div className="sgpMuted">Пока пусто</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
