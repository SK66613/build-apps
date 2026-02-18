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
} from 'recharts';

type PrizeStat = {
  prize_code: string;
  title: string;
  wins: number;
  redeemed: number;

  // runtime/config props (optional)
  weight?: number;
  active?: number;

  // finance props (optional, if backend returns)
  kind?: string;          // "coins" | "item"
  coins?: number;         // for coins-prize
  cost_cent?: number;     // item cost in cents
  cost_currency?: string; // not used yet in UI calc
  cost?: number;          // legacy: sometimes rub, sometimes cent (normalizeCostCent handles)
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
  const [coinRub, setCoinRub] = React.useState<string>('1');            // ₽ per coin
  const [spinCostCoinsDraft, setSpinCostCoinsDraft] = React.useState<string>('10'); // spin cost in coins
  const [spinsPerDayDraft, setSpinsPerDayDraft] = React.useState<string>('');      // empty => auto

  const coinCostCentPerCoin = Math.max(0, Math.floor(Number(coinRub || '0') * 100));
  const spinCostCoins = Math.max(0, Math.floor(Number(spinCostCoinsDraft || '0')));

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
  const redeemRate = totalWins > 0 ? Math.round((totalRedeemed / totalWins) * 100) : 0;

  // Chart data
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
    const weights = active.map(p => Math.max(0, Number(p.weight) || 0));
    const wSum = weights.reduce((s, w) => s + w, 0);

    const spinRevenueCent = spinCostCoins * coinCostCentPerCoin;

    let evPayoutCentAcc = 0;
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
      evPayoutCentAcc += expCent;

      return {
        prize_code: p.prize_code,
        title: p.title || p.prize_code,
        weight: w,
        prob,
        kind,
        coins,
        costCent,
        expCent,
        hasCost: kind === 'coins' ? true : (normalizeCostCent(p) > 0),
      };
    });

    const evPayoutCent = Math.round(evPayoutCentAcc);
    const evProfitCent = Math.round(spinRevenueCent - evPayoutCent);

    const roi = spinRevenueCent > 0 ? (evProfitCent / spinRevenueCent) : null;
    const breakEvenSpins = evProfitCent > 0 ? Math.ceil(evPayoutCent / evProfitCent) : null;

    const riskRows = [...perPrize].sort((a, b) => (b.expCent - a.expCent));
    const costCoverage = perPrize.length
      ? Math.round((perPrize.filter(x => x.hasCost).length / perPrize.length) * 100)
      : 0;

    return {
      wSum,
      spinRevenueCent,
      evPayoutCent,
      evProfitCent,
      roi,
      breakEvenSpins,
      perPrize,
      riskRows,
      costCoverage,
    };
  }, [items, spinCostCoins, coinCostCentPerCoin]);

  // Forecast (7/30)
  const forecast = React.useMemo(() => {
    const days = daysBetweenISO(range.from, range.to);
    const autoSpinsPerDay = totalWins > 0 ? (totalWins / days) : 0;

    const manual = Number(spinsPerDayDraft || '');
    const spinsPerDay =
      Number.isFinite(manual) && manual >= 0
        ? manual
        : autoSpinsPerDay;

    const proj = (d: number) => {
      const spins = spinsPerDay * d;
      return {
        days: d,
        spins,
        revenue: Math.round(spins * ev.spinRevenueCent),
        payout: Math.round(spins * ev.evPayoutCent),
        profit: Math.round(spins * ev.evProfitCent),
      };
    };

    return {
      daysInRange: days,
      autoSpinsPerDay,
      spinsPerDay,
      wip: [proj(7), proj(30)],
    };
  }, [range.from, range.to, totalWins, spinsPerDayDraft, ev.spinRevenueCent, ev.evPayoutCent, ev.evProfitCent]);

  return (
    <div className="sg-page wheelPage">
      <div className="wheelHead">
        <div>
          <h1 className="sg-h1">Wheel</h1>
          <div className="sg-sub">
            График + KPI + топы + live + настройки весов + экономика (EV/ROI) + прогноз.
          </div>
        </div>
      </div>

      <div className="wheelGrid">
        {/* LEFT */}
        <div className="wheelLeft">
          <Card className="wheelCard">
            <div className="wheelCardHead wheelCardHeadRow">
              <div>
                <div className="wheelCardTitle">Распределение призов</div>
                <div className="wheelCardSub">{range.from} — {range.to}</div>
              </div>

              <div className="wheelChartBtns" role="tablist" aria-label="Chart type">
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
                <div className="wheelKpiLbl">Wins</div>
                <div className="wheelKpiVal">{totalWins}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Redeemed</div>
                <div className="wheelKpiVal">{totalRedeemed}</div>
              </div>
              <div className="wheelKpi">
                <div className="wheelKpiLbl">Redeem rate</div>
                <div className="wheelKpiVal">{redeemRate}%</div>
              </div>
            </div>

            <div className="wheelUnderTabs">
              <div className="sg-tabs wheelUnderTabs__seg">
                <button className={'sg-tab ' + (panel==='live' ? 'is-active' : '')} onClick={() => setPanel('live')}>
                  Live
                </button>
                <button className={'sg-tab ' + (panel==='settings' ? 'is-active' : '')} onClick={() => setPanel('settings')}>
                  Настройки
                </button>
              </div>

              {panel === 'live' && (
                <div className="wheelUnderPanel">
                  <div className="wheelUnderHead">
                    <div>
                      <div className="wheelCardTitle">Live (последние события)</div>
                      <div className="wheelCardSub">auto refresh</div>
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
                          <div className="wheelLiveType">{e.type || 'event'}</div>
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
                        Вес/активность — сохраняем в воркер. Экономика — пока локально (для EV/прогноза).
                      </div>
                    </div>

                    <div className="wheelSave">
                      {saveMsg && <div className="wheelSaveMsg">{saveMsg}</div>}
                      <Button variant="primary" disabled={saving || qStats.isLoading || !appId} onClick={save}>
                        {saving ? 'Сохраняю…' : 'Сохранить изменения'}
                      </Button>
                    </div>
                  </div>

                  {/* Finance settings */}
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Стоимость 1 монеты (₽)</div>
                      <Input value={coinRub} onChange={(e: any) => setCoinRub(e.target.value)} placeholder="1" />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        = {rubFromCent(coinCostCentPerCoin)} / coin
                      </div>
                    </div>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Spin cost (монет)</div>
                      <Input value={spinCostCoinsDraft} onChange={(e: any) => setSpinCostCoinsDraft(e.target.value)} placeholder="10" />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        Revenue/spin = {rubFromCent(spinCostCoins * coinCostCentPerCoin)}
                      </div>
                    </div>
                    <div>
                      <div className="sg-muted" style={{ marginBottom: 6 }}>Spins/day (для прогноза)</div>
                      <Input
                        value={spinsPerDayDraft}
                        onChange={(e: any) => setSpinsPerDayDraft(e.target.value)}
                        placeholder="пусто = авто"
                      />
                      <div className="sg-muted" style={{ marginTop: 6 }}>
                        авто: {forecast.autoSpinsPerDay.toFixed(2)} / day
                      </div>
                    </div>
                  </div>

                  <div className="wheelTableWrap" style={{ marginTop: 12 }}>
                    <table className="sg-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Title</th>
                          <th>Wins</th>
                          <th>Redeemed</th>
                          <th style={{ minWidth: 240 }}>Weight</th>
                          <th style={{ minWidth: 120 }}>Active</th>
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
                                  <span style={{ fontWeight: 800 }}>{d.active ? 'on' : 'off'}</span>
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
                    EV/ROI считается по активным призам и weight. Coin-призы: <b>coins × стоимость монеты</b>. Item-призы: <b>cost_cent/cost</b>.
                    Покрытие себестоимости: <b>{ev.costCoverage}%</b>.
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
                  <div className="wheelSumVal">{redeemRate}%</div>
                </div>
              </div>

              <div className="wheelRedeemBar">
                <div className="wheelRedeemTop">
                  <div className="wheelRedeemName">Redeem rate</div>
                  <div className={"wheelRedeemBadge " + (redeemRate >= 70 ? 'ok' : redeemRate >= 40 ? 'mid' : 'bad')}>
                    {redeemRate >= 70 ? 'OK' : redeemRate >= 40 ? 'RISK' : 'BAD'}
                  </div>
                </div>

                <div className="wheelBarTrack" aria-hidden="true">
                  <div className="wheelBarFill" style={{ width: `${Math.max(0, Math.min(100, redeemRate))}%` }} />
                </div>

                <div className="wheelRedeemMeta">
                  <span className="sg-muted">Wins: <b>{totalWins}</b></span>
                  <span className="sg-muted">Redeemed: <b>{totalRedeemed}</b></span>
                </div>
              </div>
            </div>
          </Card>

          {/* EV / ROI */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div>
                <div className="wheelCardTitle">Expected Value / ROI</div>
                <div className="wheelCardSub">weight + себестоимость + стоимость монеты</div>
              </div>
            </div>

            <div className="wheelSummaryPro">
              <div className="wheelSummaryTiles">
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">Spin revenue</div>
                  <div className="wheelSumVal">{rubFromCent(ev.spinRevenueCent)}</div>
                </div>
                <div className="wheelSumTile">
                  <div className="wheelSumLbl">EV payout</div>
                  <div className="wheelSumVal">{rubFromCent(ev.evPayoutCent)}</div>
                </div>
                <div className="wheelSumTile is-strong">
                  <div className="wheelSumLbl">EV profit</div>
                  <div className="wheelSumVal">{rubFromCent(ev.evProfitCent)}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="sg-pill" style={{ padding: '10px 12px' }}>
                  <span className="sg-muted">ROI (margin): </span>
                  <b>{ev.roi === null ? '—' : fmtPct(ev.roi)}</b>
                </div>
                <div className="sg-pill" style={{ padding: '10px 12px' }}>
                  <span className="sg-muted">Break-even: </span>
                  <b>{ev.breakEvenSpins === null ? '∞' : `${ev.breakEvenSpins} спинов`}</b>
                </div>
              </div>

              <div className="sg-muted" style={{ marginTop: 10 }}>
                Revenue/spin = <b>{spinCostCoins}</b> coin × <b>{rubFromCent(coinCostCentPerCoin)}</b>/coin.
                &nbsp; | &nbsp; Cost coverage: <b>{ev.costCoverage}%</b>
              </div>

              {/* EV risk rows */}
              <div style={{ marginTop: 12 }}>
                <div className="wheelCardTitle" style={{ fontSize: 14, marginBottom: 6 }}>
                  Топ вкладов в EV payout (кто “съедает” экономику)
                </div>
                <div className="wheelTableWrap">
                  <table className="sg-table">
                    <thead>
                      <tr>
                        <th>Prize</th>
                        <th style={{ width: 90 }}>P</th>
                        <th style={{ width: 120 }}>Cost</th>
                        <th style={{ width: 140 }}>EV contrib</th>
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

                <div className="sg-muted" style={{ marginTop: 8 }}>
                  Если у item-призов cost не заполнен — EV будет слишком “розовый”.
                </div>
              </div>
            </div>
          </Card>

          {/* Forecast */}
          <Card className="wheelCard">
            <div className="wheelCardHead">
              <div>
                <div className="wheelCardTitle">Прогноз (7 / 30 дней)</div>
                <div className="wheelCardSub">на базе EV (средняя экономика на 1 спин)</div>
              </div>
            </div>

            <div className="wheelSummaryPro">
              <div className="sg-muted" style={{ marginBottom: 8 }}>
                База: <b>{forecast.spinsPerDay.toFixed(2)}</b> спина/день (пусто = авто по диапазону)
              </div>

              <div className="wheelTableWrap">
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>Период</th>
                      <th style={{ width: 110 }}>Спины</th>
                      <th style={{ width: 150 }}>Revenue</th>
                      <th style={{ width: 150 }}>EV payout</th>
                      <th style={{ width: 150 }}>EV profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.wip.map((r) => (
                      <tr key={r.days}>
                        <td><b>{r.days} дней</b></td>
                        <td>{r.spins.toFixed(0)}</td>
                        <td><b>{rubFromCent(r.revenue)}</b></td>
                        <td>{rubFromCent(r.payout)}</td>
                        <td><b>{rubFromCent(r.profit)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sg-muted" style={{ marginTop: 10 }}>
                Это матожидание. Волатильность дают редкие дорогие призы и остатки (если трекаешь qty).
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
                  Wins
                </button>
                <button
                  type="button"
                  className={'sg-tab ' + (topMetric==='redeemed' ? 'is-active' : '')}
                  onClick={() => setTopMetric('redeemed')}
                >
                  Redeemed
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
                          ? `redeemed: ${Number(p.redeemed)||0}`
                          : `wins: ${Number(p.wins)||0}`
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
