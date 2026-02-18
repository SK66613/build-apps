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
  cost_cent?: number;     // item cost in cents
  cost_currency?: string;

  track_qty?: number;       // 0|1
  qty_left?: number | null; // number
  stop_when_zero?: number;  // 0|1
};

type WheelTimeseriesDay = {
  date: string; // YYYY-MM-DD

  spins: number;
  spin_cost_coins: number;

  wins: number;
  redeemed: number;

  // FACT money snapshots (cents) from wheel_spins
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
  currency?: string;
};

function qs(obj: Record<string, string | number | undefined | null>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)){
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function toInt(v: any, d = 0){
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
}

function clampN(n: any, min: number, max: number){
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmtPct(x: number | null | undefined, d = '—'){
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function moneyFromCent(cent: number | null | undefined, currency = '₽'){
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';
  // оставляем рубли форматированием как у тебя было
  if (currency.toUpperCase() === 'RUB' || currency === '₽') return `${(v / 100).toFixed(2)} ₽`;
  return `${(v / 100).toFixed(2)} ${currency}`;
}

function daysBetweenISO(fromISO: string, toISO: string){
  try{
    const a = new Date(fromISO + 'T00:00:00Z').getTime();
    const b = new Date(toISO + 'T00:00:00Z').getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    const diff = Math.abs(b - a);
    const days = Math.floor(diff / (24*3600*1000)) + 1;
    return Math.max(1, days);
  }catch(_){
    return 1;
  }
}

function isoAddDays(iso: string, deltaDays: number){
  try{
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + deltaDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }catch(_){
    return iso;
  }
}

function listDaysISO(fromISO: string, toISO: string){
  const out: string[] = [];
  if (!fromISO || !toISO) return out;
  let cur = fromISO;
  for (let i=0; i<400; i++){
    out.push(cur);
    if (cur === toISO) break;
    cur = isoAddDays(cur, 1);
  }
  return out;
}

function fmtDDMM(iso: string){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}`;
}

/* Иконки для кнопок-линий в денежном графике */
function IcoMoney(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 5h10v6H3V5z" stroke="currentColor" strokeWidth="2" opacity="0.9"/>
      <path d="M6 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IcoPay(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
      <path d="M6 3h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}

/**
 * Normalize item cost to cents.
 * Rule:
 *  - if cost_cent exists -> use it
 *  - else if cost <= 1_000_000 -> treat as RUB and *100
 *  - else treat as cents (legacy)
 */
function normalizeCostCent(p: PrizeStat): number {
  const cc = Number((p as any).cost_cent);
  if (Number.isFinite(cc) && cc >= 0) return Math.floor(cc);
  const c = Number((p as any).cost);
  if (!Number.isFinite(c) || c < 0) return 0;
  if (c <= 1_000_000) return Math.floor(c * 100);
  return Math.floor(c);
}

function normalizeCoins(p: PrizeStat): number {
  const v = Number((p as any).coins);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function normalizeKind(p: PrizeStat): 'coins'|'item' {
  const k = String((p as any).kind || '').trim().toLowerCase();
  return k === 'coins' ? 'coins' : 'item';
}

function profitBadge(profitCent: number, revenueCent: number){
  if (revenueCent <= 0) return { text: '—', cls: 'mid' };
  const m = profitCent / revenueCent;
  if (m >= 0.25) return { text: 'ОК', cls: 'ok' };
  if (m >= 0.05) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

function redeemBadge(redeemRatePct: number){
  if (redeemRatePct >= 70) return { text: 'ОК', cls: 'ok' };
  if (redeemRatePct >= 40) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

function isTracked(p: PrizeStat){
  return Number(p.track_qty || 0) ? true : false;
}
function isStopWhenZero(p: PrizeStat){
  return Number(p.stop_when_zero || 0) ? true : false;
}
function qtyLeft(p: PrizeStat){
  const q = (p as any).qty_left;
  const n = Number(q);
  return Number.isFinite(n) ? n : null;
}

export default function Wheel(){
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  const [panel, setPanel] = React.useState<'roi'|'settings'>('roi');
  const [topMetric, setTopMetric] = React.useState<'wins'|'redeemed'>('wins');

  // Finance settings (для EV/ROI и "прогноза")
  const [coinRub, setCoinRub] = React.useState<string>('1');                 // ₽ per coin (PERSIST)
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // local
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');       // local

  // расход считать: при выигрыше или при выдаче (в факте — переключает payout/profit из timeseries)
  const [costBasis, setCostBasis] = React.useState<'issued'|'redeemed'>('issued');

  const coinCostCentPerCoin = Math.max(0, Math.floor(Number(String(coinRub).replace(',', '.')) * 100));
  const spinCostCoins = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

  // Денежный график: кнопки слоёв (залипающие)
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showProfitBars, setShowProfitBars] = React.useState<boolean>(true);

  // Быстрые периоды (в шапке справа)
  const [quick, setQuick] = React.useState<'day'|'week'|'month'|'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // ===== SETTINGS from worker (app_settings) =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

  // применяем в UI только при первом успешном приходе
  React.useEffect(() => {
    const cents = qSettings.data?.settings?.coin_value_cents;
    if (cents === undefined || cents === null) return;

    const rub = Number(cents) / 100;
    if (!Number.isFinite(rub) || rub <= 0) return;

    // если юзер уже менял вручную — не перетираем
    setCoinRub(prev => {
      const prevN = Number(prev);
      if (!Number.isFinite(prevN)) return prev;
      if (Math.floor(prevN * 100) === Math.floor(Number(cents))) return prev;
      if (prev !== '1' && prev !== '1.0' && prev !== '1.00') return prev;
      return String(rub);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSettings.data?.settings?.coin_value_cents]);

  const [savingCoin, setSavingCoin] = React.useState(false);
  const [coinMsg, setCoinMsg] = React.useState<string>('');

  async function saveCoinValue(){
    if (!appId) return;
    setCoinMsg('');

    const rub = Number(String(coinRub).replace(',', '.'));
    const cents = Math.floor(rub * 100);

    if (!Number.isFinite(rub) || rub <= 0 || !Number.isFinite(cents) || cents <= 0){
      setCoinMsg('Введите корректную стоимость монеты.');
      return;
    }

    setSavingCoin(true);
    try{
      await apiFetch(`/api/cabinet/apps/${appId}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          settings: { coin_value_cents: cents, currency: 'RUB' }
        }),
      });

      setCoinMsg('Сохранено');
      await qc.invalidateQueries({ queryKey: ['app_settings', appId] });
    }catch(e: any){
      setCoinMsg('Ошибка: ' + String(e?.message || e));
    }finally{
      setSavingCoin(false);
    }
  }

  React.useEffect(() => {
    setCustomFrom(range?.from || '');
    setCustomTo(range?.to || '');
    setQuick('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);

  function applyRange(nextFrom: string, nextTo: string){
    if (!nextFrom || !nextTo) return;
    if (typeof setRange === 'function'){
      setRange({ from: nextFrom, to: nextTo });
    }
  }

  function pickQuick(kind: 'day'|'week'|'month'|'custom'){
    setQuick(kind);
    if (kind === 'custom') return;

    const anchor = range?.to || new Date().toISOString().slice(0,10);
    if (kind === 'day'){
      applyRange(anchor, anchor);
      return;
    }
    if (kind === 'week'){
      applyRange(isoAddDays(anchor, -6), anchor);
      return;
    }
    if (kind === 'month'){
      applyRange(isoAddDays(anchor, -29), anchor);
      return;
    }
  }

  // ===== prizes stats (by prize) =====
  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(
      `/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const items = qStats.data?.items || [];

  // ===== timeseries (daily) =====
  const qTs = useQuery({
    enabled: !!appId,
    queryKey: ['wheel_ts', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; days: WheelTimeseriesDay[]; settings?: AppSettings }>(
      `/api/cabinet/apps/${appId}/wheel/timeseries?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const currency = String(qTs.data?.settings?.currency || qSettings.data?.settings?.currency || 'RUB');

  // ===== FACT totals (ONLY from timeseries = wheel_spins history) =====
  const fact = React.useMemo(() => {
    const days = qTs.data?.days || [];
    const spins = days.reduce((s, d) => s + (Number(d.spins) || 0), 0);
    const wins = days.reduce((s, d) => s + (Number(d.wins) || 0), 0);
    const redeemed = days.reduce((s, d) => s + (Number(d.redeemed) || 0), 0);

    const revenue = days.reduce((s, d) => s + (Number(d.revenue_cents) || 0), 0);

    const payoutIssued = days.reduce((s, d) => s + (Number(d.payout_issued_cents) || 0), 0);
    const payoutRedeemed = days.reduce((s, d) => s + (Number(d.payout_redeemed_cents) || 0), 0);

    const payout = (costBasis === 'redeemed') ? payoutRedeemed : payoutIssued;

    const profitIssued = days.reduce((s, d) => s + (Number(d.profit_issued_cents) || 0), 0);
    const profitRedeemed = days.reduce((s, d) => s + (Number(d.profit_redeemed_cents) || 0), 0);
    const profit = (costBasis === 'redeemed') ? profitRedeemed : profitIssued;

    const redeemRate = wins > 0 ? Math.max(0, Math.min(1, redeemed / wins)) : 0;

    return {
      spins, wins, redeemed,
      revenue,
      payout,
      profit,
      redeemRate,
      redeemRatePct: wins > 0 ? Math.round(redeemRate * 100) : 0,
    };
  }, [qTs.data?.days, costBasis]);

  // Top prizes (таблица из stats)
  const top = [...items]
    .sort((a,b) => (Number((b as any)[topMetric])||0) - (Number((a as any)[topMetric])||0))
    .slice(0, 7);

  // Settings form draft (weight/active)
  const [draft, setDraft] = React.useState<Record<string, { weight: string; active: boolean }>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string>('');

  React.useEffect(() => {
    if (!items.length) return;
    setDraft(prev => {
      const next = { ...prev };
      for (const p of items){
        const key = p.prize_code;
        if (!key) continue;
        if (next[key] === undefined){
          next[key] = {
            weight: (p.weight ?? '') === null || (p.weight ?? '') === undefined ? '' : String(p.weight),
            active: !!p.active,
          };
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qStats.data?.items]);

  function setWeight(code: string, v: string){
    setDraft(d => ({ ...d, [code]: { weight: v, active: !!d[code]?.active } }));
  }
  function toggleActive(code: string){
    setDraft(d => ({ ...d, [code]: { weight: d[code]?.weight ?? '', active: !d[code]?.active } }));
  }

  async function save(){
    if (!appId) return;
    setSaveMsg('');

    const payloadItems = items
      .map((p) => {
        const code = p.prize_code;
        const d = draft[code];
        if (!d) return null;

        const weight = clampN(toInt(d.weight, 0), 0, 1_000_000);
        const active = d.active ? 1 : 0;

        return { prize_code: code, weight, active };
      })
      .filter(Boolean) as Array<{ prize_code: string; weight: number; active: 0 | 1 }>;

    if (!payloadItems.length){
      setSaveMsg('Нечего сохранять.');
      return;
    }

    setSaving(true);
    try{
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
    }catch(e: any){
      setSaveMsg('Ошибка сохранения: ' + String(e?.message || e));
    }finally{
      setSaving(false);
    }
  }

  // ===== PROGNOSIS EV/ROI (current config; НЕ влияет на факт) =====
  const ev = React.useMemo(() => {
    const active = items.filter(p => (Number(p.active) || 0) ? true : false);
    const wSum = active.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);

    const spinRevenueCent = spinCostCoins * coinCostCentPerCoin;

    let coinsEvAcc = 0;
    let itemEvAcc = 0;

    const perPrize = active.map((p) => {
      const w = Math.max(0, Number(p.weight) || 0);
      const prob = wSum > 0 ? (w / wSum) : 0;

      const kind = normalizeKind(p);
      const coins = normalizeCoins(p);

      const costCent =
        kind === 'coins'
          ? coins * coinCostCentPerCoin
          : normalizeCostCent(p);

      const expCent = prob * costCent;

      if (kind === 'coins') coinsEvAcc += expCent;
      else itemEvAcc += expCent;

      const hasCost = kind === 'coins' ? true : (normalizeCostCent(p) > 0);

      return {
        prize_code: p.prize_code,
        title: p.title || p.prize_code,
        weight: w,
        prob,
        kind,
        coins,
        costCent,
        expCent,
        hasCost,
      };
    });

    const coinsEvCent = Math.round(coinsEvAcc);
    const itemEvCent = Math.round(itemEvAcc);

    // для прогноза долю выдачи берём из факта (wheel_spins), чтобы было реалистичнее
    const redeemRate = fact.redeemRate;

    const payoutCentIssued = coinsEvCent + itemEvCent;
    const payoutCentRedeemed = coinsEvCent + Math.round(itemEvCent * redeemRate);

    const payoutCent = (costBasis === 'redeemed') ? payoutCentRedeemed : payoutCentIssued;

    const profitCent = Math.round(spinRevenueCent - payoutCent);
    const roi = spinRevenueCent > 0 ? (profitCent / spinRevenueCent) : null;

    const breakEvenSpins = profitCent > 0 ? Math.ceil(payoutCent / profitCent) : null;

    const riskRows = [...perPrize].sort((a, b) => (b.expCent - a.expCent));
    const costCoverage = perPrize.length
      ? Math.round((perPrize.filter(x => x.hasCost).length / perPrize.length) * 100)
      : 0;

    return {
      wSum,
      spinRevenueCent,
      coinsEvCent,
      itemEvCent,
      payoutCentIssued,
      payoutCentRedeemed,
      payoutCent,
      profitCent,
      roi,
      breakEvenSpins,
      perPrize,
      riskRows,
      costCoverage,
    };
  }, [
    items,
    spinCostCoins,
    coinCostCentPerCoin,
    fact.redeemRate,
    costBasis,
  ]);

  // ===== FACT period (from wheel_spins) =====
  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const spins = fact.spins;
    const revenue = fact.revenue;
    const payout = fact.payout;
    const profit = fact.profit;
    const spinsPerDay = days > 0 ? (spins / days) : 0;
    return { days, spins, revenue, payout, profit, spinsPerDay };
  }, [range.from, range.to, fact.spins, fact.revenue, fact.payout, fact.profit]);

  const profitTag = React.useMemo(() => profitBadge(period.profit, Math.max(0, period.revenue)), [period.profit, period.revenue]);
  const redeemTag = React.useMemo(() => redeemBadge(fact.redeemRatePct), [fact.redeemRatePct]);

  const activeCount = items.filter(i => (Number(i.active)||0) ? true : false).length;

  // ===== ОСТАТКИ / ИНВЕНТАРЬ =====
  const inventory = React.useMemo(() => {
    const tracked = items.filter(p => isTracked(p));
    const trackedCount = tracked.length;

    const outOfStock = tracked.filter(p => {
      const q = qtyLeft(p);
      return q !== null && q <= 0;
    });
    const outOfStockCount = outOfStock.length;

    const lowThreshold = 3;
    const lowStock = tracked.filter(p => {
      const q = qtyLeft(p);
      return q !== null && q > 0 && q <= lowThreshold;
    });
    const lowStockCount = lowStock.length;

    const autoOff = tracked.filter(p => isStopWhenZero(p) && (() => {
      const q = qtyLeft(p);
      return q !== null && q <= 0;
    })());
    const autoOffCount = autoOff.length;

    const risky = [...tracked]
      .filter(p => {
        const q = qtyLeft(p);
        return q !== null && q <= lowThreshold;
      })
      .sort((a,b) => (Number(b.wins)||0) - (Number(a.wins)||0))
      .slice(0, 3);

    return {
      trackedCount,
      outOfStockCount,
      lowStockCount,
      autoOffCount,
      lowThreshold,
      risky,
    };
  }, [items]);

  // ===== MONEY SERIES (FACT DAYS from wheel_spins) =====
  const moneySeries = React.useMemo(() => {
    const map = new Map<string, WheelTimeseriesDay>();
    for (const r of (qTs.data?.days || [])){
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

  const breakEvenLabel = React.useMemo(() => {
    if (ev.breakEvenSpins === null) return 'не окупается';
    return `${ev.breakEvenSpins} спинов`;
  }, [ev.breakEvenSpins]);

  const topRisk = ev.riskRows?.[0] || null;

  // FACT average profit/spin for forecast
  const profitPerSpinFact = React.useMemo(() => {
    if (period.spins <= 0) return 0;
    return Math.round(period.profit / Math.max(1, period.spins));
  }, [period.profit, period.spins]);

  const profitPerDay = React.useMemo(() => {
    const manual = Number(spinsPerDayDraft);
    const days = Math.max(1, period.days);

    const spinsPerDay =
      (Number.isFinite(manual) && manual >= 0)
        ? manual
        : (period.spins > 0 ? (period.spins / days) : 0);

    const raw = spinsPerDay * profitPerSpinFact;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [spinsPerDayDraft, period.days, period.spins, profitPerSpinFact]);

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">Факт по спинам (wheel_spins) + прогноз EV/ROI.</div>
        </div>

        {/* Быстрые периоды справа */}
        <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap: 10, flexWrap:'wrap' }}>
          <div className="sg-tabs wheelMiniTabs">
            <button type="button" className={'sg-tab ' + (quick==='day' ? 'is-active' : '')} onClick={() => pickQuick('day')}>
              День
            </button>
            <button type="button" className={'sg-tab ' + (quick==='week' ? 'is-active' : '')} onClick={() => pickQuick('week')}>
              Неделя
            </button>
            <button type="button" className={'sg-tab ' + (quick==='month' ? 'is-active' : '')} onClick={() => pickQuick('month')}>
              Месяц
            </button>
            <button type="button" className={'sg-tab ' + (quick==='custom' ? 'is-active' : '')} onClick={() => pickQuick('custom')}>
              Свой период
            </button>
          </div>

          {quick === 'custom' && (
            <div className="sg-pill" style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
              <span className="sg-muted">от</span>
              <Input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} style={{ width: 150 }} />
              <span className="sg-muted">до</span>
              <Input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} style={{ width: 150 }} />
              <Button
                variant="primary"
                onClick={() => applyRange(customFrom, customTo)}
                disabled={!customFrom || !customTo}
              >
                Применить
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">

          {/* ====== ДЕНЬГИ (ФАКТ) ====== */}
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Факт: выручка / расход / прибыль</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="wheelChartBtns" role="tablist" aria-label="Слои графика">
                <button
                  type="button"
                  className={'wheelChartBtn ' + (showRevenue ? 'is-active' : '')}
                  onClick={() => setShowRevenue(v => !v)}
                  title="Выручка"
                  aria-label="Выручка"
                ><IcoMoney/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showPayout ? 'is-active' : '')}
                  onClick={() => setShowPayout(v => !v)}
                  title="Расход"
                  aria-label="Расход"
                ><IcoPay/></button>

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
              {(qStats.isLoading || qTs.isLoading) && <div className="sg-muted">Загрузка…</div>}
              {(qStats.isError || qTs.isError) && (
                <div className="sg-muted">
                  Ошибка: {String((qStats.error as any)?.message || (qTs.error as any)?.message || 'UNKNOWN')}
                </div>
              )}

              {!qStats.isLoading && !qTs.isLoading && !qStats.isError && !qTs.isError && (
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
                        return String(Math.round(n / 100)); // рубли
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

            <div className="wheelKpiRow">
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Спинов (за период)</div>
                <div className="wheelKpiVal">{period.spins}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Прибыль/день (прогноз)</div>
                <div className="wheelKpiVal">{moneyFromCent(profitPerDay, currency)}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Призы с учётом остатков</div>
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

            <div style={{ marginTop: 12, display:'flex', alignItems:'center', gap: 12, flexWrap:'wrap' }}>
              <div className="sg-muted" style={{ fontWeight: 900 }}>Расход считать (ФАКТ):</div>

              <div className="sg-tabs wheelMiniTabs">
                <button
                  type="button"
                  className={'sg-tab ' + (costBasis==='issued' ? 'is-active' : '')}
                  onClick={() => setCostBasis('issued')}
                  title="Факт расхода считаем в момент выигрыша"
                >
                  при выигрыше
                </button>
                <button
                  type="button"
                  className={'sg-tab ' + (costBasis==='redeemed' ? 'is-active' : '')}
                  onClick={() => setCostBasis('redeemed')}
                  title="Факт расхода считаем по факту выдачи"
                >
                  при выдаче
                </button>
              </div>

              <div className="sg-pill" style={{ padding:'8px 12px' }}>
                <span className="sg-muted">Доля выдачи: </span>
                <b>{fmtPct(fact.redeemRate, '—')}</b>
              </div>
            </div>

            <div className="wheelUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='roi' ? 'is-active' : '')} onClick={() => setPanel('roi')}>
                  Прогноз: окупаемость и экономика
                </button>
                <button className={'sg-tab ' + (panel==='settings' ? 'is-active' : '')} onClick={() => setPanel('settings')}>
                  Настройки
                </button>
              </div>

              {panel === 'roi' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Прогноз (по текущим настройкам)</div>
                      <div className="wheelCardSub">
                        Это НЕ история. История — выше (wheel_spins).
                      </div>
                    </div>
                  </div>

                  <div className="wheelSummaryPro" style={{ paddingTop: 0 }}>
                    <div className="wheelSummaryTiles">
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Выручка за 1 спин (прогноз)</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.spinRevenueCent, currency)}</div>
                      </div>
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Ожидаемый расход (EV)</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.payoutCent, currency)}</div>
                      </div>
                      <div className="wheelSumTile is-strong">
                        <div className="wheelSumLbl">Ожидаемая прибыль (EV)</div>
                        <div className="wheelSumVal">{moneyFromCent(ev.profitCent, currency)}</div>
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

                    {topRisk ? (
                      <div className="sg-pill" style={{ padding:'10px 12px', marginTop: 10 }}>
                        <span className="sg-muted">Главный риск по EV: </span>
                        <b>{topRisk.title}</b>
                        <span className="sg-muted"> · вклад EV: </span>
                        <b>{moneyFromCent(Math.round(topRisk.expCent), currency)}</b>
                      </div>
                    ) : null}

                    {inventory.risky.length ? (
                      <div className="sg-pill" style={{ padding:'10px 12px', marginTop: 10 }}>
                        <span className="sg-muted">Риск по остаткам (топ): </span>
                        <b>{inventory.risky.map(x => x.title || x.prize_code).join(', ')}</b>
                      </div>
                    ) : null}

                    <div className="sg-muted" style={{ marginTop: 12 }}>
                      Покрытие себестоимости (у приза указан cost): <b>{ev.costCoverage}%</b>.
                    </div>
                  </div>
                </div>
              )}

              {panel === 'settings' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Настройки</div>
                      <div className="wheelCardSub">
                        Вес/активность — сохраняем в воркер. “Стоимость монеты” — в app_settings.
                        <br/>
                        Экономика EV/ROI ниже — прогноз (локально), история не меняется.
                      </div>
                    </div>

                    <div className="wheelSave">
                      {saveMsg && <div className="wheelSaveMsg">{saveMsg}</div>}
                      <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={save}>
                        {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                      </Button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Стоимость 1 монеты (₽)</div>
                      <Input value={coinRub} onChange={(e: any) => setCoinRub(e.target.value)} placeholder="1" />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        = {moneyFromCent(coinCostCentPerCoin, currency)} / монета
                      </div>

                      <div style={{ marginTop: 10, display:'flex', gap: 10, alignItems:'center', flexWrap:'wrap' }}>
                        <Button variant="primary" onClick={saveCoinValue} disabled={savingCoin || !appId}>
                          {savingCoin ? 'Сохраняю…' : 'Сохранить стоимость монеты'}
                        </Button>
                        {coinMsg ? <span className="sg-muted">{coinMsg}</span> : null}
                        {qSettings.isError ? <span className="sg-muted">settings: ошибка</span> : null}
                      </div>
                    </div>

                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Цена спина (монет) — прогноз</div>
                      <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        Выручка/спин (прогноз) = {moneyFromCent(spinCostCoins * coinCostCentPerCoin, currency)}
                      </div>
                    </div>

                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Спинов/день (для прогноза)</div>
                      <Input
                        value={spinsPerDayDraft}
                        onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                        placeholder="пусто = авто"
                      />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        авто: {period.days > 0 ? (period.spins / Math.max(1, period.days)).toFixed(2) : '0.00'} / день
                      </div>
                    </div>
                  </div>

                  <div className="wheelTableWrap" style={{ marginTop: 12 }}>
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>Код</th>
                          <th>Название</th>
                          <th>Выигрыши</th>
                          <th>Выдачи</th>
                          <th style={{ minWidth: 220 }}>Остаток</th>
                          <th style={{ minWidth: 220 }}>Вес</th>
                          <th style={{ minWidth: 120 }}>Активен</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };

                          const tracked = isTracked(p);
                          const q = qtyLeft(p);
                          const swz = isStopWhenZero(p);
                          const out = tracked && (q !== null && q <= 0);
                          const low = tracked && (q !== null && q > 0 && q <= inventory.lowThreshold);

                          return (
                            <tr key={p.prize_code}>
                              <td><b>{p.prize_code}</b></td>
                              <td>{p.title}</td>
                              <td>{p.wins}</td>
                              <td>{p.redeemed}</td>

                              <td>
                                {tracked ? (
                                  <div style={{ display:'flex', alignItems:'center', gap: 10, flexWrap:'wrap' }}>
                                    <span style={{ fontWeight: 900 }}>
                                      {q === null ? '—' : q}
                                    </span>
                                    <span className="sg-muted">
                                      {swz ? '· авто-выкл при нуле' : '· без авто-выкл'}
                                    </span>
                                    {out ? <span className="sg-pill" style={{ padding:'6px 10px' }}><b>ноль</b></span> : null}
                                    {low ? <span className="sg-pill" style={{ padding:'6px 10px' }}><b>мало</b></span> : null}
                                  </div>
                                ) : (
                                  <span className="sg-muted">не учитываем</span>
                                )}
                              </td>

                              <td>
                                <Input
                                  value={d.weight}
                                  onChange={(e: any) => setWeight(p.prize_code, e.target.value)}
                                  placeholder="weight"
                                />
                              </td>

                              <td>
                                <label style={{ display:'flex', alignItems:'center', gap: 10 }}>
                                  <input
                                    type="checkbox"
                                    checked={!!d.active}
                                    onChange={() => toggleActive(p.prize_code)}
                                  />
                                  <span style={{ fontWeight: 800 }}>{d.active ? 'вкл' : 'выкл'}</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                        {!items.length && !qStats.isLoading && (
                          <tr><td colSpan={7} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="sg-muted" style={{ marginTop: 12 }}>
                    Подсказка: если приз учитывает остатки и включён “авто-выкл при нуле”, то при qty_left=0 он фактически перестаёт выпадать в мини-аппе.
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Сводка (ФАКТ)</div>
            </div>

            <div className="wheelSummaryPro">
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
                  <div className="wheelSumLbl" style={{ display:'flex', alignItems:'center', gap: 8 }}>
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

              <div className="wheelRedeemBar" style={{ marginTop: 12 }}>
                <div className="wheelRedeemTop">
                  <div className="wheelRedeemName">Выдача призов</div>
                  <div className={"wheelRedeemBadge " + redeemTag.cls}>
                    {redeemTag.text}
                  </div>
                </div>

                <div className="wheelBarTrack" aria-hidden="true">
                  <div className="wheelBarFill" style={{ width: `${Math.max(0, Math.min(100, fact.redeemRatePct))}%` }} />
                </div>

                <div className="wheelRedeemMeta">
                  <span className="sg-muted">Выигрышей: <b>{fact.wins}</b></span>
                  <span className="sg-muted">Выдано: <b>{fact.redeemed}</b></span>
                </div>
              </div>

              {topRisk ? (
                <div className="sg-pill" style={{ padding:'10px 12px', marginTop: 12 }}>
                  <span className="sg-muted">Главный риск по EV: </span>
                  <b>{topRisk.title}</b>
                  <span className="sg-muted"> · вклад EV: </span>
                  <b>{moneyFromCent(Math.round(topRisk.expCent), currency)}</b>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="wheelCard wheelStickyTop">
            <div className="wheelCardHead wheelTopHead">
              <div className="wheelCardTitle">Топ призов</div>

              <div className="sg-tabs wheelMiniTabs">
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='wins' ? 'is-active' : '')}
                  onClick={() => setTopMetric('wins')}
                >
                  Выигрыши
                </button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='redeemed' ? 'is-active' : '')}
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
                    <div className={"wheelTopMedal m" + (idx+1)}>{idx+1}</div>

                    <div className="wheelTopMid">
                      <div className="wheelTopTitle">{p.title}</div>

                      <div className="wheelTopMini">
                        {topMetric === 'wins'
                          ? `выдачи: ${Number(p.redeemed)||0}`
                          : `выигрыши: ${Number(p.wins)||0}`
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
