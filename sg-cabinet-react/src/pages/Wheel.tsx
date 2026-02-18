// sg-cabinet-react/src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
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
  img?: string | null;

  cost_cent?: number; // item cost cents
  cost_currency?: string;

  // inventory flags (optional)
  track_qty?: number;
  qty_left?: number | null;
  stop_when_zero?: number;
};

type WheelStatsResp = { ok: boolean; items: PrizeStat[] };

type WheelTsPoint = {
  day: string; // YYYY-MM-DD
  spins?: number;
  spin_cost?: number; // coins (legacy)
  wins?: number;
  redeemed?: number;

  // NEW (future, factual money on server)
  revenue_cents?: number;
  payout_cents_redeemed?: number; // real payout (redeemed)
  payout_cents_issued?: number; // optional
  profit_cents?: number;
  cum_profit_cents?: number;
  liability_cents?: number; // optional: issued - redeemed (stock/obligation)
  liability_cum_cents?: number; // optional
};

type WheelTsResp = { ok: boolean; series: WheelTsPoint[] };

// New app settings (we will implement in worker next)
type AppSettings = {
  coin_value_cents?: number; // price of 1 coin in cents
  currency?: string; // "RUB" | "USD" | etc
};

function qs(obj: Record<string, any>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  return p.toString();
}

function toNum(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampN(v: any, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function fmtMoneyFromCents(cents: number | null | undefined, currency: string) {
  const v = Number(cents);
  if (!Number.isFinite(v)) return '—';
  const cur = (currency || 'RUB').toUpperCase();
  const sign = cur === 'RUB' ? '₽' : cur === 'USD' ? '$' : cur;
  return `${(v / 100).toFixed(2)} ${sign}`;
}

function isoToday() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function safeTitle(s: any) {
  const t = String(s ?? '').trim();
  return t || '—';
}

function normalizePrizeCostCent(p: PrizeStat, coinValueCents: number) {
  // If item has cost_cent -> use it
  const costCent = Number(p.cost_cent ?? 0);
  if (Number.isFinite(costCent) && costCent > 0) return costCent;

  // If coins prize -> its “cost” equals awarded coins * coin_value
  const kind = String(p.kind || '').toLowerCase();
  if (kind === 'coins' && Number(p.coins ?? 0) > 0) {
    return Math.round(Number(p.coins) * coinValueCents);
  }

  // legacy field "cost" (sometimes rub, sometimes cent) — we avoid using it as “factual”
  return 0;
}

/**
 * Build chart-ready series.
 * Prefer NEW factual money fields from server when present.
 * Fallback: revenue from spin_cost (coins) * coinValue.
 * Payout fallback: compute from redeemed counts * prize cost (approx) distributed by period (rough). We keep it only for legacy,
 * but once worker returns payout_cents_redeemed per-day -> it becomes factual.
 */
function buildMoneySeries(
  ts: WheelTsPoint[],
  stats: PrizeStat[],
  coinValueCents: number
) {
  const series = (ts || []).slice().sort((a, b) => String(a.day).localeCompare(String(b.day)));

  const hasServerMoney =
    series.some((p) => Number.isFinite(Number(p.revenue_cents))) ||
    series.some((p) => Number.isFinite(Number(p.profit_cents))) ||
    series.some((p) => Number.isFinite(Number(p.payout_cents_redeemed)));

  if (hasServerMoney) {
    // Trust server factual money
    let cum = 0;
    const out = series.map((p) => {
      const revenue = toNum(p.revenue_cents, 0);
      const payout = toNum(p.payout_cents_redeemed, 0);
      const profit = Number.isFinite(Number(p.profit_cents)) ? toNum(p.profit_cents, revenue - payout) : revenue - payout;
      cum = Number.isFinite(Number(p.cum_profit_cents)) ? toNum(p.cum_profit_cents, cum + profit) : (cum + profit);
      return {
        day: p.day,
        spins: toNum(p.spins, 0),
        wins: toNum(p.wins, 0),
        redeemed: toNum(p.redeemed, 0),

        revenue,
        payout,
        profit,
        cum_profit: cum,

        liability: Number.isFinite(Number(p.liability_cents)) ? toNum(p.liability_cents, 0) : null,
        liability_cum: Number.isFinite(Number(p.liability_cum_cents)) ? toNum(p.liability_cum_cents, 0) : null,
      };
    });

    return { series: out, hasServerMoney: true };
  }

  // Legacy fallback (approx):
  // revenue: spin_cost(coins) * coinValueCents
  const revenueSeries = series.map((p) => {
    const spinCoins = toNum(p.spin_cost, 0);
    const revenue = Math.round(spinCoins * coinValueCents);
    return { day: p.day, spins: toNum(p.spins, 0), wins: toNum(p.wins, 0), redeemed: toNum(p.redeemed, 0), revenue };
  });

  // payout approximation: use total redeemed mix from stats, distribute evenly by redeemed count per day
  const totalRedeemed = revenueSeries.reduce((acc, p) => acc + toNum(p.redeemed, 0), 0);

  const costByPrize: Record<string, number> = {};
  let totalRedeemedCost = 0;
  for (const p of stats || []) {
    const c = normalizePrizeCostCent(p, coinValueCents);
    const redeemed = toNum(p.redeemed, 0);
    if (c > 0 && redeemed > 0) totalRedeemedCost += c * redeemed;
    costByPrize[p.prize_code] = c;
  }

  // if we can't estimate -> payout=0
  const avgRedeemedCost = totalRedeemed > 0 ? Math.round(totalRedeemedCost / totalRedeemed) : 0;

  let cum = 0;
  const out = revenueSeries.map((p) => {
    const redeemed = toNum(p.redeemed, 0);
    const payout = redeemed > 0 ? avgRedeemedCost * redeemed : 0;
    const profit = p.revenue - payout;
    cum += profit;
    return { ...p, payout, profit, cum_profit: cum };
  });

  return { series: out, hasServerMoney: false };
}

function calcBreakEvenDay(series: Array<{ day: string; cum_profit: number }>) {
  for (const p of series) {
    if (toNum(p.cum_profit, 0) >= 0) return p.day;
  }
  return null;
}

export default function WheelPage() {
  const { appId } = useAppState() as any;
  const qc = useQueryClient();

  const today = isoToday();
  const [from, setFrom] = React.useState(isoAddDays(today, -13));
  const [to, setTo] = React.useState(today);

  const range = React.useMemo(() => ({ from, to }), [from, to]);

  const [tab, setTab] = React.useState<'money' | 'conversion' | 'top' | 'settings'>('money');

  // chart toggles (keep minimal by default)
  const [showRevenue, setShowRevenue] = React.useState(false);
  const [showPayout, setShowPayout] = React.useState(false);
  const [showCumProfit, setShowCumProfit] = React.useState(true);
  const [showLiability, setShowLiability] = React.useState(false);

  // TOP metric
  const [topMetric, setTopMetric] = React.useState<'wins' | 'redeemed'>('wins');

  // === Queries ===

  const qStats = useQuery({
    queryKey: ['wheel.stats', appId, range.from, range.to],
    queryFn: async (): Promise<WheelStatsResp> => {
      const url = `/api/cabinet/wheel/stats?${qs({ appId, from: range.from, to: range.to })}`;
      return apiFetch(url);
    },
    enabled: !!appId,
  });

  const qTs = useQuery({
    queryKey: ['wheel.ts', appId, range.from, range.to],
    queryFn: async (): Promise<WheelTsResp> => {
      const url = `/api/cabinet/wheel/timeseries?${qs({ appId, from: range.from, to: range.to })}`;
      return apiFetch(url);
    },
    enabled: !!appId,
  });

  // new app_settings — may 404 until we implement
  const qSettings = useQuery({
    queryKey: ['app.settings', appId],
    queryFn: async (): Promise<{ ok: boolean; settings: AppSettings }> => {
      const url = `/api/cabinet/app_settings/get?${qs({ appId })}`;
      return apiFetch(url);
    },
    enabled: !!appId,
    retry: false,
  });

  const currency = (qSettings.data?.settings?.currency || 'RUB').toUpperCase();

  // coin value
  const coinValueCents = React.useMemo(() => {
    // default 1 coin = 1 RUB (100 cents of RUB)
    const v = Number(qSettings.data?.settings?.coin_value_cents);
    if (Number.isFinite(v) && v > 0) return Math.round(v);
    return 100;
  }, [qSettings.data?.settings?.coin_value_cents]);

  // drafts (settings tab)
  const [coinValueDraft, setCoinValueDraft] = React.useState<string>('');
  const [currencyDraft, setCurrencyDraft] = React.useState<string>('');
  const [saveMsg, setSaveMsg] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    // init drafts when settings loaded
    const cv = qSettings.data?.settings?.coin_value_cents;
    const cur = qSettings.data?.settings?.currency;
    if (coinValueDraft === '' && (cv !== undefined || qSettings.isError)) {
      setCoinValueDraft(String(Number.isFinite(Number(cv)) && Number(cv) > 0 ? Number(cv) : 100));
    }
    if (currencyDraft === '' && (cur || qSettings.isError)) {
      setCurrencyDraft(String(cur || 'RUB'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSettings.data?.settings?.coin_value_cents, qSettings.data?.settings?.currency, qSettings.isError]);

  const items = (qStats.data?.items || []) as PrizeStat[];
  const ts = (qTs.data?.series || []) as WheelTsPoint[];

  const days = daysBetweenISO(range.from, range.to);

  // inventory summary (only if worker returns fields)
  const inventory = React.useMemo(() => {
    const tracked = items.filter((p) => Number(p.track_qty ?? 0) ? true : false);
    const trackedCount = tracked.length;
    const outOfStockCount = tracked.filter((p) => (p.qty_left ?? 0) !== null && Number(p.qty_left ?? 0) <= 0).length;
    const lowThreshold = 3;
    const lowStockCount = tracked.filter((p) => (p.qty_left ?? 999999) !== null && Number(p.qty_left ?? 999999) > 0 && Number(p.qty_left ?? 999999) <= lowThreshold).length;
    const autoOffCount = tracked.filter((p) => Number(p.stop_when_zero ?? 0) ? true : false).length;

    // risky titles (low/zero + autoOff)
    const risky = tracked
      .filter((p) => {
        const q = p.qty_left;
        const swz = Number(p.stop_when_zero ?? 0) ? true : false;
        if (q === null || q === undefined) return false;
        const n = Number(q);
        return swz && Number.isFinite(n) && n <= lowThreshold;
      })
      .slice(0, 5);

    return { trackedCount, outOfStockCount, lowStockCount, autoOffCount, lowThreshold, risky };
  }, [items]);

  // totals
  const totalSpins = ts.reduce((acc, p) => acc + toNum(p.spins, 0), 0);
  const totalWins = ts.reduce((acc, p) => acc + toNum(p.wins, 0), 0);
  const totalRedeemed = ts.reduce((acc, p) => acc + toNum(p.redeemed, 0), 0);

  const winRate = totalSpins > 0 ? totalWins / totalSpins : null;
  const redeemRate = totalWins > 0 ? totalRedeemed / totalWins : null;

  const money = React.useMemo(() => {
    return buildMoneySeries(ts, items, coinValueCents);
  }, [ts, items, coinValueCents]);

  const breakEvenDay = React.useMemo(() => calcBreakEvenDay(money.series as any), [money.series]);
  const breakEvenLabel = breakEvenDay ? `достигнута ${breakEvenDay}` : 'ещё не достигнута';

  const period = React.useMemo(() => {
    const last = (money.series || [])[money.series.length - 1] as any;
    const revenue = money.series.reduce((acc: number, p: any) => acc + toNum(p.revenue, 0), 0);
    const payout = money.series.reduce((acc: number, p: any) => acc + toNum(p.payout, 0), 0);
    const profit = money.series.reduce((acc: number, p: any) => acc + toNum(p.profit, 0), 0);

    return {
      days,
      spins: totalSpins,
      wins: totalWins,
      redeemed: totalRedeemed,
      revenue,
      payout,
      profit,
      cum_profit: last ? toNum(last.cum_profit, 0) : profit,
    };
  }, [money.series, days, totalSpins, totalWins, totalRedeemed]);

  // TOP list
  const top = React.useMemo(() => {
    const arr = (items || []).slice().sort((a, b) => toNum((b as any)[topMetric], 0) - toNum((a as any)[topMetric], 0));
    return arr.slice(0, 8);
  }, [items, topMetric]);

  async function saveSettings() {
    setSaveMsg('');
    setSaving(true);
    try {
      const coin = clampN(coinValueDraft, 1, 10_000_000); // cents
      const cur = String(currencyDraft || 'RUB').toUpperCase().slice(0, 8);

      // New endpoint we implement next
      const r = await apiFetch(`/api/cabinet/app_settings/set`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId, settings: { coin_value_cents: coin, currency: cur } }),
      });

      if (!r || !r.ok) throw new Error(r?.error || 'SAVE_FAILED');
      setSaveMsg('✅ Сохранено');
      await qc.invalidateQueries({ queryKey: ['app.settings', appId] });
      await qc.invalidateQueries({ queryKey: ['wheel.ts', appId, range.from, range.to] });
      await qc.invalidateQueries({ queryKey: ['wheel.stats', appId, range.from, range.to] });
    } catch (e: any) {
      // If backend not implemented yet
      setSaveMsg(`⛔️ ${e?.message || String(e)}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 2000);
    }
  }

  const loading = qStats.isLoading || qTs.isLoading;
  const error = (qStats.isError ? (qStats.error as any) : null) || (qTs.isError ? (qTs.error as any) : null);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Колесо — аналитика</div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Период</div>
          <Input value={from} onChange={(e: any) => setFrom(String(e.target.value || '').trim())} style={{ width: 130 }} />
          <div style={{ opacity: 0.5 }}>—</div>
          <Input value={to} onChange={(e: any) => setTo(String(e.target.value || '').trim())} style={{ width: 130 }} />

          <Button onClick={() => { setFrom(isoAddDays(today, -13)); setTo(today); }}>
            14д
          </Button>
          <Button onClick={() => { setFrom(isoAddDays(today, -29)); setTo(today); }}>
            30д
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Button onClick={() => setTab('money')} variant={tab === 'money' ? 'primary' : 'secondary'}>Деньги</Button>
        <Button onClick={() => setTab('conversion')} variant={tab === 'conversion' ? 'primary' : 'secondary'}>Конверсия</Button>
        <Button onClick={() => setTab('top')} variant={tab === 'top' ? 'primary' : 'secondary'}>Топ призов</Button>
        <Button onClick={() => setTab('settings')} variant={tab === 'settings' ? 'primary' : 'secondary'}>Настройки</Button>
      </div>

      {error && (
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ color: 'var(--color-danger, #b00020)', fontWeight: 700 }}>Ошибка</div>
          <div style={{ opacity: 0.9 }}>{String(error?.message || error)}</div>
        </Card>
      )}

      {loading && (
        <Card style={{ padding: 12, marginBottom: 12 }}>
          Загрузка…
        </Card>
      )}

      {!loading && !error && tab === 'money' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 12, alignItems: 'start' }}>
          <Card style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Фактические деньги</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                {range.from} — {range.to} · валюта: {currency} · 1 coin = {fmtMoneyFromCents(coinValueCents, currency)}
                {money.hasServerMoney ? ' · source: server' : ' · source: legacy/approx'}
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={() => setShowRevenue((v) => !v)} variant={showRevenue ? 'primary' : 'secondary'} title="Выручка/день">
                  Revenue
                </Button>
                <Button onClick={() => setShowPayout((v) => !v)} variant={showPayout ? 'primary' : 'secondary'} title="Расход/день (по выдаче)">
                  Payout
                </Button>
                <Button onClick={() => setShowCumProfit((v) => !v)} variant={showCumProfit ? 'primary' : 'secondary'} title="Накопительная прибыль">
                  Cum
                </Button>
                <Button onClick={() => setShowLiability((v) => !v)} variant={showLiability ? 'primary' : 'secondary'} title="Обязательства (если сервер отдаёт)">
                  Liability
                </Button>
              </div>
            </div>

            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={money.series as any}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="L" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      const n = String(name);
                      if (['revenue', 'payout', 'profit', 'cum_profit', 'liability', 'liability_cum'].includes(n)) {
                        return [fmtMoneyFromCents(Number(val), currency), n];
                      }
                      return [val, n];
                    }}
                    labelFormatter={(label: any) => `День ${label}`}
                  />
                  <Legend />

                  {/* Break-even */}
                  {breakEvenDay && (
                    <ReferenceLine yAxisId="R" x={breakEvenDay} strokeDasharray="4 4" />
                  )}

                  {/* Main: Profit/day */}
                  <Bar yAxisId="L" dataKey="profit" name="profit" />

                  {/* Optional lines */}
                  {showRevenue && <Line yAxisId="L" type="monotone" dataKey="revenue" name="revenue" dot={false} />}
                  {showPayout && <Line yAxisId="L" type="monotone" dataKey="payout" name="payout" dot={false} />}

                  {showCumProfit && <Line yAxisId="R" type="monotone" dataKey="cum_profit" name="cum_profit" dot={false} strokeWidth={2} />}

                  {/* Liability (optional, server only) */}
                  {showLiability && <Line yAxisId="R" type="monotone" dataKey="liability_cum" name="liability_cum" dot={false} strokeDasharray="5 5" />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Profit/day — главный показатель. Revenue/Payout включай только когда нужно разбирать причины.
              Liability — это обязательства (выиграно минус выдано), появится когда воркер начнёт отдавать фактическую сумму.
            </div>
          </Card>

          <div style={{ display: 'grid', gap: 12 }}>
            <Card style={{ padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Сводка</div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Спинов</span>
                  <b>{period.spins}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Выручка</span>
                  <b>{fmtMoneyFromCents(period.revenue, currency)}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Расход (по выдаче)</span>
                  <b>{fmtMoneyFromCents(period.payout, currency)}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Прибыль</span>
                  <b>{fmtMoneyFromCents(period.profit, currency)}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Окупаемость</span>
                  <b>{breakEvenLabel}</b>
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Win rate</span>
                  <b>{fmtPct(winRate)}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Redeem rate</span>
                  <b>{fmtPct(redeemRate)}</b>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Остатки (если включены)</div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Учитываем остатки</span>
                  <b>{inventory.trackedCount}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Закончились</span>
                  <b>{inventory.outOfStockCount}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Мало (≤ {inventory.lowThreshold})</span>
                  <b>{inventory.lowStockCount}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ opacity: 0.75 }}>Авто-выкл при нуле</span>
                  <b>{inventory.autoOffCount}</b>
                </div>

                {!!inventory.risky.length && (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    Риск (топ): {inventory.risky.map((x) => x.title || x.prize_code).join(', ')}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {!loading && !error && tab === 'conversion' && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>Конверсия</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              {range.from} — {range.to}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Card style={{ padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Spins</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{totalSpins}</div>
            </Card>
            <Card style={{ padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Wins</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{totalWins}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Win rate: {fmtPct(winRate)}</div>
            </Card>
            <Card style={{ padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Redeemed</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{totalRedeemed}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Redeem rate: {fmtPct(redeemRate)}</div>
            </Card>
          </div>

          <div style={{ height: 320, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ts as any}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="spins" name="spins" dot={false} />
                <Line type="monotone" dataKey="wins" name="wins" dot={false} />
                <Line type="monotone" dataKey="redeemed" name="redeemed" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {!loading && !error && tab === 'top' && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>Топ призов</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button onClick={() => setTopMetric('wins')} variant={topMetric === 'wins' ? 'primary' : 'secondary'}>
                По выигрышам
              </Button>
              <Button onClick={() => setTopMetric('redeemed')} variant={topMetric === 'redeemed' ? 'primary' : 'secondary'}>
                По выдачам
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {top.map((p, idx) => {
              const max = Math.max(1, toNum((top[0] as any)?.[topMetric], 0));
              const val = toNum((p as any)[topMetric], 0);
              const w = Math.round((val / max) * 100);

              const cost = normalizePrizeCostCent(p, coinValueCents);
              return (
                <div key={p.prize_code} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, opacity: 0.8 }}>{idx + 1}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{safeTitle(p.title)}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      code: {p.prize_code}
                      {' · '}
                      wins: {toNum(p.wins, 0)}
                      {' · '}
                      redeemed: {toNum(p.redeemed, 0)}
                      {cost > 0 ? ` · cost: ${fmtMoneyFromCents(cost, currency)}` : ''}
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                      <div style={{ width: `${w}%`, height: '100%', background: 'rgba(255,255,255,0.35)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900 }}>{val}</div>
                </div>
              );
            })}

            {!top.length && <div style={{ opacity: 0.7 }}>Пока пусто</div>}
          </div>
        </Card>
      )}

      {!loading && !error && tab === 'settings' && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>Настройки монеты</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              (будет храниться в D1 в app_settings и использоваться сервером для фактических денег)
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, maxWidth: 520 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Валюта</div>
              <Input value={currencyDraft} onChange={(e: any) => setCurrencyDraft(String(e.target.value || '').toUpperCase())} placeholder="RUB" />
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>Напр: RUB, USD, EUR</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Цена 1 монеты (в центах валюты)</div>
              <Input value={coinValueDraft} onChange={(e: any) => setCoinValueDraft(String(e.target.value || ''))} placeholder="100" />
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                Сейчас: {fmtMoneyFromCents(clampN(coinValueDraft || coinValueCents, 1, 10_000_000), currency)} / coin
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </Button>
            {saveMsg && <div style={{ fontSize: 12, opacity: 0.8 }}>{saveMsg}</div>}
          </div>

          {qSettings.isError && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              ⚠️ Ручки app_settings ещё нет (это ок). Следующим шагом добавим таблицу + endpoints — и эта форма оживёт.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
