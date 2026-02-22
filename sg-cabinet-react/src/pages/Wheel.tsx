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
  coins?: number;

  cost_coins?: number; // item cost in coins (structure)

  // legacy (may be present)
  cost_cent?: number;
  cost_currency?: string;

  // live inventory
  track_qty?: number; // 0|1
  qty_left?: number | null;
  stop_when_zero?: number; // 0|1
};

type WheelTimeseriesDay = {
  date: string; // YYYY-MM-DD
  spins: number;
  wins: number;
  redeemed: number;

  revenue_coins: number;
  payout_issued_coins: number;
  payout_redeemed_coins: number;
  profit_issued_coins: number;
  profit_redeemed_coins: number;
  cum_profit_issued_coins?: number;
  cum_profit_redeemed_coins?: number;

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
  currency?: string; // 'RUB' | 'USD' | ...
};

type WheelStructurePrize = {
  code: string;
  title?: string;
  kind?: 'coins' | 'item';
  coins?: number;
  weight?: number;
  cost_coins?: number;
};

type WheelStructure = {
  spin_cost?: number;
  prizes?: WheelStructurePrize[];
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

function moneyFromCent(cent: number | null | undefined, currency = 'RUB') {
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';

  const cur = String(currency || 'RUB').toUpperCase();
  const sign =
    cur === 'RUB' ? '₽' :
    cur === 'USD' ? '$' :
    cur === 'EUR' ? '€' :
    cur === 'GBP' ? '£' :
    cur;

  // format: "12.34 $"
  if (sign.length === 1) return `${(v / 100).toFixed(2)} ${sign}`;
  return `${(v / 100).toFixed(2)} ${cur}`;
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

function normalizeCostCoins(p: PrizeStat): number {
  const kind = normalizeKind(p);
  if (kind === 'coins') return normalizeCoins(p);

  const cc = Number((p as any).cost_coins);
  if (Number.isFinite(cc) && cc >= 0) return Math.floor(cc);
  return 0;
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

function effWeightLikeRuntime(p: PrizeStat, w: number) {
  const tracked = isTracked(p);
  const swz = isStopWhenZero(p);
  const q = qtyLeft(p);
  if (tracked && swz && q !== null && q <= 0) return 0;
  return Math.max(0, w);
}

function safeCurrencyCode(v: any) {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return 'RUB';
  // allow 3-letter or common symbols as fallback
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (s === '₽') return 'RUB';
  if (s === '$') return 'USD';
  if (s === '€') return 'EUR';
  return s.slice(0, 8);
}

export default function Wheel() {
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  // ========= Tabs =========
  const [tab, setTab] = React.useState<'summary' | 'forecast' | 'stock'>('summary');

  // ===== cost basis toggle affects FACT payouts/profit
  const [costBasis, setCostBasis] = React.useState<'issued' | 'redeemed'>('issued');

  // Денежный график: кнопки слоёв
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showProfitBars, setShowProfitBars] = React.useState<boolean>(true);

  // Быстрые периоды
  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

  // ===== SETTINGS from worker (app_settings) =====
  const qSettings = useQuery({
    enabled: !!appId,
    queryKey: ['app_settings', appId],
    queryFn: () => apiFetch<{ ok: true; settings: AppSettings }>(`/api/cabinet/apps/${appId}/settings`),
    staleTime: 30_000,
  });

  const currency = safeCurrencyCode(
    qSettings.data?.settings?.currency || 'RUB'
  );

  // ---- coin value editor (stock tab) ----
  const [coinValueDraft, setCoinValueDraft] = React.useState<string>('1'); // in money units per coin
  const [currencyDraft, setCurrencyDraft] = React.useState<string>(currency);

  React.useEffect(() => {
    // init currency draft from settings
    setCurrencyDraft(currency);
  }, [currency]);

  React.useEffect(() => {
    const cents = qSettings.data?.settings?.coin_value_cents;
    if (cents === undefined || cents === null) return;

    const val = Number(cents) / 100;
    if (!Number.isFinite(val) || val <= 0) return;

    // Only auto-fill if still default-ish
    setCoinValueDraft((prev) => {
      const p = Number(String(prev).replace(',', '.'));
      if (!Number.isFinite(p)) return prev;
      const prevIsDefault = prev === '1' || prev === '1.0' || prev === '1.00';
      const same = Math.floor(p * 100) === Math.floor(Number(cents));
      if (same) return prev;
      if (!prevIsDefault) return prev;
      return String(val);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSettings.data?.settings?.coin_value_cents]);

  const coinValueCents = React.useMemo(() => {
    const v = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor(v * 100);
    if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(cents) || cents <= 0) return 0;
    return cents;
  }, [coinValueDraft]);

  const [savingCoin, setSavingCoin] = React.useState(false);
  const [coinMsg, setCoinMsg] = React.useState<string>('');

  async function saveCoinSettings() {
    if (!appId) return;
    setCoinMsg('');

    const cur = safeCurrencyCode(currencyDraft);
    const cents = coinValueCents;

    if (!cents) {
      setCoinMsg('Введите корректную стоимость 1 монеты.');
      return;
    }
    if (!cur) {
      setCoinMsg('Выберите валюту.');
      return;
    }

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
      await qc.invalidateQueries({ queryKey: ['wheel_ts', appId] }); // UI uses currency
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
    if (typeof setRange === 'function') {
      setRange({ from: nextFrom, to: nextTo });
    }
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

  // ===== Optional: structure endpoint to mark "deleted" prizes (present in D1 but not in current blueprint structure)
  const qStruct = useQuery({
    enabled: !!appId,
    queryKey: ['wheel_structure', appId],
    queryFn: async () => {
      // try a couple endpoints, return null if not available
      const tries = [
        `/api/cabinet/apps/${appId}/wheel/structure`,
        `/api/cabinet/apps/${appId}/wheel/config`,
        `/api/cabinet/apps/${appId}/runtime_config`,
      ];

      for (const url of tries) {
        try {
          const r: any = await apiFetch<any>(url);
          // normalize likely shapes
          const wheel: WheelStructure | null =
            r?.wheel ? r.wheel :
            r?.cfg?.wheel ? r.cfg.wheel :
            r?.config?.wheel ? r.config.wheel :
            r?.runtime_config?.wheel ? r.runtime_config.wheel :
            r?.ok && r?.structure ? r.structure :
            null;

          if (wheel && Array.isArray((wheel as any).prizes)) {
            return wheel;
          }
        } catch (_) {
          // ignore and try next
        }
      }
      return null as any;
    },
    staleTime: 60_000,
    retry: false,
  });

  const structCodes = React.useMemo(() => {
    const wheel = qStruct.data as WheelStructure | null;
    const set = new Set<string>();
    if (!wheel || !Array.isArray(wheel.prizes)) return set;
    for (const p of wheel.prizes) {
      const c = String((p as any)?.code || '').trim();
      if (c) set.add(c);
    }
    return set;
  }, [qStruct.data]);

  const hasStructure = structCodes.size > 0;

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

  // ===== MONEY SERIES (FACT DAYS from wheel_spins) =====
  const moneySeries = React.useMemo(() => {
    const map = new Map<string, WheelTimeseriesDay>();
    for (const r of qTs.data?.days || []) {
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

  // ===== INVENTORY draft (only stock knobs) =====
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

  async function saveInventory() {
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

        // qty_left: if empty => don't touch
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

  // ===== FORECAST inputs (tab Forecast) =====
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // forecast only
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>(''); // forecast only

  // ===== FORECAST EV/ROI (uses structure fields; fallback to stats fields if structure unavailable) =====
  const ev = React.useMemo(() => {
    // --- build list of prizes with structure fields (weight/cost_coins/spin_cost)
    const wheel = (qStruct.data as WheelStructure | null) || null;
    const structSpin = wheel?.spin_cost;
    const structPrizes = Array.isArray(wheel?.prizes) ? wheel!.prizes! : [];

    const byCode = new Map<string, WheelStructurePrize>();
    for (const p of structPrizes) {
      const c = String((p as any)?.code || '').trim();
      if (c) byCode.set(c, p);
    }

    // merge with D1 live info (active/track/qty/swz + wins)
    const merged = items.map((p) => {
      const sp = byCode.get(p.prize_code);
      const weight = sp?.weight ?? p.weight ?? 0;
      const kind = (sp?.kind ? String(sp.kind) : String(p.kind || '')).toLowerCase() === 'coins' ? 'coins' : 'item';

      const coins = kind === 'coins'
        ? (Number.isFinite(Number(sp?.coins)) ? Math.max(0, Math.floor(Number(sp?.coins))) : normalizeCoins(p))
        : 0;

      const costCoins = kind === 'coins'
        ? coins
        : (Number.isFinite(Number(sp?.cost_coins)) ? Math.max(0, Math.floor(Number(sp?.cost_coins))) : Math.max(0, normalizeCostCoins(p)));

      return {
        ...p,
        _struct_weight: Math.max(0, Number(weight) || 0),
        _struct_kind: kind as 'coins' | 'item',
        _struct_coins: coins,
        _struct_cost_coins: costCoins,
      };
    });

    const active = merged.filter((p) => (Number(p.active) || 0) ? true : false);

    const wSum = active.reduce((s, p: any) => s + effWeightLikeRuntime(p, Math.max(0, Number(p._struct_weight) || 0)), 0);

    const spinRevenueCoins = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));
    const coinCostCentPerCoin = coinValueCents; // from settings draft
    const spinRevenueCent = spinRevenueCoins * coinCostCentPerCoin;

    let evCoinsAcc = 0;

    const perPrize = active.map((p: any) => {
      const wRaw = Math.max(0, Number(p._struct_weight) || 0);
      const w = effWeightLikeRuntime(p, wRaw);
      const prob = wSum > 0 ? w / wSum : 0;

      const kind = p._struct_kind as 'coins' | 'item';
      const costCoins = Math.max(0, Number(p._struct_cost_coins) || 0);
      const expCoins = prob * costCoins;
      evCoinsAcc += expCoins;

      const tracked = isTracked(p);
      const swz = isStopWhenZero(p);
      const q = qtyLeft(p);
      const disabledByStock = tracked && swz && q !== null && q <= 0;

      const expCent = Math.round(expCoins * coinCostCentPerCoin);

      return {
        prize_code: p.prize_code,
        title: p.title || p.prize_code,
        weight: wRaw,
        eff_weight: w,
        prob,
        kind,
        costCoins,
        expCoins,
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

    const breakEvenSpins = profitCent > 0 ? Math.ceil(payoutCent / profitCent) : null;

    const riskRows = [...perPrize].sort((a, b) => b.expCoins - a.expCoins);

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
      riskRows,
    };
  }, [
    items,
    qStruct.data,
    spinCostCoinsDraft,
    coinValueCents,
    fact.redeemRate,
    costBasis,
  ]);

  const breakEvenLabel = React.useMemo(() => {
    if (ev.breakEvenSpins === null) return 'не окупается';
    return `${ev.breakEvenSpins} спинов`;
  }, [ev.breakEvenSpins]);

  const topRisk = ev.riskRows?.[0] || null;

  // FACT avg profit/spin for forecast (money)
  const profitPerSpinFact = React.useMemo(() => {
    if (period.spins <= 0) return 0;
    return Math.round(period.profit / Math.max(1, period.spins));
  }, [period.profit, period.spins]);

  const profitPerDay = React.useMemo(() => {
    const manual = Number(String(spinsPerDayDraft).replace(',', '.'));
    const days = Math.max(1, period.days);

    const spinsPerDay =
      Number.isFinite(manual) && manual >= 0
        ? manual
        : period.spins > 0
        ? period.spins / days
        : 0;

    const raw = spinsPerDay * profitPerSpinFact;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [spinsPerDayDraft, period.days, period.spins, profitPerSpinFact]);

  // ===== Inventory summary =====
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

    const autoOff = tracked.filter((p) => {
      if (!isStopWhenZero(p)) return false;
      const q = qtyLeft(p);
      return q !== null && q <= 0;
    });
    const autoOffCount = autoOff.length;

    return {
      trackedCount,
      outOfStockCount,
      lowStockCount,
      autoOffCount,
      lowThreshold,
    };
  }, [items]);

  // ===== Deleted filter =====
  const [showDeleted, setShowDeleted] = React.useState<boolean>(false);

  const stockList = React.useMemo(() => {
    const list = [...items].sort((a, b) => String(a.title || a.prize_code).localeCompare(String(b.title || b.prize_code), 'ru'));
    if (!hasStructure) return list; // cannot detect deleted => show all
    if (showDeleted) return list;
    return list.filter((p) => structCodes.has(p.prize_code));
  }, [items, hasStructure, structCodes, showDeleted]);

  // ===== Top prizes (for summary) =====
  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');
  const top = [...items]
    .sort((a, b) => (Number((b as any)[topMetric]) || 0) - (Number((a as any)[topMetric]) || 0))
    .slice(0, 7);

  // ===== Loading/error helpers =====
  const loading = qStats.isLoading || qTs.isLoading;
  const errMsg =
    (qStats.isError && String((qStats.error as any)?.message || 'STATS_ERROR')) ||
    (qTs.isError && String((qTs.error as any)?.message || 'TS_ERROR')) ||
    '';

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">
            Факт по спинам (wheel_spins) + прогноз (структура из конструктора) + склад (live поля wheel_prizes).
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="sg-tabs wheelMiniTabs">
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
            <div className="sg-pill" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="sg-muted">от</span>
              <Input type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} style={{ width: 150 }} />
              <span className="sg-muted">до</span>
              <Input type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} style={{ width: 150 }} />
              <Button variant="primary" onClick={() => applyRange(customFrom, customTo)} disabled={!customFrom || !customTo}>
                Применить
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ===== Main Tabs ===== */}
      <div className="wheelUnderTabs" style={{ marginTop: 10 }}>
        <div className="sg-tabs wheelUnderTabs__seg">
          <button className={'sg-tab ' + (tab === 'summary' ? 'is-active' : '')} onClick={() => setTab('summary')}>
            Сводка (ФАКТ)
          </button>
          <button className={'sg-tab ' + (tab === 'forecast' ? 'is-active' : '')} onClick={() => setTab('forecast')}>
            Прогноз
          </button>
          <button className={'sg-tab ' + (tab === 'stock' ? 'is-active' : '')} onClick={() => setTab('stock')}>
            Склад
          </button>
        </div>
      </div>

      {/* ====== SUMMARY TAB ====== */}
      {tab === 'summary' && (
        <div className="wheelGrid" style={{ marginTop: 12 }}>
          <div className="wheelLeft">
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
                    onClick={() => setShowRevenue((v) => !v)}
                    title="Выручка"
                    aria-label="Выручка"
                  ><IcoMoney /></button>

                  <button
                    type="button"
                    className={'wheelChartBtn ' + (showPayout ? 'is-active' : '')}
                    onClick={() => setShowPayout((v) => !v)}
                    title="Расход"
                    aria-label="Расход"
                  ><IcoPay /></button>

                  <button
                    type="button"
                    className={'wheelChartBtn ' + (showProfitBars ? 'is-active' : '')}
                    onClick={() => setShowProfitBars((v) => !v)}
                    title="Прибыль (столбики)"
                    aria-label="Прибыль"
                  >П</button>
                </div>
              </div>

              <div className={'wheelChart is-area'}>
                {loading && <div className="sg-muted">Загрузка…</div>}
                {!!errMsg && <div className="sg-muted">Ошибка: {errMsg}</div>}

                {!loading && !errMsg && (
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
                          return String(Math.round(n / 100)); // whole currency units
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

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="sg-muted" style={{ fontWeight: 900 }}>Расход считать (ФАКТ):</div>

                <div className="sg-tabs wheelMiniTabs">
                  <button
                    type="button"
                    className={'sg-tab ' + (costBasis === 'issued' ? 'is-active' : '')}
                    onClick={() => setCostBasis('issued')}
                    title="Факт расхода считаем в момент выигрыша (issued)"
                  >
                    при выигрыше
                  </button>
                  <button
                    type="button"
                    className={'sg-tab ' + (costBasis === 'redeemed' ? 'is-active' : '')}
                    onClick={() => setCostBasis('redeemed')}
                    title="Факт расхода считаем по факту выдачи (redeemed)"
                  >
                    при выдаче
                  </button>
                </div>

                <div className="sg-pill" style={{ padding: '8px 12px' }}>
                  <span className="sg-muted">Доля выдачи: </span>
                  <b>{fmtPct(fact.redeemRate, '—')}</b>
                </div>

                {qTs.data?.meta?.used_snapshots === 0 ? (
                  <div className="sg-pill" style={{ padding: '8px 12px' }}>
                    <span className="sg-muted">⚠️ Нет снапшотов в wheel_spins (денежная история может быть неполной)</span>
                  </div>
                ) : null}
              </div>

              <div className="wheelKpiRow" style={{ marginTop: 12 }}>
                <div className="wheelKpi">
                  <div className="wheelKpiLbl">Спинов</div>
                  <div className="wheelKpiVal">{period.spins}</div>
                </div>
                <div className="wheelKpi">
                  <div className="wheelKpiLbl">Выручка</div>
                  <div className="wheelKpiVal">{moneyFromCent(period.revenue, currency)}</div>
                </div>
                <div className="wheelKpi">
                  <div className="wheelKpiLbl">Расход</div>
                  <div className="wheelKpiVal">{moneyFromCent(period.payout, currency)}</div>
                </div>
                <div className="wheelKpi">
                  <div className="wheelKpiLbl">Прибыль</div>
                  <div className="wheelKpiVal">{moneyFromCent(period.profit, currency)}</div>
                </div>
              </div>
            </Card>
          </div>

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

                <div className="wheelRedeemBar" style={{ marginTop: 12 }}>
                  <div className="wheelRedeemTop">
                    <div className="wheelRedeemName">Выдача призов</div>
                    <div className={'wheelRedeemBadge ' + redeemTag.cls}>
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
                  <div className="sg-pill" style={{ padding: '10px 12px', marginTop: 12 }}>
                    <span className="sg-muted">Главный риск по прогнозу: </span>
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
                    <div className={'wheelTopRowPro ' + (idx < 3 ? 'is-top' : '')} key={p.prize_code}>
                      <div className={'wheelTopMedal m' + (idx + 1)}>{idx + 1}</div>

                      <div className="wheelTopMid">
                        <div className="wheelTopTitle">{p.title}</div>

                        <div className="wheelTopMini">
                          {topMetric === 'wins'
                            ? `выдачи: ${Number(p.redeemed) || 0}`
                            : `выигрыши: ${Number(p.wins) || 0}`}
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
      )}

      {/* ====== FORECAST TAB ====== */}
      {tab === 'forecast' && (
        <div style={{ marginTop: 12 }}>
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div>
                <div className="wheelCardTitle">Прогноз: окупаемость и экономика</div>
                <div className="wheelCardSub">
                  Прогноз строится по <b>структуре</b> из конструктора (spin_cost / weight / cost_coins) + по складу (остатки) как фильтр.
                  <br />
                  Факт — это wheel_spins (вкладка “Сводка”).
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div className="sg-muted" style={{ marginBottom: 6 }}>Цена спина (монет) — прогноз</div>
                <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                <div className="sg-muted" style={{ marginTop: 6 }}>
                  Выручка/спин (прогноз) = {moneyFromCent(Math.max(0, toInt(spinCostCoinsDraft, 0)) * coinValueCents, currency)}
                </div>
              </div>

              <div>
                <div className="sg-muted" style={{ marginBottom: 6 }}>Спинов/день (для прогноза)</div>
                <Input value={spinsPerDayDraft} onChange={(e: any) => setSpinsPerDayDraft(e.target.value)} placeholder="пусто = авто" />
                <div className="sg-muted" style={{ marginTop: 6 }}>
                  авто: {period.days > 0 ? (period.spins / Math.max(1, period.days)).toFixed(2) : '0.00'} / день
                </div>
              </div>

              <div>
                <div className="sg-muted" style={{ marginBottom: 6 }}>Стоимость 1 монеты</div>
                <div className="sg-pill" style={{ padding: '10px 12px' }}>
                  <b>{moneyFromCent(coinValueCents, currency)}</b>
                  <span className="sg-muted"> / монета</span>
                </div>
                <div className="sg-muted" style={{ marginTop: 6 }}>
                  Меняется во вкладке “Склад”.
                </div>
              </div>
            </div>

            <div className="wheelSummaryPro" style={{ paddingTop: 12 }}>
              <div className="wheelSummaryTiles">
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Выручка за 1 спин (прогноз)</div>
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

              {topRisk ? (
                <div className="sg-pill" style={{ padding: '10px 12px', marginTop: 10 }}>
                  <span className="sg-muted">Главный риск по EV: </span>
                  <b>{topRisk.title}</b>
                  <span className="sg-muted"> · вклад EV: </span>
                  <b>{moneyFromCent(Math.round(topRisk.expCent), currency)}</b>
                </div>
              ) : null}

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="sg-muted" style={{ fontWeight: 900 }}>База расходов:</div>
                <div className="sg-tabs wheelMiniTabs">
                  <button
                    type="button"
                    className={'sg-tab ' + (costBasis === 'issued' ? 'is-active' : '')}
                    onClick={() => setCostBasis('issued')}
                    title="В прогнозе расходы считаем как при выигрыше"
                  >
                    при выигрыше
                  </button>
                  <button
                    type="button"
                    className={'sg-tab ' + (costBasis === 'redeemed' ? 'is-active' : '')}
                    onClick={() => setCostBasis('redeemed')}
                    title="В прогнозе расходы считаем с учётом доли выдачи"
                  >
                    при выдаче
                  </button>
                </div>

                <div className="sg-pill" style={{ padding: '8px 12px' }}>
                  <span className="sg-muted">Доля выдачи (факт): </span>
                  <b>{fmtPct(fact.redeemRate, '—')}</b>
                </div>
              </div>

              {!hasStructure ? (
                <div className="sg-pill" style={{ padding: '10px 12px', marginTop: 12 }}>
                  <span className="sg-muted">
                    ⚠️ Не удалось загрузить структуру колеса из конструктора (endpoint отсутствует).
                    Прогноз использует поля из stats, если они есть.
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      )}

      {/* ====== STOCK TAB ====== */}
      {tab === 'stock' && (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {/* Coin settings */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div>
                <div className="wheelCardTitle">Стоимость монеты и валюта</div>
                <div className="wheelCardSub">Пишем в <b>app_settings</b>. Используется для отображения денег и денежной истории новых спинов.</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={saveCoinSettings} disabled={savingCoin || !appId}>
                  {savingCoin ? 'Сохраняю…' : 'Сохранить'}
                </Button>
                {coinMsg ? <span className="sg-muted">{coinMsg}</span> : null}
                {qSettings.isError ? <span className="sg-muted">settings: ошибка</span> : null}
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="sg-muted" style={{ marginBottom: 6 }}>Стоимость 1 монеты</div>
                <Input value={coinValueDraft} onChange={(e: any) => setCoinValueDraft(e.target.value)} placeholder="1.00" />
                <div className="sg-muted" style={{ marginTop: 6 }}>
                  = {moneyFromCent(coinValueCents, currencyDraft)} / монета
                </div>
              </div>

              <div>
                <div className="sg-muted" style={{ marginBottom: 6 }}>Валюта</div>
                <select
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 12,
                    padding: '0 10px',
                    border: '1px solid rgba(15,23,42,.14)',
                    background: 'var(--card, #fff)',
                    color: 'inherit',
                  }}
                >
                  <option value="RUB">RUB (₽)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <div className="sg-muted" style={{ marginTop: 6 }}>
                  Пример: USD + 0.10 = 10 центов за монету (coin_value_cents=10).
                </div>
              </div>
            </div>
          </Card>

          {/* Inventory header */}
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Склад призов (live)</div>
                <div className="wheelCardSub">
                  Тут правим только: <b>Активен</b> / <b>Учёт остатков</b> / <b>Остаток</b> / <b>Авто-выкл при 0</b>.
                  <br />
                  Вес/себестоимость/цену спина меняем в конструкторе и через publish.
                </div>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {hasStructure ? (
                  <label className="sg-pill" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={showDeleted} onChange={() => setShowDeleted((v) => !v)} />
                    <span style={{ fontWeight: 800 }}>{showDeleted ? 'показываю удалённые' : 'скрываю удалённые'}</span>
                  </label>
                ) : (
                  <div className="sg-pill" style={{ padding: '8px 12px' }}>
                    <span className="sg-muted">Удалённые: недоступно (нет structure endpoint)</span>
                  </div>
                )}

                <div className="wheelSave" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {saveMsg && <div className="wheelSaveMsg">{saveMsg}</div>}
                  <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={saveInventory}>
                    {saving ? 'Сохраняю…' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="wheelKpiRow" style={{ marginTop: 12 }}>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">С учётом остатков</div>
                <div className="wheelKpiVal">{inventory.trackedCount}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Закончились</div>
                <div className="wheelKpiVal">{inventory.outOfStockCount}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Мало (≤ {inventory.lowThreshold})</div>
                <div className="wheelKpiVal">{inventory.lowStockCount}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Авто-выкл при 0</div>
                <div className="wheelKpiVal">{inventory.autoOffCount}</div>
              </div>
            </div>

            {/* Cards list */}
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {qStats.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qStats.isError && <div className="sg-muted">Ошибка: {String((qStats.error as any)?.message || 'UNKNOWN')}</div>}

              {!qStats.isLoading && !qStats.isError && !stockList.length && (
                <div className="sg-muted" style={{ padding: 14 }}>Нет призов.</div>
              )}

              {!qStats.isLoading && !qStats.isError && stockList.map((p) => {
                const code = p.prize_code;
                const d = draft[code] || {
                  active: !!p.active,
                  track_qty: !!p.track_qty,
                  qty_left: p.qty_left === null || p.qty_left === undefined ? '' : String(p.qty_left),
                  stop_when_zero: !!p.stop_when_zero,
                };

                const kind = normalizeKind(p);
                const isCoinsPrize = kind === 'coins';

                const tracked = !!d.track_qty;
                const qRaw = String(d.qty_left ?? '').trim();
                const qNum = qRaw === '' ? qtyLeft(p) : Math.max(0, toInt(qRaw, 0));
                const swz = !!d.stop_when_zero;

                const out = tracked && (qNum !== null && qNum <= 0);
                const low = tracked && (qNum !== null && qNum > 0 && qNum <= inventory.lowThreshold);

                const deleted = hasStructure ? (!structCodes.has(code)) : false;

                return (
                  <div
                    key={code}
                    className="sg-pill"
                    style={{
                      padding: '12px 12px',
                      borderRadius: 16,
                      border: deleted ? '1px dashed rgba(239,68,68,.35)' : '1px solid rgba(15,23,42,.10)',
                      background: deleted ? 'rgba(239,68,68,.05)' : 'var(--card, #fff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 900 }}>{p.title || code}</div>
                          <div className="sg-muted" style={{ fontSize: 12 }}><b>{code}</b></div>
                          {deleted ? (
                            <span className="sg-pill" style={{ padding: '6px 10px' }}>
                              <b style={{ color: 'rgba(239,68,68,1)' }}>удалён из конструктора</b>
                            </span>
                          ) : null}
                          {isCoinsPrize ? (
                            <span className="sg-pill" style={{ padding: '6px 10px' }}>
                              <b>монеты: {normalizeCoins(p)}</b>
                            </span>
                          ) : (
                            <span className="sg-pill" style={{ padding: '6px 10px' }}>
                              <b>физический</b>
                            </span>
                          )}
                        </div>

                        <div className="sg-muted" style={{ marginTop: 6 }}>
                          выигрыши: <b>{Number(p.wins) || 0}</b> · выдачи: <b>{Number(p.redeemed) || 0}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginLeft: 'auto' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={!!d.active}
                            onChange={() => patchDraft(code, { active: !d.active })}
                          />
                          <span style={{ fontWeight: 900 }}>{d.active ? 'активен' : 'выкл'}</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={!!d.track_qty}
                            onChange={() => patchDraft(code, { track_qty: !d.track_qty })}
                          />
                          <span style={{ fontWeight: 900 }}>{d.track_qty ? 'учёт остатков' : 'без склада'}</span>
                        </label>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="sg-muted" style={{ fontWeight: 900 }}>остаток</div>
                          {tracked ? (
                            <Input
                              value={d.qty_left}
                              onChange={(e: any) => patchDraft(code, { qty_left: e.target.value })}
                              placeholder="0"
                              style={{ width: 110 }}
                            />
                          ) : (
                            <span className="sg-muted">—</span>
                          )}
                          {tracked ? (
                            <span className="sg-muted">
                              {out ? '· ноль' : low ? `· мало (≤${inventory.lowThreshold})` : ''}
                            </span>
                          ) : null}
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {tracked ? (
                            <>
                              <input
                                type="checkbox"
                                checked={!!d.stop_when_zero}
                                onChange={() => patchDraft(code, { stop_when_zero: !d.stop_when_zero })}
                              />
                              <span style={{ fontWeight: 900 }}>{d.stop_when_zero ? 'авто-выкл' : 'не выключать'}</span>
                              {out && swz ? (
                                <span className="sg-pill" style={{ padding: '6px 10px' }}>
                                  <b>выключен по нулю</b>
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="sg-muted">авто-выкл: —</span>
                          )}
                        </label>
                      </div>
                    </div>

                    {tracked ? (
                      <div className="sg-muted" style={{ marginTop: 10, fontSize: 12 }}>
                        Логика мини-аппа: если включены <b>учёт остатков</b> + <b>авто-выкл</b> и остаток ≤ 0 — приз не выпадает.
                        Это работает и для монетных, и для физических призов.
                      </div>
                    ) : (
                      <div className="sg-muted" style={{ marginTop: 10, fontSize: 12 }}>
                        Учёт остатков выключен — приз может выпадать бесконечно (ограничения только по active/weight).
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
