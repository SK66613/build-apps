// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
  Toggle,
  Pill,
} from '../components/ui';

import { SgPage } from '../components/sgp/layout/SgPage';
import { SgFormRow } from '../components/sgp/ui/SgFormRow';
import { SgActions, SgSaveState } from '../components/sgp/ui/SgActions';

// Charts
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

// Existing SGP widgets (keep)
import { HealthBadge } from '../components/sgp/HealthBadge';
import { Tip } from '../components/sgp/Tip';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { Collapsible } from '../components/sgp/Collapsible';
import { IconBtn } from '../components/sgp/IconBtn';

/** ========= Types ========= */
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

  // ✅ money snapshots (cents) from wheel_spins
  revenue_cents: number;
  payout_issued_cents: number;
  payout_redeemed_cents: number;
  profit_issued_cents: number;
  profit_redeemed_cents: number;
};

type AppSettings = {
  coin_value_cents?: number;
  currency?: string; // 'RUB' | 'USD' | 'EUR' | ...
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

// if track_qty + stop_when_zero + qty_left<=0 => effective weight = 0
function effWeight(p: PrizeStat, w: number) {
  const tracked = isTracked(p);
  const swz = isStopWhenZero(p);
  const q = qtyLeft(p);
  if (tracked && swz && q !== null && q <= 0) return 0;
  return Math.max(0, w);
}

/** ========= UI helpers ========= */
function TabBtn({
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
      className={'sgpSegBtn ' + (active ? 'is-active' : '')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** ========= Page ========= */
export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  // under-chart tabs
  const [tab, setTab] = React.useState<'summary' | 'forecast' | 'stock'>('summary');

  // расход считать: при выигрыше или при выдаче (переключает payout/profit из timeseries)
  const [costBasis, setCostBasis] = React.useState<'issued' | 'redeemed'>('issued');

  // Денежный график: кнопки слоёв
  const [showRevenue, setShowRevenue] = React.useState(true);
  const [showPayout, setShowPayout] = React.useState(false);
  const [showProfitBars, setShowProfitBars] = React.useState(true);

  // Быстрые периоды
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // Right card Top prizes
  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');

  // Collapsible states
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

      // если пользователь уже руками менял — не затираем
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
        body: JSON.stringify({ settings: { coin_value_cents: cents, currency: cur } }),
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
    if (kind === 'day') return applyRange(anchor, anchor);
    if (kind === 'week') return applyRange(isoAddDays(anchor, -6), anchor);
    if (kind === 'month') return applyRange(isoAddDays(anchor, -29), anchor);
  }

  // ===== prizes stats (by prize) =====
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
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
    qTs.data?.settings?.currency || qSettings.data?.settings?.currency || currencyDraft || 'RUB'
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

    const redeemRate = wins > 0 ? Math.max(0, Math.min(1, redeemed / wins)) : 0;

    return {
      spins,
      wins,
      redeemed,
      revenue_cents,
      payout_cents,
      profit_cents,
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
  const [savingStock, setSavingStock] = React.useState(false);
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
            qty_left: p.qty_left === null || p.qty_left === undefined ? '' : String(p.qty_left),
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
        const qty_left = qty_left_raw === '' ? undefined : Math.max(0, toInt(qty_left_raw, 0));

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

    setSavingStock(true);
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
      setSavingStock(false);
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

    return { trackedCount, outOfStockCount, lowStockCount, autoOffCount, lowThreshold };
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
    const roiCoins = spinRevenueCoins > 0 ? profitCoins / spinRevenueCoins : null;

    const payoutCentIssued = Math.round(payoutCoinsIssued * coinCostCentPerCoin);
    const payoutCentRedeemed = Math.round(payoutCoinsRedeemed * coinCostCentPerCoin);
    const payoutCent = costBasis === 'redeemed' ? payoutCentRedeemed : payoutCentIssued;

    const profitCent = Math.round(spinRevenueCent - payoutCent);
    const roi = spinRevenueCent > 0 ? profitCent / spinRevenueCent : null;

    return {
      wSum,
      spinRevenueCoins,
      spinRevenueCent,
      payoutCent,
      profitCent,
      roi,
      payoutCoins,
      profitCoins,
      roiCoins,
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

      return { date: iso, revenue, payout, profit, cum_profit: cum };
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

  const redeemTone: 'good' | 'warn' | 'bad' =
    fact.wins <= 0 ? 'warn' : (fact.redeemRatePct >= 70 ? 'good' : (fact.redeemRatePct >= 40 ? 'warn' : 'bad'));

  // Save state for SgActions
  const stockSaveState: SgSaveState = savingStock ? 'saving' : (saveMsg?.startsWith('Сохранено') ? 'saved' : (saveMsg?.startsWith('Ошибка') ? 'error' : 'idle'));
  const coinSaveState: SgSaveState = savingCoin ? 'saving' : (coinMsg === 'Сохранено' ? 'saved' : (coinMsg?.startsWith('Ошибка') ? 'error' : 'idle'));

  return (
    <SgPage
      className="wheelPage sgpPage"
      title="Колесо"
      subtitle={
        <span>
          Факт по <b>wheel_spins</b> + прогноз EV/ROI (по весам/себестоимости/цене спина).
        </span>
      }
      actions={
        <div className="sgpRangeBar">
          <div className="sgpSeg">
            <TabBtn active={quick === 'day'} onClick={() => pickQuick('day')}>День</TabBtn>
            <TabBtn active={quick === 'week'} onClick={() => pickQuick('week')}>Неделя</TabBtn>
            <TabBtn active={quick === 'month'} onClick={() => pickQuick('month')}>Месяц</TabBtn>
            <TabBtn active={quick === 'custom'} onClick={() => pickQuick('custom')}>Свой</TabBtn>
          </div>

          {quick === 'custom' ? (
            <div className="sgpRangeBar__custom">
              <span className="sgpLbl">от</span>
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
      }
      aside={
        <div className="wheelAside">
          <div className="wheelAside__block">
            <div className="wheelAside__title">Выдача призов</div>
            <HealthBadge tone={redeemTone} title={`${fact.redeemRatePct}%`} />
            <div className="wheelAside__row">
              <span>Выигрышей</span>
              <b>{fact.wins}</b>
            </div>
            <div className="wheelAside__row">
              <span>Выдано</span>
              <b>{fact.redeemed}</b>
            </div>
            <Tip tone={redeemTone}>
              {fact.wins <= 0
                ? 'Пока нет данных за период.'
                : (fact.redeemRatePct >= 70
                  ? 'Отлично. Выдача высокая — значит призы реально забирают.'
                  : (fact.redeemRatePct >= 40
                    ? 'Нормально, но можно улучшить “доходимость”: напоминания, правила выдачи, витрина призов.'
                    : 'Низкая выдача. Проверь коммуникацию кассира и понятность “как забрать приз”.'))}
            </Tip>
          </div>

          <div className="wheelAside__block">
            <div className="wheelAside__title">Топ призов</div>

            <div className="sgpSeg" style={{ marginTop: 8 }}>
              <TabBtn active={topMetric === 'wins'} onClick={() => setTopMetric('wins')}>Выигрыши</TabBtn>
              <TabBtn active={topMetric === 'redeemed'} onClick={() => setTopMetric('redeemed')}>Выдачи</TabBtn>
            </div>

            <div className="wheelTopList">
              {top.map((p, idx) => {
                const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
                const val = Number((p as any)[topMetric]) || 0;
                const w = Math.round((val / max) * 100);

                return (
                  <div key={p.prize_code || idx} className="wheelTopRow">
                    <div className="wheelTopRow__idx">{idx + 1}</div>
                    <div className="wheelTopRow__mid">
                      <div className="wheelTopRow__title">{p.title || p.prize_code}</div>
                      <div className="wheelTopRow__sub">
                        {topMetric === 'wins'
                          ? `выдачи: ${Number(p.redeemed) || 0}`
                          : `выигрыши: ${Number(p.wins) || 0}`}
                      </div>
                      <div className="wheelTopRow__bar">
                        <div className="wheelTopRow__barFill" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                    <div className="wheelTopRow__val">{val}</div>
                  </div>
                );
              })}
              {!top.length ? <div className="wheelEmpty">Пока пусто</div> : null}
            </div>
          </div>
        </div>
      }
    >
      {/* ===== FACT CHART ===== */}
      <Card className="sgpCard">
        <CardHeader className="sgpCardHead">
          <div>
            <CardTitle>Факт: выручка / расход / прибыль</CardTitle>
            <div className="wheelCardSub">{range.from} — {range.to}</div>
          </div>

          <div className="sgpChartBtns">
            <div className="sgpSeg">
              <TabBtn active={costBasis === 'issued'} onClick={() => setCostBasis('issued')}>
                при выигрыше
              </TabBtn>
              <TabBtn active={costBasis === 'redeemed'} onClick={() => setCostBasis('redeemed')}>
                при выдаче
              </TabBtn>
            </div>

            <div className="sgpIconRow">
              <IconBtn
                active={showRevenue}
                title="Выручка"
                onClick={() => setShowRevenue((v) => !v)}
              >
                R
              </IconBtn>
              <IconBtn
                active={showPayout}
                title="Расход"
                onClick={() => setShowPayout((v) => !v)}
              >
                C
              </IconBtn>
              <IconBtn
                active={showProfitBars}
                title="Прибыль"
                onClick={() => setShowProfitBars((v) => !v)}
              >
                P
              </IconBtn>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!isLoading && !isError ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={moneySeries.series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => fmtDDMM(String(v || ''))} />
                  <YAxis
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return '';
                      return String(Math.round(n / 100));
                    }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      const v = Number(val);
                      if (!Number.isFinite(v)) return [val, name];
                      if (name === 'profit') return [moneyFromCent(v, currency), 'Прибыль/день'];
                      if (name === 'revenue') return [moneyFromCent(v, currency), 'Выручка/день'];
                      if (name === 'payout') return [moneyFromCent(v, currency), 'Расход/день'];
                      if (name === 'cum_profit') return [moneyFromCent(v, currency), 'Кум. прибыль'];
                      return [val, name];
                    }}
                    labelFormatter={(_: any, payload: any) => {
                      const d = payload?.[0]?.payload?.date;
                      return d ? `Дата ${d}` : 'Дата';
                    }}
                  />

                  {showProfitBars ? <Bar dataKey="profit" name="profit" /> : null}
                  {showRevenue ? <Line type="monotone" dataKey="revenue" name="revenue" dot={false} /> : null}
                  {showPayout ? <Line type="monotone" dataKey="payout" name="payout" dot={false} /> : null}

                  {/* cumulative line always on (premium) */}
                  <Line type="monotone" dataKey="cum_profit" name="cum_profit" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {isLoading ? <div className="wheelLoading">Загрузка…</div> : null}
          {isError ? (
            <div className="wheelError">
              Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="wheelUnderChart">
          <div className="sgpSeg">
            <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>Сводка</TabBtn>
            <TabBtn active={tab === 'forecast'} onClick={() => setTab('forecast')}>Прогноз</TabBtn>
            <TabBtn active={tab === 'stock'} onClick={() => setTab('stock')}>Склад</TabBtn>
          </div>

          <div className="wheelFactsInline">
            <Pill>Спинов: <b>{fact.spins}</b></Pill>
            <Pill>Выручка: <b>{moneyFromCent(fact.revenue_cents, currency)}</b></Pill>
            <Pill>Расход: <b>{moneyFromCent(fact.payout_cents, currency)}</b></Pill>
            <Pill>Прибыль: <b>{moneyFromCent(fact.profit_cents, currency)}</b></Pill>
          </div>
        </CardFooter>
      </Card>

      {/* ===== TAB: SUMMARY ===== */}
      {tab === 'summary' ? (
        <Card className="sgpCard">
          <CardHeader className="sgpCardHead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CardTitle>Ключевые метрики</CardTitle>
              <HealthBadge
                tone={fact.revenue_cents <= 0 ? 'warn' : (fact.profit_cents >= 0 ? 'good' : 'bad')}
                title={fact.revenue_cents <= 0 ? 'нет данных' : (fact.profit_cents >= 0 ? 'ok' : 'минус')}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconBtn active={openSummary} onClick={() => setOpenSummary((v) => !v)} title="Свернуть/развернуть">
                {openSummary ? '—' : '+'}
              </IconBtn>
            </div>
          </CardHeader>

          <CardContent>
            <Collapsible open={openSummary}>
              <div className="wheelMetricsGrid">
                <div className="wheelMetric">
                  <div className="wheelMetric__k">Спинов</div>
                  <div className="wheelMetric__v">{fact.spins}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Выручка</div>
                  <div className="wheelMetric__v">{moneyFromCent(fact.revenue_cents, currency)}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Расход</div>
                  <div className="wheelMetric__v">{moneyFromCent(fact.payout_cents, currency)}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Прибыль</div>
                  <div className="wheelMetric__v">{moneyFromCent(fact.profit_cents, currency)}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Выигрышей</div>
                  <div className="wheelMetric__v">{fact.wins}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Выдано</div>
                  <div className="wheelMetric__v">{fact.redeemed}</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Доля выдачи</div>
                  <div className="wheelMetric__v">{fact.redeemRatePct}%</div>
                </div>

                <div className="wheelMetric">
                  <div className="wheelMetric__k">Активных призов</div>
                  <div className="wheelMetric__v">{activeCount} / {items.length}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="wheelBlockTitle">Что сильнее всего “съедает” расход</div>
                {(() => {
                  const coinCent = Math.max(0, Number(coinCostCentPerCoin || 0) || 0);
                  const basis = costBasis;

                  const rows = (Array.isArray(items) ? items : []).map((p) => {
                    const kind = normalizeKind(p);
                    const costCoins =
                      kind === 'coins'
                        ? Math.max(0, Number((p as any).coins || 0))
                        : Math.max(0, Number((p as any).cost_coins || 0));

                    const qty = basis === 'redeemed'
                      ? Math.max(0, Number((p as any).redeemed || 0))
                      : Math.max(0, Number((p as any).wins || 0));

                    const estCent = Math.round(costCoins * qty * coinCent);
                    return { code: p.prize_code, title: p.title || p.prize_code, kind, qty, estCent };
                  });

                  const total = rows.reduce((s, r) => s + r.estCent, 0);
                  const list = rows
                    .filter((r) => r.estCent > 0 && r.qty > 0)
                    .sort((a, b) => b.estCent - a.estCent)
                    .slice(0, 6)
                    .map((r) => ({ ...r, sharePct: total > 0 ? Math.round((r.estCent / total) * 100) : 0 }));

                  if (!list.length) {
                    return (
                      <Tip tone="warn">
                        Пока нечего показать: нет себестоимости (cost_coins) или нет wins/redeemed за период.
                      </Tip>
                    );
                  }

                  return (
                    <div className="wheelEaters">
                      {list.map((r) => (
                        <div key={r.code} className="wheelEaterRow">
                          <div className="wheelEaterRow__title">
                            {r.title} · {r.kind === 'coins' ? 'монеты' : 'товар'}
                          </div>
                          <div className="wheelEaterRow__meta">
                            <b>{moneyFromCent(r.estCent, currency)}</b> · {r.sharePct}% · {r.qty} шт
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </Collapsible>
          </CardContent>
        </Card>
      ) : null}

      {/* ===== TAB: FORECAST ===== */}
      {tab === 'forecast' ? (
        <Card className="sgpCard">
          <CardHeader className="sgpCardHead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CardTitle>Прогноз EV/ROI</CardTitle>
              <HealthBadge tone={(ev?.profitCent ?? 0) >= 0 ? 'good' : 'bad'} title={(ev?.profitCent ?? 0) >= 0 ? 'плюс' : 'минус'} />
            </div>

            <IconBtn active={openForecast} onClick={() => setOpenForecast((v) => !v)} title="Свернуть/развернуть">
              {openForecast ? '—' : '+'}
            </IconBtn>
          </CardHeader>

          <CardContent>
            <Collapsible open={openForecast}>
              <div className="wheelForecastGrid">
                <SgFormRow
                  label="Цена спина (монет)"
                  hint={`Выручка/спин ≈ ${moneyFromCent(spinCostCoinsForecast * coinCostCentPerCoin, currency)}`}
                >
                  <Input
                    value={spinCostCoinsDraft}
                    onChange={(e) => setSpinCostCoinsDraft(e.target.value)}
                    placeholder="10"
                  />
                </SgFormRow>

                <SgFormRow
                  label="Спинов / день"
                  hint={
                    (() => {
                      const days = Math.max(1, listDaysISO(range.from, range.to).length || 1);
                      const s = fact.spins / days;
                      return `авто: ${Number.isFinite(s) ? s.toFixed(2) : '0.00'} / день`;
                    })()
                  }
                >
                  <Input
                    value={spinsPerDayDraft}
                    onChange={(e) => setSpinsPerDayDraft(e.target.value)}
                    placeholder="пусто = авто"
                  />
                </SgFormRow>
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

                const spinsPerDayBase =
                  String(spinsPerDayDraft ?? '').trim() === ''
                    ? Math.max(0, spinsPerDayAuto)
                    : Math.max(0, toNum(spinsPerDayDraft, 0));

                const coinCent = Math.max(0, Number(coinCostCentPerCoin || 0) || 0);
                const revenuePerSpinCent = spinCostCoinsForecast * coinCent;
                const avgPayoutPerSpinCent = Math.max(0, Number(ev?.payoutCent ?? 0) || 0);
                const avgProfitPerSpinCent = Math.round(revenuePerSpinCent - avgPayoutPerSpinCent);
                const roi = revenuePerSpinCent > 0 ? (avgProfitPerSpinCent / revenuePerSpinCent) : null;

                const target = forecastTargetMargin;
                const needRevenueTargetCent =
                  (1 - target) > 0
                    ? Math.ceil(avgPayoutPerSpinCent / (1 - target))
                    : avgPayoutPerSpinCent;

                const needCoinsTarget = coinCent > 0 ? Math.ceil(needRevenueTargetCent / coinCent) : null;

                const scenarios = [
                  { key: 'safe' as const, title: 'Осторожно', k: 0.7 },
                  { key: 'base' as const, title: 'База', k: 1.0 },
                  { key: 'aggr' as const, title: 'Агрессивно', k: 1.3 },
                ];

                const calcProfDay = (k: number) => Math.round(avgProfitPerSpinCent * (spinsPerDayBase * k));

                const recs: Array<{ tone: 'good' | 'warn' | 'bad'; title: string; body: string }> = [];
                if (coinCent <= 0) {
                  recs.push({
                    tone: 'warn',
                    title: 'Заполни стоимость монеты',
                    body: 'Для корректного прогноза нужен курс: “1 монета = …” в блоке “Склад” → “Стоимость монеты и валюта”.',
                  });
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
                    body: `Плановая прибыль/спин ≈ ${moneyFromCent(avgProfitPerSpinCent, currency)}.`,
                  });
                }

                return (
                  <div style={{ marginTop: 12 }}>
                    <div className="wheelForecastKpi">
                      <Pill>Выручка/спин: <b>{moneyFromCent(revenuePerSpinCent, currency)}</b></Pill>
                      <Pill>Расход/спин: <b>{moneyFromCent(avgPayoutPerSpinCent, currency)}</b></Pill>
                      <Pill>Прибыль/спин: <b>{moneyFromCent(avgProfitPerSpinCent, currency)}</b></Pill>
                      <Pill>ROI: <b>{roi === null ? '—' : `${Math.round(roi * 100)}%`}</b></Pill>
                    </div>

                    <div className="wheelBlockTitle" style={{ marginTop: 10 }}>
                      Цель маржи
                    </div>
                    <div className="sgpSeg" style={{ marginTop: 6 }}>
                      <TabBtn active={forecastTargetMargin === 0.1} onClick={() => setForecastTargetMargin(0.1)}>10%</TabBtn>
                      <TabBtn active={forecastTargetMargin === 0.2} onClick={() => setForecastTargetMargin(0.2)}>20%</TabBtn>
                      <TabBtn active={forecastTargetMargin === 0.3} onClick={() => setForecastTargetMargin(0.3)}>30%</TabBtn>
                    </div>
                    <div className="wheelSubtle" style={{ marginTop: 6 }}>
                      Для цели {Math.round(target * 100)}% цена спина ≈ <b>{needCoinsTarget ?? '—'}</b> монет.
                    </div>

                    <div className="wheelBlockTitle" style={{ marginTop: 12 }}>
                      Сценарии (прибыль/день)
                    </div>
                    <div className="wheelScenarioRow">
                      {scenarios.map((s) => {
                        const val = calcProfDay(s.k);
                        const tone: 'good' | 'bad' = val >= 0 ? 'good' : 'bad';
                        return (
                          <button
                            key={s.key}
                            type="button"
                            className={'wheelScenario ' + (forecastScenario === s.key ? 'is-active' : '')}
                            onClick={() => setForecastScenario(s.key)}
                          >
                            <div className="wheelScenario__t">{s.title}</div>
                            <div className={'wheelScenario__v ' + (tone === 'good' ? 'is-good' : 'is-bad')}>
                              {moneyFromCent(val, currency)}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {recs.length ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="wheelBlockTitle">Рекомендации</div>
                        <div className="wheelRecs">
                          {recs.slice(0, 3).map((r, i) => (
                            <Tip key={i} tone={r.tone}>
                              <b>{r.title}</b>
                              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.body}</div>
                            </Tip>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </Collapsible>
          </CardContent>
        </Card>
      ) : null}

      {/* ===== TAB: STOCK ===== */}
      {tab === 'stock' ? (
        <>
          <Card className="sgpCard">
            <CardHeader className="sgpCardHead">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CardTitle>Склад призов</CardTitle>
                <Pill>Учёт: <b>{inventory.trackedCount}</b></Pill>
                <Pill>Закончились: <b>{inventory.outOfStockCount}</b></Pill>
                <Pill>Мало (≤ {inventory.lowThreshold}): <b>{inventory.lowStockCount}</b></Pill>
              </div>

              <IconBtn active={openStock} onClick={() => setOpenStock((v) => !v)} title="Свернуть/развернуть">
                {openStock ? '—' : '+'}
              </IconBtn>
            </CardHeader>

            <CardContent>
              <Collapsible open={openStock}>
                <div className="wheelStockHead">
                  <div className="wheelStockCol wheelStockCol--name">Название</div>
                  <div className="wheelStockCol">Активен</div>
                  <div className="wheelStockCol">Учёт</div>
                  <div className="wheelStockCol">Остаток</div>
                  <div className="wheelStockCol">Авто-выкл</div>
                </div>

                <div className="wheelStockList">
                  {items.map((p) => {
                    const code = p.prize_code;
                    const d = draft[code] || {
                      active: !!p.active,
                      track_qty: !!p.track_qty,
                      qty_left: p.qty_left === null || p.qty_left === undefined ? '' : String(p.qty_left),
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
                      <div key={code} className={'wheelStockRow tone-' + rowTone}>
                        <div className="wheelStockCol wheelStockCol--name">
                          <div className="wheelStockName">{p.title || code}</div>
                          <div className="wheelStockSub">
                            {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'} · код: {code}
                          </div>

                          {out && swz ? (
                            <div className="wheelStockHint is-bad">Закончились — приз не выпадает</div>
                          ) : null}
                          {!out && low ? (
                            <div className="wheelStockHint is-warn">Скоро закончатся (≤ {inventory.lowThreshold})</div>
                          ) : null}
                        </div>

                        <div className="wheelStockCol">
                          <Toggle
                            checked={active}
                            onChange={(v) => {
                              if (!v) {
                                patchDraft(code, { active: false, track_qty: false, stop_when_zero: false, qty_left: '' });
                                return;
                              }
                              patchDraft(code, { active: true });
                            }}
                          />
                        </div>

                        <div className="wheelStockCol">
                          <Toggle
                            checked={tracked}
                            disabled={!active}
                            onChange={(v) => {
                              if (!active) return;
                              if (!v) {
                                patchDraft(code, { track_qty: false, stop_when_zero: false, qty_left: '' });
                                return;
                              }
                              patchDraft(code, { track_qty: true });
                            }}
                          />
                        </div>

                        <div className="wheelStockCol">
                          <Input
                            value={d.qty_left}
                            onChange={(e) => patchDraft(code, { qty_left: (e.target as any).value })}
                            placeholder={tracked ? '0' : '—'}
                            disabled={!tracked}
                          />
                        </div>

                        <div className="wheelStockCol">
                          <Toggle
                            checked={tracked && !!d.stop_when_zero}
                            disabled={!tracked}
                            onChange={(v) => {
                              if (!tracked) return;
                              patchDraft(code, { stop_when_zero: v });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!items.length && !qStats.isLoading ? <div className="wheelEmpty">Нет призов.</div> : null}
                </div>

                <div style={{ marginTop: 12 }}>
                  <Tip tone="warn">
                    {saveMsg ? <span>{saveMsg}</span> : (
                      <span>Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.</span>
                    )}
                  </Tip>
                </div>
              </Collapsible>
            </CardContent>

            <CardFooter>
              <SgActions
                primaryLabel="Сохранить склад"
                onPrimary={saveStock}
                state={stockSaveState}
                errorText={saveMsg?.startsWith('Ошибка') ? saveMsg : undefined}
                left={<span className="wheelSubtle">Меняется только склад (active/track/qty/auto-off).</span>}
              />
            </CardFooter>
          </Card>

          {/* app_settings block BELOW stock */}
          <Card className="sgpCard">
            <CardHeader className="sgpCardHead">
              <CardTitle>Стоимость монеты и валюта</CardTitle>
              <div className="wheelSubtle">пример: USD + 0.10 = “1 монета = 10 центов”</div>
            </CardHeader>

            <CardContent>
              <SgFormRow
                label={`Стоимость 1 монеты (${currencyLabel(currencyDraft)})`}
                hint={`= ${moneyFromCent(coinCostCentPerCoin, currencyDraft)} / монета`}
              >
                <Input
                  value={coinValueDraft}
                  onChange={(e) => setCoinValueDraft(e.target.value)}
                  placeholder="1.00"
                />
              </SgFormRow>

              <SgFormRow label="Валюта" hint={qSettings.isError ? 'settings: ошибка' : ''}>
                <select
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(String((e.target as any).value || 'RUB').toUpperCase())}
                  className="sg-input"
                >
                  <option value="RUB">RUB (₽)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </SgFormRow>

              {coinMsg ? <Tip tone={coinMsg.startsWith('Ошибка') ? 'bad' : 'good'}>{coinMsg}</Tip> : null}
            </CardContent>

            <CardFooter>
              <SgActions
                primaryLabel="Сохранить"
                onPrimary={saveAppSettings}
                state={coinSaveState}
                errorText={coinMsg?.startsWith('Ошибка') ? coinMsg : undefined}
                left={
                  <span className="wheelSubtle">
                    Используется в прогнозе и оценке себестоимости.
                  </span>
                }
              />
            </CardFooter>
          </Card>
        </>
      ) : null}

      {/* ===== Shimmer (optional) ===== */}
      {isLoading ? <ShimmerLine /> : null}
    </SgPage>
  );
}
