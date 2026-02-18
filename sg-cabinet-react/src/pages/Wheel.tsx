// src/pages/Wheel.tsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAppState } from '../app/appState';
import { Button, Card, Input } from '../components/ui';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
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

type ActivityItem = {
  ts?: string;
  type?: string;
  label?: string;
  user?: string;
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

/* ===== SVG icons for chart mode ===== */
function IcoBars(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 13V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 13V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IcoLine(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IcoArea(){
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 11l4-4 3 3 5-6v10H2V11z" fill="currentColor" opacity="0.18"/>
      <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
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

export default function Wheel(){
  const { appId, range } = useAppState();
  const qc = useQueryClient();

  const [chartMode, setChartMode] = React.useState<'bar'|'line'|'area'>('bar');
  const [panel, setPanel] = React.useState<'live'|'settings'>('live');
  const [topMetric, setTopMetric] = React.useState<'wins'|'redeemed'>('wins');

  // Finance settings (for EV/ROI & Forecast)
  const [coinRub, setCoinRub] = React.useState<string>('1');                 // ₽ per coin
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // spin cost in coins
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');       // empty => auto

  // расход считать: issued или redeemed
  const [costBasis, setCostBasis] = React.useState<'issued'|'redeemed'>('issued');

  const coinCostCentPerCoin = Math.max(0, Math.floor(Number(coinRub || '0') * 100));
  const spinCostCoins = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

  // Forecast scenario + chart toggles (кнопки, не чекбоксы)
  const [scenario, setScenario] = React.useState<'low'|'base'|'high'>('base');
  const [showRevenue, setShowRevenue] = React.useState<boolean>(true);
  const [showPayout, setShowPayout] = React.useState<boolean>(false);
  const [showCumulative, setShowCumulative] = React.useState<boolean>(true);

  const scenarioMul = React.useMemo(() => {
    if (scenario === 'low') return 0.7;
    if (scenario === 'high') return 1.3;
    return 1.0;
  }, [scenario]);

  const qStats = useQuery({
    enabled: !!appId,
    queryKey: ['wheel', appId, range.from, range.to],
    queryFn: () => apiFetch<{ ok: true; items: PrizeStat[] }>(
      `/api/cabinet/apps/${appId}/wheel/stats?${qs(range)}`
    ),
    staleTime: 10_000,
  });

  const qLive = useQuery({
    enabled: !!appId && panel === 'live',
    queryKey: ['wheel.live', appId, range.from, range.to],
    queryFn: async () => {
      return apiFetch<{ ok: true; items: ActivityItem[] }>(
        `/api/cabinet/apps/${appId}/activity?${qs(range)}`
      );
    },
    staleTime: 5_000,
    refetchInterval: 7_000,
    retry: 0,
  });

  const items = qStats.data?.items || [];

  // KPI
  const totalWins = items.reduce((s, p) => s + (Number(p.wins) || 0), 0);
  const totalRedeemed = items.reduce((s, p) => s + (Number(p.redeemed) || 0), 0);
  const redeemRate = totalWins > 0 ? Math.max(0, Math.min(1, totalRedeemed / totalWins)) : 0; // 0..1
  const redeemRatePct = totalWins > 0 ? Math.round(redeemRate * 100) : 0;

  // Chart data (distribution)
  const chartData = items.map(p => ({
    title: p.title || p.prize_code,
    wins: Number(p.wins) || 0,
    redeemed: Number(p.redeemed) || 0,
  }));

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

  // Данные за выбранный период range (без 7/30)
  const period = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const spins = totalWins; // в твоей модели: 1 spin -> 1 win (issued)
    const revenue = Math.round(spins * ev.spinRevenueCent);
    const payout = Math.round(spins * ev.payoutCent);
    const profit = Math.round(spins * ev.profitCent);
    const spinsPerDay = days > 0 ? (spins / days) : 0;

    return { days, spins, revenue, payout, profit, spinsPerDay };
  }, [range.from, range.to, totalWins, ev.spinRevenueCent, ev.payoutCent, ev.profitCent]);

  // Forecast series (30 дней) — чисто для графика “прогноз”
  const forecast = React.useMemo(() => {
    const days = period.days;
    const autoSpinsPerDay = totalWins > 0 ? (totalWins / Math.max(1, days)) : 0;

    const manual = Number(spinsPerDayDraft || '');
    const baseSpinsPerDay =
      Number.isFinite(manual) && manual >= 0
        ? manual
        : autoSpinsPerDay;

    const spinsPerDay = baseSpinsPerDay * scenarioMul;

    let cum = 0;
    const series30 = Array.from({ length: 30 }).map((_, i) => {
      const day = i + 1;
      const spins = spinsPerDay;

      const revenue = Math.round(spins * ev.spinRevenueCent);
      const payout = Math.round(spins * ev.payoutCent);
      const profit = Math.round(spins * ev.profitCent);

      cum += profit;

      return {
        day,
        label: `D${day}`,
        spins,
        revenue,
        payout,
        profit,
        cum_profit: cum,
      };
    });

    let breakEvenDay: number | null = null;
    if (ev.breakEvenSpins !== null && spinsPerDay > 0){
      const d = Math.ceil(ev.breakEvenSpins / spinsPerDay);
      if (Number.isFinite(d) && d >= 1 && d <= 30) breakEvenDay = d;
    }

    return {
      autoSpinsPerDay,
      baseSpinsPerDay,
      spinsPerDay,
      series30,
      breakEvenDay,
    };
  }, [
    period.days,
    totalWins,
    spinsPerDayDraft,
    scenarioMul,
    ev.spinRevenueCent,
    ev.payoutCent,
    ev.profitCent,
    ev.breakEvenSpins,
  ]);

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Колесо</h1>
          <div className="sg-sub">
            Деньги (выручка/расход/прибыль) + распределение призов + топы + live + настройки весов + экономика (EV/ROI).
          </div>
        </div>
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">

          {/* ====== ДЕНЬГИ: стиль как у “Распределение призов” + кнопки-галочки справа ====== */}
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

            {/* мини-сценарии (прогноз) */}
            <div className="wheelSummaryPro" style={{ paddingTop: 0 }}>
              <div className="sg-tabs wheelMiniTabs" style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className={'sg-tab ' + (scenario==='low' ? 'is-active' : '')}
                  onClick={() => setScenario('low')}
                >Низкий</button>
                <button
                  type="button"
                  className={'sg-tab ' + (scenario==='base' ? 'is-active' : '')}
                  onClick={() => setScenario('base')}
                >Базовый</button>
                <button
                  type="button"
                  className={'sg-tab ' + (scenario==='high' ? 'is-active' : '')}
                  onClick={() => setScenario('high')}
                >Высокий</button>
              </div>

              <div className="sg-muted" style={{ marginBottom: 8 }}>
                Спинов/день (для прогноза): <b>{forecast.spinsPerDay.toFixed(2)}</b>
                {spinsPerDayDraft ? (
                  <> (вручную)</>
                ) : (
                  <> (авто по периоду: <b>{forecast.autoSpinsPerDay.toFixed(2)}</b>)</>
                )}
              </div>
            </div>

            {/* график как wheelChart */}
            <div className={'wheelChart is-area'}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.series30}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.30} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} />

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

                  {/* Break-even вертикаль */}
                  {forecast.breakEvenDay !== null && (
                    <ReferenceLine
                      x={forecast.breakEvenDay}
                      stroke="var(--accent2)"
                      strokeDasharray="6 4"
                      label={{
                        value: `Окупаемость ~ D${forecast.breakEvenDay}`,
                        position: 'insideTopRight',
                        fill: 'var(--accent2)',
                        fontSize: 12,
                      }}
                    />
                  )}

                  {/* прибыль всегда */}
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.16}
                    strokeWidth={3}
                  />

                  {/* накопительно */}
                  {showCumulative && (
                    <Line
                      type="monotone"
                      dataKey="cum_profit"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="0"
                    />
                  )}

                  {/* выручка */}
                  {showRevenue && (
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--accent2)"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}

                  {/* расход */}
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

            {/* ВНИЗУ: карточки значений ТОЛЬКО за выбранный период range */}
            <div className="wheelKpiRow">
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Дней</div>
                <div className="wheelKpiVal">{period.days}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Спинов</div>
                <div className="wheelKpiVal">{period.spins}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Спинов/день</div>
                <div className="wheelKpiVal">{period.spinsPerDay.toFixed(2)}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Выручка</div>
                <div className="wheelKpiVal">{rubFromCent(period.revenue)}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Расход</div>
                <div className="wheelKpiVal">{rubFromCent(period.payout)}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Прибыль</div>
                <div className="wheelKpiVal">{rubFromCent(period.profit)}</div>
              </div>
            </div>

            <div className="sg-muted" style={{ marginTop: 10, padding: '0 16px 16px' }}>
              Расход считается по <b>{costBasis}</b>. В режиме <b>redeemed</b> item-часть EV умножается на redeem rate, coin-призы считаются расходом сразу.
            </div>
          </Card>

          {/* ====== Распределение призов (как было) ====== */}
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Распределение призов</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="wheelChartBtns" role="tablist" aria-label="Тип графика">
                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='bar' ? 'is-active' : '')}
                  onClick={() => setChartMode('bar')}
                  title="Столбцы"
                  aria-label="Столбцы"
                ><IcoBars/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='line' ? 'is-active' : '')}
                  onClick={() => setChartMode('line')}
                  title="Линия"
                  aria-label="Линия"
                ><IcoLine/></button>

                <button
                  type="button"
                  className={'wheelChartBtn ' + (chartMode==='area' ? 'is-active' : '')}
                  onClick={() => setChartMode('area')}
                  title="Area"
                  aria-label="Area"
                ><IcoArea/></button>
              </div>
            </div>

            <div className={'wheelChart ' + (chartMode === 'bar' ? 'is-bar' : chartMode === 'line' ? 'is-line' : 'is-area')}>
              {qStats.isLoading && <div className="sg-muted">Загрузка…</div>}
              {qStats.isError && <div className="sg-muted">Ошибка: {(qStats.error as Error).message}</div>}

              {!qStats.isLoading && !qStats.isError && (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <BarChart data={chartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'rgba(2,6,23,0.02)' }} />
                      <Bar dataKey="wins" fill="var(--accent)" radius={[10,10,4,4]} />
                      <Bar dataKey="redeemed" fill="var(--accent2)" radius={[10,10,4,4]} />
                    </BarChart>
                  ) : chartMode === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'rgba(2,6,23,0.02)' }} />
                      <Line type="monotone" dataKey="wins" stroke="var(--accent)" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="redeemed" stroke="var(--accent2)" strokeWidth={3} dot={false} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                      <XAxis dataKey="title" tick={{ fontSize: 12 }} interval={0} height={44} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'rgba(2,6,23,0.02)' }} />
                      <Area type="monotone" dataKey="wins" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.16} strokeWidth={3} />
                      <Area type="monotone" dataKey="redeemed" stroke="var(--accent2)" fill="var(--accent2)" fillOpacity={0.12} strokeWidth={3} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            <div className="wheelKpiRow">
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Выигрышей</div>
                <div className="wheelKpiVal">{totalWins}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Забрано</div>
                <div className="wheelKpiVal">{totalRedeemed}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Redeem rate</div>
                <div className="wheelKpiVal">{redeemRatePct}%</div>
              </div>
            </div>

            <div className="wheelUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='live' ? 'is-active' : '')} onClick={() => setPanel('live')}>
                  Лента
                </button>
                <button className={'sg-tab ' + (panel==='settings' ? 'is-active' : '')} onClick={() => setPanel('settings')}>
                  Настройки
                </button>
              </div>

              {panel === 'live' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Лента (последние события)</div>
                      <div className="wheelCardSub">автообновление</div>
                    </div>
                    <div className="sg-pill" style={{ padding: '8px 12px' }}>
                      {qLive.isFetching ? 'обновляю…' : 'готово'}
                    </div>
                  </div>

                  {qLive.isLoading && <div className="sg-muted">Загрузка…</div>}
                  {qLive.isError && (
                    <div className="sg-muted">
                      Ошибка: {(qLive.error as Error).message}
                      <div style={{ marginTop: 8 }}>
                        Если видишь <b>Not found</b> — значит в воркере нет эндпоинта <code>/activity</code>.
                      </div>
                    </div>
                  )}

                  {qLive.data?.items?.length ? (
                    <div className="wheelLiveList">
                      {qLive.data.items.slice(0, 16).map((e, i) => (
                        <div className="wheelLiveRow" key={i}>
                          <div className="wheelLiveType">{e.type || 'событие'}</div>
                          <div className="wheelLiveLabel">{e.label || e.user || '—'}</div>
                          <div className="wheelLiveTs">{e.ts || ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : (!qLive.isLoading && !qLive.isError) ? (
                    <div className="sg-muted">Пока пусто</div>
                  ) : null}
                </div>
              )}

              {panel === 'settings' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Настройки (runtime override)</div>
                      <div className="wheelCardSub">
                        Вес/активность — сохраняем в воркер. Экономика/прогноз — локально.
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
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Спинов/день (для прогноза)</div>
                      <Input
                        value={spinsPerDayDraft}
                        onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                        placeholder="пусто = авто"
                      />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        авто: {forecast.autoSpinsPerDay.toFixed(2)} / день
                      </div>
                    </div>
                  </div>

                  {/* Cost basis switch */}
                  <div style={{ marginTop: 12, display:'flex', alignItems:'center', gap: 12, flexWrap:'wrap' }}>
                    <div className="sg-muted" style={{ fontWeight: 900 }}>Расход считать:</div>

                    <div className="sg-tabs wheelMiniTabs">
                      <button
                        type="button"
                        className={'sg-tab ' + (costBasis==='issued' ? 'is-active' : '')}
                        onClick={() => setCostBasis('issued')}
                        title="Расход фиксируем в момент выигрыша (issued)"
                      >
                        при выигрыше
                      </button>
                      <button
                        type="button"
                        className={'sg-tab ' + (costBasis==='redeemed' ? 'is-active' : '')}
                        onClick={() => setCostBasis('redeemed')}
                        title="Расход фиксируем только когда приз забрали (redeemed). Item EV умножаем на redeem rate"
                      >
                        при выдаче
                      </button>
                    </div>

                    <div className="sg-pill" style={{ padding:'8px 12px' }}>
                      <span className="sg-muted">item EV × redeemRate: </span>
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
          {/* Summary */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div className="wheelCardTitle">Сводка</div>
            </div>

            <div className="wheelSummaryPro">
              <div className="wheelSummaryTiles">
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Активных</div>
                  <div className="wheelSumVal">{items.filter(i => (Number(i.active)||0) ? true : false).length}</div>
                </div>

                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Всего</div>
                  <div className="wheelSumVal">{items.length}</div>
                </div>

                <div className="wheelSumTile is-strong">
                  <div className="wheelSumLbl">Redeem</div>
                  <div className="wheelSumVal">{redeemRatePct}%</div>
                </div>
              </div>

              <div className="wheelRedeemBar">
                <div className="wheelRedeemTop">
                  <div className="wheelRedeemName">Redeem rate</div>
                  <div className={"wheelRedeemBadge " + (redeemRatePct >= 70 ? 'ok' : redeemRatePct >= 40 ? 'mid' : 'bad')}>
                    {redeemRatePct >= 70 ? 'OK' : redeemRatePct >= 40 ? 'RISK' : 'BAD'}
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
            </div>
          </Card>

          {/* EV / ROI */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div>
                <div className="wheelCardTitle">Expected Value / ROI</div>
                <div className="wheelCardSub">
                  база расхода: <b>{costBasis === 'issued' ? 'при выигрыше' : 'при выдаче'}</b>
                </div>
              </div>
            </div>

            <div className="wheelSummaryPro">
              <div className="wheelSummaryTiles">
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Выручка/спин</div>
                  <div className="wheelSumVal">{rubFromCent(ev.spinRevenueCent)}</div>
                </div>
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">EV расход</div>
                  <div className="wheelSumVal">{rubFromCent(ev.payoutCent)}</div>
                </div>
                <div className="wheelSumTile is-strong">
                  <div className="wheelSumLbl">EV прибыль</div>
                  <div className="wheelSumVal">{rubFromCent(ev.profitCent)}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="sg-pill" style={{ padding: '10px 12px' }}>
                  <span className="sg-muted">ROI (маржа): </span>
                  <b>{ev.roi === null ? '—' : fmtPct(ev.roi)}</b>
                </div>
                <div className="sg-pill" style={{ padding: '10px 12px' }}>
                  <span className="sg-muted">Окупаемость: </span>
                  <b>{ev.breakEvenSpins === null ? '∞' : `${ev.breakEvenSpins} спинов`}</b>
                </div>
              </div>

              <div className="sg-muted" style={{ marginTop: 10 }}>
                split: coin EV <b>{rubFromCent(ev.coinsEvCent)}</b> + item EV <b>{rubFromCent(ev.itemEvCent)}</b>
                {costBasis === 'redeemed' ? <> × redeemRate <b>{fmtPct(redeemRate)}</b></> : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="wheelCardTitle" style={{ fontSize: 14, marginBottom: 6 }}>
                  Топ вкладов в EV расход
                </div>
                <div className="wheelTableWrap">
                  <table className="sg-table">
                    <thead>
                      <tr>
                        <th>Приз</th>
                        <th style={{ width: 90 }}>P</th>
                        <th style={{ width: 120 }}>Cost</th>
                        <th style={{ width: 140 }}>EV вклад</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.riskRows.slice(0, 6).map((r) => (
                        <tr key={r.prize_code}>
                          <td><b>{r.title}</b></td>
                          <td>{fmtPct(r.prob, '0.0%')}</td>
                          <td>{rubFromCent(r.costCent)}</td>
                          <td><b>{rubFromCent(Math.round(r.expCent))}</b></td>
                        </tr>
                      ))}
                      {!ev.riskRows.length && (
                        <tr><td colSpan={4} style={{ opacity: 0.7, padding: 14 }}>Нет активных призов или весов.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {/* Top prizes */}
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
