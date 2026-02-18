// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  AreaChart, Area,
  Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine,
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
  cost_currency?: string; // not used yet in UI calc
  cost?: number;          // legacy: sometimes rub, sometimes cent
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

function rubFromCent(cent: number | null | undefined){
  const v = Number(cent);
  if (!Number.isFinite(v)) return '—';
  return `${(v / 100).toFixed(2)} ₽`;
}

function daysBetweenISO(fromISO: string, toISO: string){
  try{
    const a = new Date(fromISO + 'T00:00:00Z').getTime();
    const b = new Date(toISO + 'T00:00:00Z').getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
    const diff = Math.abs(b - a);
    const days = Math.floor(diff / (24*3600*1000)) + 1; // inclusive
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
function IcoSigma(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M12 3H5l4 5-4 5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
  const m = profitCent / revenueCent; // margin
  if (m >= 0.25) return { text: 'ОК', cls: 'ok' };
  if (m >= 0.05) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

function redeemBadge(redeemRatePct: number){
  if (redeemRatePct >= 70) return { text: 'ОК', cls: 'ok' };
  if (redeemRatePct >= 40) return { text: 'РИСК', cls: 'mid' };
  return { text: 'ПЛОХО', cls: 'bad' };
}

export default function Wheel(){
  // ожидаем, что setRange есть в appState (если иначе — скажи имя, подставлю)
  const { appId, range, setRange }: any = useAppState();
  const qc = useQueryClient();

  const [panel, setPanel] = React.useState<'roi'|'settings'>('roi');
  const [topMetric, setTopMetric] = React.useState<'wins'|'redeemed'>('wins');

  // Finance settings (for EV/ROI & Forecast)
  const [coinRub, setCoinRub] = React.useState<string>('1');                 // ₽ per coin
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // spin cost in coins
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');       // empty => auto

  // расход считать: issued или redeemed
  const [costBasis, setCostBasis] = React.useState<'issued'|'redeemed'>('issued');

  const coinCostCentPerCoin = Math.max(0, Math.floor(Number(coinRub || '0') * 100));
  const spinCostCoins = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

  // Денежный график: кнопки слоёв (залипающие)
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showCumulative, setShowCumulative] = React.useState<boolean>(true);

  // Быстрые периоды (в шапке справа)
  const [quick, setQuick] = React.useState<'day'|'week'|'month'|'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState<string>(range?.from || '');
  const [customTo, setCustomTo] = React.useState<string>(range?.to || '');

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

  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(
      `/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const items = qStats.data?.items || [];

  // KPI
  const totalWins = items.reduce((s, p) => s + (Number(p.wins) || 0), 0);
  const totalRedeemed = items.reduce((s, p) => s + (Number(p.redeemed) || 0), 0);
  const redeemRate = totalWins > 0 ? Math.max(0, Math.min(1, totalRedeemed / totalWins)) : 0; // 0..1
  const redeemRatePct = totalWins > 0 ? Math.round(redeemRate * 100) : 0;

  // Top prizes
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

  // EV/ROI + per-prize economics
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
    redeemRate,
    costBasis,
  ]);

  // Период (по общему range)
  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const spins = totalWins;
    const revenue = Math.round(spins * ev.spinRevenueCent);
    const payout = Math.round(spins * ev.payoutCent);
    const profit = Math.round(spins * ev.profitCent);
    const spinsPerDay = days > 0 ? (spins / days) : 0;
    return { days, spins, revenue, payout, profit, spinsPerDay };
  }, [range.from, range.to, totalWins, ev.spinRevenueCent, ev.payoutCent, ev.profitCent]);

  const profitTag = React.useMemo(() => profitBadge(period.profit, Math.max(0, period.revenue)), [period.profit, period.revenue]);
  const redeemTag = React.useMemo(() => redeemBadge(redeemRatePct), [redeemRatePct]);

  const activeCount = items.filter(i => (Number(i.active)||0) ? true : false).length;

  const moneySeries = React.useMemo(() => {
    const days = Math.max(1, period.days);
    const manual = Number(spinsPerDayDraft);
    const spinsPerDay =
      (Number.isFinite(manual) && manual >= 0)
        ? manual
        : (totalWins > 0 ? (totalWins / days) : 0);

    let cum = 0;
    const series = Array.from({ length: 30 }).map((_, i) => {
      const day = i + 1;
      const spins = spinsPerDay;

      const revenue = Math.round(spins * ev.spinRevenueCent);
      const payout = Math.round(spins * ev.payoutCent);
      const profit = Math.round(spins * ev.profitCent);

      cum += profit;

      return { day, revenue, payout, profit, cum_profit: cum };
    });

    let breakEvenDay: number | null = null;
    if (ev.breakEvenSpins !== null && spinsPerDay > 0){
      const d = Math.ceil(ev.breakEvenSpins / spinsPerDay);
      if (Number.isFinite(d) && d >= 1 && d <= 30) breakEvenDay = d;
    }

    return { series, breakEvenDay, spinsPerDay };
  }, [period.days, spinsPerDayDraft, totalWins, ev.spinRevenueCent, ev.payoutCent, ev.profitCent, ev.breakEvenSpins]);

  const breakEvenLabel = React.useMemo(() => {
    if (ev.breakEvenSpins === null) return 'не окупается';
    return `${ev.breakEvenSpins} спинов`;
  }, [ev.breakEvenSpins]);

  const topRisk = ev.riskRows?.[0] || null;

  const profitPerDay = React.useMemo(() => {
    const v = Math.round((moneySeries.spinsPerDay || 0) * ev.profitCent);
    return v;
  }, [moneySeries.spinsPerDay, ev.profitCent]);

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">Деньги + окупаемость + топы + настройки.</div>
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

          {/* ====== ДЕНЬГИ ====== */}
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Деньги: выручка / расход / прибыль</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="wheelChartBtns" role="tablist" aria-label="Слои графика">
                <button
                  type="button"
                  className={'wheelChartBtn ' + (showRevenue ? 'is-active' : '')}
                  onClick={() => setShowRevenue(v => !v)}
                  title="Показать/скрыть выручку"
                  aria-label="Выручка"
                ><IcoMoney/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showPayout ? 'is-active' : '')}
                  onClick={() => setShowPayout(v => !v)}
                  title="Показать/скрыть расход"
                  aria-label="Расход"
                ><IcoPay/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (showCumulative ? 'is-active' : '')}
                  onClick={() => setShowCumulative(v => !v)}
                  title="Показать/скрыть накопительную прибыль"
                  aria-label="Накопительно"
                ><IcoSigma/></button>
              </div>
            </div>

            <div className={'wheelChart is-area'}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={moneySeries.series}
                  // смещаем график левее, чтобы совпал с рамкой карточки
                  margin={{ top: 8, right: 10, left: -8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} width={40} />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      if (name === 'profit') return [rubFromCent(val), 'Прибыль/день'];
                      if (name === 'cum_profit') return [rubFromCent(val), 'Накопительная прибыль'];
                      if (name === 'revenue') return [rubFromCent(val), 'Выручка/день'];
                      if (name === 'payout') return [rubFromCent(val), 'Расход/день'];
                      return [val, name];
                    }}
                    labelFormatter={(label: any) => `День ${label}`}
                  />

                  {moneySeries.breakEvenDay !== null && (
                    <ReferenceLine
                      x={moneySeries.breakEvenDay}
                      stroke="var(--accent2)"
                      strokeDasharray="6 4"
                      label={{
                        value: `Окупаемость ~ D${moneySeries.breakEvenDay}`,
                        position: 'insideTopRight',
                        fill: 'var(--accent2)',
                        fontSize: 12,
                      }}
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.16}
                    strokeWidth={3}
                  />

                  {showCumulative && (
                    <Line
                      type="monotone"
                      dataKey="cum_profit"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}

                  {showRevenue && (
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--accent2)"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}

                  {showPayout && (
                    <Line
                      type="monotone"
                      dataKey="payout"
                      stroke="var(--accent2)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* УМНО: вместо дублей карточек — компактная строка */}
            <div className="sg-muted" style={{ padding: '10px 16px 0' }}>
              Период: <b>{period.days}</b> дн · Спинов/день: <b>{period.spinsPerDay.toFixed(2)}</b> · Прибыль/день: <b>{rubFromCent(profitPerDay)}</b>
            </div>

            {/* ВКЛАДКИ */}
            <div className="wheelUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='roi' ? 'is-active' : '')} onClick={() => setPanel('roi')}>
                  Окупаемость и экономика
                </button>
                <button className={'sg-tab ' + (panel==='settings' ? 'is-active' : '')} onClick={() => setPanel('settings')}>
                  Настройки
                </button>
              </div>

              {panel === 'roi' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Окупаемость и экономика</div>
                      <div className="wheelCardSub">
                        База расхода: <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>
                        {costBasis === 'redeemed' ? <> (item EV × доля выдачи)</> : null}
                      </div>
                    </div>
                  </div>

                  <div className="wheelSummaryPro" style={{ paddingTop: 0 }}>
                    <div className="wheelSummaryTiles">
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Выручка за 1 спин</div>
                        <div className="wheelSumVal">{rubFromCent(ev.spinRevenueCent)}</div>
                      </div>
                      <div className="wheelSumTile">
                        <div className="wheelSumLbl">Ожидаемый расход (EV)</div>
                        <div className="wheelSumVal">{rubFromCent(ev.payoutCent)}</div>
                      </div>
                      <div className="wheelSumTile is-strong">
                        <div className="wheelSumLbl">Ожидаемая прибыль (EV)</div>
                        <div className="wheelSumVal">{rubFromCent(ev.profitCent)}</div>
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
                        <span className="sg-muted">Главный риск по расходу: </span>
                        <b>{topRisk.title}</b>
                        <span className="sg-muted"> · EV вклад: </span>
                        <b>{rubFromCent(Math.round(topRisk.expCent))}</b>
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
                        Вес/активность — сохраняем в воркер. Экономика/график — локально.
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
                        = {rubFromCent(coinCostCentPerCoin)} / монета
                      </div>
                    </div>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Цена спина (монет)</div>
                      <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        Выручка/спин = {rubFromCent(spinCostCoins * coinCostCentPerCoin)}
                      </div>
                    </div>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Спинов/день (для графика)</div>
                      <Input
                        value={spinsPerDayDraft}
                        onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                        placeholder="пусто = авто"
                      />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        авто: {period.days > 0 ? (totalWins / Math.max(1, period.days)).toFixed(2) : '0.00'} / день
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display:'flex', alignItems:'center', gap: 12, flexWrap:'wrap' }}>
                    <div className="sg-muted" style={{ fontWeight: 900 }}>Расход считать:</div>

                    <div className="sg-tabs wheelMiniTabs">
                      <button
                        type="button"
                        className={'sg-tab ' + (costBasis==='issued' ? 'is-active' : '')}
                        onClick={() => setCostBasis('issued')}
                      >
                        при выигрыше
                      </button>
                      <button
                        type="button"
                        className={'sg-tab ' + (costBasis==='redeemed' ? 'is-active' : '')}
                        onClick={() => setCostBasis('redeemed')}
                      >
                        при выдаче
                      </button>
                    </div>

                    <div className="sg-pill" style={{ padding:'8px 12px' }}>
                      <span className="sg-muted">Доля выдачи: </span>
                      <b>{fmtPct(redeemRate, '—')}</b>
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
                          <th style={{ minWidth: 240 }}>Вес</th>
                          <th style={{ minWidth: 120 }}>Активен</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const d = draft[p.prize_code] || { weight: String(p.weight ?? ''), active: !!p.active };
                          return (
                            <tr key={p.prize_code}>
                              <td><b>{p.prize_code}</b></td>
                              <td>{p.title}</td>
                              <td>{p.wins}</td>
                              <td>{p.redeemed}</td>
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
                          <tr><td colSpan={6} style={{ opacity: 0.7, padding: 14 }}>Нет призов.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="sg-muted" style={{ marginTop: 12 }}>
                    Покрытие себестоимости: <b>{ev.costCoverage}%</b>. В режиме <b>при выдаче</b> coin-призы всё равно считаются расходом сразу.
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="wheelRight">
          {/* Сводка */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Сводка</div>
            </div>

            <div className="wheelSummaryPro">
              <div className="wheelSummaryTiles">
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Спинов</div>
                  <div className="wheelSumVal">{period.spins}</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Выручка</div>
                  <div className="wheelSumVal">{rubFromCent(period.revenue)}</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Расход</div>
                  <div className="wheelSumVal">{rubFromCent(period.payout)}</div>
                  <div className="sg-muted" style={{ marginTop: 4 }}>
                    база: <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>
                  </div>
                </div>

                <div className="wheelSumTile is-strong">
                  <div className="wheelSumLbl" style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    Прибыль
                    <span className={'wheelRedeemBadge ' + profitTag.cls}>{profitTag.text}</span>
                  </div>
                  <div className="wheelSumVal">{rubFromCent(period.profit)}</div>
                </div>
              </div>

              <div className="wheelSummaryTiles" style={{ marginTop: 10 }}>
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Маржа (ROI)</div>
                  <div className="wheelSumVal">{ev.roi === null ? '—' : fmtPct(ev.roi)}</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl" style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    Доля выдачи
                    <span className={'wheelRedeemBadge ' + redeemTag.cls}>{redeemTag.text}</span>
                  </div>
                  <div className="wheelSumVal">{redeemRatePct}%</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Активных призов</div>
                  <div className="wheelSumVal">{activeCount} / {items.length}</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Окупаемость</div>
                  <div className="wheelSumVal">{breakEvenLabel}</div>
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
                  <div className="wheelBarFill" style={{ width: `${Math.max(0, Math.min(100, redeemRatePct))}%` }} />
                </div>

                <div className="wheelRedeemMeta">
                  <span className="sg-muted">Выигрышей: <b>{totalWins}</b></span>
                  <span className="sg-muted">Выдано: <b>{totalRedeemed}</b></span>
                </div>
              </div>

              {topRisk ? (
                <div className="sg-pill" style={{ padding:'10px 12px', marginTop: 12 }}>
                  <span className="sg-muted">Главный риск по расходу: </span>
                  <b>{topRisk.title}</b>
                  <span className="sg-muted"> · EV вклад: </span>
                  <b>{rubFromCent(Math.round(topRisk.expCent))}</b>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Топ призов */}
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
