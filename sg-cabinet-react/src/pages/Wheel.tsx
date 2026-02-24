// sg-cabinet-react/src/pages/Wheel.tsx
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
  SgCardFooter,
} from '../components/sgp/ui/SgCard';
import { SgButton } from '../components/sgp/ui/SgButton';
import { SgInput, SgSelect } from '../components/sgp/ui/SgInput';
import { SgToggle } from '../components/sgp/ui/SgToggle';

import { HealthBadge } from '../components/sgp/HealthBadge';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { IconBtn } from '../components/sgp/IconBtn';

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

  // new source of truth for item cost (in coins)
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

  revenue_cents: number;
  payout_issued_cents: number;
  payout_redeemed_cents: number;
  profit_issued_cents: number;
  profit_redeemed_cents: number;
};

type AppSettings = {
  coin_value_cents?: number;
  currency?: string;
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
function qtyLeft(p: PrizeStat) {
  const q = (p as any).qty_left;
  const n = Number(q);
  return Number.isFinite(n) ? n : null;
}
function effWeight(p: PrizeStat, w: number) {
  const tracked = Number(p.track_qty || 0) ? true : false;
  const swz = Number(p.stop_when_zero || 0) ? true : false;
  const q = qtyLeft(p);
  if (tracked && swz && q !== null && q <= 0) return 0;
  return Math.max(0, w);
}

/** ========= Premium tiny UI bits ========= */
function SgpPill({ children }: { children: React.ReactNode }) {
  return <span className="sgp-pill">{children}</span>;
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

function Hint({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  children: React.ReactNode;
}) {
  return <div className={`sgp-hint tone-${tone}`}>{children}</div>;
}

/** ========= Chart bar shape: +/- ========= */
function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;
  const v = Number(value || 0);
  const fill =
    v >= 0 ? 'var(--sgp-chart-good, rgba(16,185,129,.45))' : 'var(--sgp-chart-bad, rgba(239,68,68,.40))';

  const h = Math.abs(Number(height) || 0);
  const yy = Number(height) >= 0 ? y : y - h;

  return <rect x={x} y={yy} width={width} height={h} rx={6} ry={6} fill={fill} />;
}

/** ========= Page ========= */
export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  const [tab, setTab] = React.useState<'summary' | 'forecast' | 'stock'>('summary');
  const [costBasis, setCostBasis] = React.useState<'issued' | 'redeemed'>('issued');

  const [showRevenue, setShowRevenue] = React.useState(true);
  const [showPayout, setShowPayout] = React.useState(false);
  const [showProfitBars, setShowProfitBars] = React.useState(true);
  const [showCum, setShowCum] = React.useState(true);

  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');

  const [openSummary, setOpenSummary] = React.useState(true);
  const [openForecast, setOpenForecast] = React.useState(true);
  const [openStock, setOpenStock] = React.useState(true);

  // ===== SETTINGS (app_settings) =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

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
      if (prev !== '1' && prev !== '1.0' && prev !== '1.00') return prev;
      return String(units);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSettings.data?.settings?.coin_value_cents, qSettings.data?.settings?.currency]);

  const coinCostCentPerCoin = React.useMemo(() => {
    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor(units * 100);
    return Number.isFinite(cents) ? Math.max(0, cents) : 0;
  }, [coinValueDraft]);

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

  // range sync
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

  // ===== stats/prizes =====
  const qStats = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; items: PrizeStat[] }>(`/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`),
    staleTime: 10_000,
  });
  const items = qStats.data?.items || [];

  // ===== timeseries =====
  const qTs = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: ['wheel_ts', appId, range.from, range.to],
    queryFn: () =>
      apiFetch<{ ok: true; days: WheelTimeseriesDay[]; settings?: AppSettings }>(
        `/api/cabinet/apps/${appId}/wheel/timeseries?${qs(range)}`
      ),
    staleTime: 10_000,
  });

  const currency = String(
    qTs.data?.settings?.currency || qSettings.data?.settings?.currency || currencyDraft || 'RUB'
  ).toUpperCase();

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

  // ===== STOCK draft =====
  type DraftRow = {
    active: boolean;
    track_qty: boolean;
    qty_left: string;
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

  // ===== inventory counters =====
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

    return { trackedCount, outOfStockCount, lowStockCount, lowThreshold };
  }, [items]);

  // ===== forecast (EV/ROI) controls =====
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10');
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');
  const spinCostCoinsForecast = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

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

    for (const p of active) {
      const wRaw = Math.max(0, Number(p.weight) || 0);
      const w = effWeight(p, wRaw);
      const prob = wSum > 0 ? (w / wSum) : 0;

      const kind = normalizeKind(p);
      const coins = normalizeCoins(p);
      const costCoins = kind === 'coins' ? coins : Math.max(0, Number(p.cost_coins ?? 0) || 0);

      evCoinsAcc += prob * costCoins;
    }

    const payoutCoinsIssued = evCoinsAcc;
    const payoutCoinsRedeemed = evCoinsAcc * (fact.redeemRate || 0);
    const payoutCoins = costBasis === 'redeemed' ? payoutCoinsRedeemed : payoutCoinsIssued;

    const profitCoins = spinRevenueCoins - payoutCoins;

    const payoutCentIssued = Math.round(payoutCoinsIssued * coinCostCentPerCoin);
    const payoutCentRedeemed = Math.round(payoutCoinsRedeemed * coinCostCentPerCoin);
    const payoutCent = costBasis === 'redeemed' ? payoutCentRedeemed : payoutCentIssued;

    const profitCent = Math.round(spinRevenueCent - payoutCent);

    const daysN = Math.max(1, listDaysISO(range.from, range.to).length || 1);
    const autoSpd = fact.spins / daysN;
    const manual = Number(String(spinsPerDayDraft || '').replace(',', '.'));
    const spd = Number.isFinite(manual) && manual > 0 ? manual : autoSpd;

    return {
      wSum,
      spinRevenueCoins,
      spinRevenueCent,
      payoutCent,
      profitCent,
      profitCoins,
      spinsPerDay: spd,
      dayProfitCent: Math.round(spd * profitCent),
      dayRevenueCent: Math.round(spd * spinRevenueCent),
      dayPayoutCent: Math.round(spd * payoutCent),
    };
  }, [
    items,
    draft,
    spinCostCoinsForecast,
    coinCostCentPerCoin,
    fact.redeemRate,
    fact.spins,
    range.from,
    range.to,
    spinsPerDayDraft,
    costBasis,
  ]);

  // ===== series (fact) =====
  const moneySeries = React.useMemo(() => {
    const map = new Map<string, WheelTimeseriesDay>();
    for (const r of (qTs.data?.days || [])) if (r?.date) map.set(String(r.date), r);

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

  const top = [...items]
    .sort((a, b) => (Number((b as any)[topMetric]) || 0) - (Number((a as any)[topMetric]) || 0))
    .slice(0, 7);

  const redeemTone: 'good' | 'warn' | 'bad' =
    fact.wins <= 0 ? 'warn' : (fact.redeemRatePct >= 70 ? 'good' : (fact.redeemRatePct >= 40 ? 'warn' : 'bad'));

  const stockSaveState: SgSaveState =
    savingStock ? 'saving'
      : (saveMsg?.startsWith('Сохранено') ? 'saved'
        : (saveMsg?.startsWith('Ошибка') ? 'error' : 'idle'));

  const coinSaveState: SgSaveState =
    savingCoin ? 'saving'
      : (coinMsg === 'Сохранено' ? 'saved'
        : (coinMsg?.startsWith('Ошибка') ? 'error' : 'idle'));

  const customOpen = quick === 'custom';

  return (
    <SgPage
      className="sgp-wheel"
      title="Колесо"
      subtitle={<span>Факт по <b>wheel_spins</b> + прогноз EV/ROI (по весам/себестоимости/цене спина).</span>}
      actions={
        <div className="sgp-rangebar">
          {/* ONE ROW: quick + custom */}
          <div className="sgp-rangebar__row">
            <div className="sgp-seg">
              <SegBtn active={quick === 'day'} onClick={() => pickQuick('day')}>День</SegBtn>
              <SegBtn active={quick === 'week'} onClick={() => pickQuick('week')}>Неделя</SegBtn>
              <SegBtn active={quick === 'month'} onClick={() => pickQuick('month')}>Месяц</SegBtn>
              <SegBtn active={quick === 'custom'} onClick={() => pickQuick('custom')}>Свой</SegBtn>
            </div>

            <div className={customOpen ? 'sgp-rangebar__customWrap is-open' : 'sgp-rangebar__customWrap'}>
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
            <SgCardHeader right={<HealthBadge tone={redeemTone} title={redeemTone.toUpperCase()} />}>
              <div>
                <SgCardTitle>Выдача призов</SgCardTitle>
                <SgCardSub>за выбранный период</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <div className="sgp-kv">
                <div className="sgp-kv__row"><span>Выигрышей</span><b>{fact.wins}</b></div>
                <div className="sgp-kv__row"><span>Выдано</span><b>{fact.redeemed}</b></div>
                <div className="sgp-kv__row"><span>Доля выдачи</span><b>{fact.redeemRatePct}%</b></div>
              </div>

              <div style={{ marginTop: 10 }}>
                {fact.wins <= 0 ? (
                  <Hint tone="warn">Пока нет данных за период.</Hint>
                ) : redeemTone === 'good' ? (
                  <Hint tone="good">Отлично. Призы реально забирают.</Hint>
                ) : redeemTone === 'warn' ? (
                  <Hint tone="warn">Нормально. Можно улучшить “доходимость”: правила выдачи, напоминания, витрина призов.</Hint>
                ) : (
                  <Hint tone="bad">Низкая выдача. Проверь кассира/инструкцию и понятность “как забрать”.</Hint>
                )}
              </div>
            </SgCardContent>
          </SgCard>

          <div style={{ height: 12 }} />

          <SgCard>
            <SgCardHeader>
              <div>
                <SgCardTitle>Топ призов</SgCardTitle>
                <SgCardSub>по {topMetric === 'wins' ? 'выигрышам' : 'выдачам'}</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <div className="sgp-seg" style={{ marginBottom: 10 }}>
                <SegBtn active={topMetric === 'wins'} onClick={() => setTopMetric('wins')}>Выигрыши</SegBtn>
                <SegBtn active={topMetric === 'redeemed'} onClick={() => setTopMetric('redeemed')}>Выдачи</SegBtn>
              </div>

              <div className="sgp-toplist">
                {top.map((p, idx) => {
                  const max = Math.max(1, Number((top[0] as any)?.[topMetric]) || 0);
                  const val = Number((p as any)[topMetric]) || 0;
                  const w = Math.round((val / max) * 100);
                  return (
                    <div key={p.prize_code || idx} className="sgp-toprow">
                      <div className="sgp-toprow__idx">{idx + 1}</div>
                      <div className="sgp-toprow__mid">
                        <div className="sgp-toprow__title">{p.title || p.prize_code}</div>
                        <div className="sgp-toprow__sub">
                          {topMetric === 'wins'
                            ? `выдачи: ${Number(p.redeemed) || 0}`
                            : `выигрыши: ${Number(p.wins) || 0}`}
                        </div>
                        <div className="sgp-toprow__bar">
                          <div className="sgp-toprow__barFill" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                      <div className="sgp-toprow__val">{val}</div>
                    </div>
                  );
                })}
                {!top.length ? <div className="sgp-muted">Пока пусто</div> : null}
              </div>
            </SgCardContent>
          </SgCard>
        </div>
      }
    >
      {/* ===== FACT CHART ===== */}
      <SgCard>
        <SgCardHeader
          right={
            // ONE ROW: (при выигрыше/при выдаче) + R/C/P/Σ
            <div className="sgp-chartbar">
              <div className="sgp-seg">
                <SegBtn active={costBasis === 'issued'} onClick={() => setCostBasis('issued')}>
                  при выигрыше
                </SegBtn>
                <SegBtn active={costBasis === 'redeemed'} onClick={() => setCostBasis('redeemed')}>
                  при выдаче
                </SegBtn>
              </div>

              <div className="sgp-iconGroup">
                <IconBtn active={showRevenue} title="Выручка" onClick={() => setShowRevenue((v) => !v)}>R</IconBtn>
                <IconBtn active={showPayout} title="Расход" onClick={() => setShowPayout((v) => !v)}>C</IconBtn>
                <IconBtn active={showProfitBars} title="Прибыль" onClick={() => setShowProfitBars((v) => !v)}>P</IconBtn>
                <IconBtn active={showCum} title="Кумулятив" onClick={() => setShowCum((v) => !v)}>Σ</IconBtn>
              </div>
            </div>
          }
        >
          <div>
            <SgCardTitle>Факт: выручка / расход / прибыль</SgCardTitle>
            <SgCardSub>{range.from} — {range.to}</SgCardSub>
          </div>
        </SgCardHeader>

        <SgCardContent>
          {!isLoading && !isError ? (
            <div style={{ height: 340 }}>
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

                  {showProfitBars ? <Bar dataKey="profit" name="profit" shape={<ProfitBarShape />} /> : null}
                  {showRevenue ? <Line type="monotone" dataKey="revenue" name="revenue" dot={false} /> : null}
                  {showPayout ? <Line type="monotone" dataKey="payout" name="payout" dot={false} /> : null}
                  {showCum ? <Line type="monotone" dataKey="cum_profit" name="cum_profit" dot={false} /> : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {isLoading ? <div className="sgp-muted">Загрузка…</div> : null}
          {isError ? (
            <Hint tone="bad">
              Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
            </Hint>
          ) : null}
        </SgCardContent>

      </SgCard>

      {/* ===== TABS BAR BETWEEN CARDS ===== */}
<div className="sgp-wheelTabsBar">
  <div className="sgp-seg">
    <SegBtn active={tab === 'summary'} onClick={() => setTab('summary')}>Сводка</SegBtn>
    <SegBtn active={tab === 'forecast'} onClick={() => setTab('forecast')}>Прогноз</SegBtn>
    <SegBtn active={tab === 'stock'} onClick={() => setTab('stock')}>Склад</SegBtn>
  </div>
</div>

      {/* ===== TAB: SUMMARY ===== */}
      {tab === 'summary' ? (
        <SgCard>
          <SgCardHeader
            right={
              <IconBtn active={openSummary} onClick={() => setOpenSummary((v) => !v)} title="Свернуть/развернуть">
                {openSummary ? '—' : '+'}
              </IconBtn>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SgCardTitle>Ключевые метрики</SgCardTitle>
              <HealthBadge
                tone={fact.revenue_cents <= 0 ? 'warn' : (fact.profit_cents >= 0 ? 'good' : 'bad')}
                title={fact.revenue_cents <= 0 ? 'нет данных' : (fact.profit_cents >= 0 ? 'ok' : 'минус')}
              />
            </div>
          </SgCardHeader>

          {openSummary ? (
            <SgCardContent>
              <div className="sgp-metrics">
                <div className="sgp-metric"><div className="sgp-metric__k">СПИНОВ</div><div className="sgp-metric__v">{fact.spins}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">ВЫРУЧКА</div><div className="sgp-metric__v">{moneyFromCent(fact.revenue_cents, currency)}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">РАСХОД</div><div className="sgp-metric__v">{moneyFromCent(fact.payout_cents, currency)}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">ПРИБЫЛЬ</div><div className="sgp-metric__v">{moneyFromCent(fact.profit_cents, currency)}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">ВЫЙГРЫШЕЙ</div><div className="sgp-metric__v">{fact.wins}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">ВЫДАНО</div><div className="sgp-metric__v">{fact.redeemed}</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">ДОЛЯ ВЫДАЧИ</div><div className="sgp-metric__v">{fact.redeemRatePct}%</div></div>
                <div className="sgp-metric"><div className="sgp-metric__k">АКТИВНЫХ ПРИЗОВ</div><div className="sgp-metric__v">{activeCount} / {items.length}</div></div>
              </div>

              <div style={{ marginTop: 12 }}>
                <Hint tone="warn">
                  Подсказка: “Факт” считается по снимкам в <b>wheel_spins</b>, прогноз — по текущим весам/себестоимости.
                </Hint>
              </div>
            </SgCardContent>
          ) : null}
        </SgCard>
      ) : null}

      {/* ===== TAB: FORECAST ===== */}
      {tab === 'forecast' ? (
        <SgCard>
          <SgCardHeader
            right={
              <IconBtn active={openForecast} onClick={() => setOpenForecast((v) => !v)} title="Свернуть/развернуть">
                {openForecast ? '—' : '+'}
              </IconBtn>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SgCardTitle>Прогноз EV/ROI</SgCardTitle>
              <HealthBadge tone={(ev?.profitCent ?? 0) >= 0 ? 'good' : 'bad'} title={(ev?.profitCent ?? 0) >= 0 ? 'плюс' : 'минус'} />
            </div>
          </SgCardHeader>

          {openForecast ? (
            <SgCardContent>
              <div className="sgp-forecast">
                <SgFormRow
                  label="Цена спина (монет)"
                  hint={`Выручка/спин ≈ ${moneyFromCent(spinCostCoinsForecast * coinCostCentPerCoin, currency)}`}
                >
                  <SgInput
                    value={spinCostCoinsDraft}
                    onChange={(e) => setSpinCostCoinsDraft((e.target as any).value)}
                    placeholder="10"
                  />
                </SgFormRow>

                <SgFormRow
                  label="Спинов / день"
                  hint={(() => {
                    const days = Math.max(1, listDaysISO(range.from, range.to).length || 1);
                    const s = fact.spins / days;
                    return `авто: ${Number.isFinite(s) ? s.toFixed(2) : '0.00'} / день`;
                  })()}
                >
                  <SgInput
                    value={spinsPerDayDraft}
                    onChange={(e) => setSpinsPerDayDraft((e.target as any).value)}
                    placeholder="пусто = авто"
                  />
                </SgFormRow>
              </div>

              <div style={{ marginTop: 10 }} className="sgp-forecast__kpi">
                <SgpPill>Выручка/спин: <b>{moneyFromCent(ev.spinRevenueCent, currency)}</b></SgpPill>
                <SgpPill>Расход/спин: <b>{moneyFromCent(ev.payoutCent, currency)}</b></SgpPill>
                <SgpPill>Прибыль/спин: <b>{moneyFromCent(ev.profitCent, currency)}</b></SgpPill>
                <SgpPill>Профит/день: <b>{moneyFromCent(ev.dayProfitCent, currency)}</b></SgpPill>
              </div>

              {coinCostCentPerCoin <= 0 ? (
                <div style={{ marginTop: 12 }}>
                  <Hint tone="warn">
                    Заполни “Стоимость монеты и валюта” — иначе прогноз в деньгах будет неточным.
                  </Hint>
                </div>
              ) : null}
            </SgCardContent>
          ) : null}
        </SgCard>
      ) : null}

      {/* ===== TAB: STOCK ===== */}
      {tab === 'stock' ? (
        <>
          <SgCard>
            <SgCardHeader
              right={
                <IconBtn active={openStock} onClick={() => setOpenStock((v) => !v)} title="Свернуть/развернуть">
                  {openStock ? '—' : '+'}
                </IconBtn>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <SgCardTitle>Склад призов</SgCardTitle>
                <SgpPill>Учёт: <b>{inventory.trackedCount}</b></SgpPill>
                <SgpPill>Закончились: <b>{inventory.outOfStockCount}</b></SgpPill>
                <SgpPill>Мало (≤ {inventory.lowThreshold}): <b>{inventory.lowStockCount}</b></SgpPill>
              </div>
            </SgCardHeader>

            {openStock ? (
              <SgCardContent>
                <div className="sgp-stockHead">
                  <div className="sgp-stockCol sgp-stockCol--name">Название</div>
                  <div className="sgp-stockCol">Активен</div>
                  <div className="sgp-stockCol">Учёт</div>
                  <div className="sgp-stockCol">Остаток</div>
                  <div className="sgp-stockCol">Авто-выкл</div>
                </div>

                <div className="sgp-stockList">
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

                    const tone = !active ? 'off' : (tracked ? (out ? 'out' : (low ? 'low' : 'on')) : 'on');

                    return (
                      <div key={code} className={'sgp-stockRow tone-' + tone}>
                        <div className="sgp-stockCol sgp-stockCol--name">
                          <div className="sgp-stockName">{p.title || code}</div>
                          <div className="sgp-stockSub">
                            {normalizeKind(p) === 'coins' ? `монеты: ${normalizeCoins(p)}` : 'физический'} · код: {code}
                          </div>

                          {out && swz ? <div className="sgp-stockHint is-bad">Закончились — приз не выпадает</div> : null}
                          {!out && low ? <div className="sgp-stockHint is-warn">Скоро закончатся (≤ {inventory.lowThreshold})</div> : null}
                        </div>

                        <div className="sgp-stockCol">
                          <SgToggle
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

                        <div className="sgp-stockCol">
                          <SgToggle
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

                        <div className="sgp-stockCol">
                          <SgInput
                            value={d.qty_left}
                            onChange={(e) => patchDraft(code, { qty_left: (e.target as any).value })}
                            placeholder={tracked ? '0' : '—'}
                            disabled={!tracked}
                          />
                        </div>

                        <div className="sgp-stockCol">
                          <SgToggle
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

                  {!items.length && !qStats.isLoading ? <div className="sgp-muted">Нет призов.</div> : null}
                </div>

                <div style={{ marginTop: 12 }}>
                  {saveMsg ? (
                    <Hint tone={saveMsg.startsWith('Ошибка') ? 'bad' : 'warn'}>{saveMsg}</Hint>
                  ) : (
                    <Hint tone="neutral">Подсказка: если “Учёт остатков” выключен — поля неактивны, это нормально.</Hint>
                  )}
                </div>
              </SgCardContent>
            ) : null}

            <SgCardFooter>
              <SgActions
                primaryLabel="Сохранить склад"
                onPrimary={saveStock}
                state={stockSaveState}
                errorText={saveMsg?.startsWith('Ошибка') ? saveMsg : undefined}
                left={<span className="sgp-muted">Меняется только склад (active/track/qty/auto-off).</span>}
              />
            </SgCardFooter>
          </SgCard>

          <div style={{ height: 12 }} />

          <SgCard>
            <SgCardHeader>
              <div>
                <SgCardTitle>Стоимость монеты и валюта</SgCardTitle>
                <SgCardSub>Нужно для прогноза и оценки себестоимости</SgCardSub>
              </div>
            </SgCardHeader>

            <SgCardContent>
              <SgFormRow
                label={`Стоимость 1 монеты (${currencyLabel(currencyDraft)})`}
                hint={`= ${moneyFromCent(coinCostCentPerCoin, currencyDraft)} / монета`}
              >
                <SgInput
                  value={coinValueDraft}
                  onChange={(e) => setCoinValueDraft((e.target as any).value)}
                  placeholder="1.00"
                />
              </SgFormRow>

              <SgFormRow label="Валюта" hint={qSettings.isError ? 'settings: ошибка' : ''}>
                <SgSelect
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(String((e.target as any).value || 'RUB').toUpperCase())}
                >
                  <option value="RUB">RUB (₽)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </SgSelect>
              </SgFormRow>

              {coinMsg ? <Hint tone={coinMsg.startsWith('Ошибка') ? 'bad' : 'good'}>{coinMsg}</Hint> : null}
            </SgCardContent>

            <SgCardFooter>
              <SgActions
                primaryLabel="Сохранить"
                onPrimary={saveAppSettings}
                state={coinSaveState}
                errorText={coinMsg?.startsWith('Ошибка') ? coinMsg : undefined}
                left={<span className="sgp-muted">Курс монеты используется только в аналитике.</span>}
              />
            </SgCardFooter>
          </SgCard>
        </>
      ) : null}

      {isLoading ? <ShimmerLine /> : null}
    </SgPage>
  );
}
