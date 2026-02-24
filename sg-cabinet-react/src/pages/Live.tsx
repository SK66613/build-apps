// src/pages/Sales.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppState } from '../app/appState';

import { SgPage } from '../components/sgp/layout/SgPage';
import {
  SgCard,
  SgCardHeader,
  SgCardTitle,
  SgCardSub,
  SgCardContent,
} from '../components/sgp/ui/SgCard';
import { SgButton } from '../components/sgp/ui/SgButton';
import { SgInput, SgSelect } from '../components/sgp/ui/SgInput';
import { SgStatusBadge } from '../components/sgp/ui/SgStatusBadge';

import { HealthBadge } from '../components/sgp/HealthBadge';
import { Tip } from '../components/sgp/Tip';
import { ShimmerLine } from '../components/sgp/ShimmerLine';
import { Collapsible } from '../components/sgp/Collapsible';
import { IconBtn } from '../components/sgp/IconBtn';

import { sgpChartTheme } from '../components/sgp/charts/theme';
import { SgProfitBar } from '../components/sgp/charts/SgProfitBar';

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

/**
 * SALES — Premium (SGP) standard page:
 * - SgPage + SgCard primitives
 * - Corner badge (SgStatusBadge) стандартизирован
 * - График: Area(revenue) + ProfitBar(net) with +/- color
 * - Tabs under chart: Summary/Funnel/Cashiers/Customers/Live
 *
 * DEV: пока mock (как было), потом просто заменить queryFn на реальные роуты воркера.
 */

type SalesRange = { from: string; to: string };

type SalesSettings = {
  coin_value_cents?: number;
  currency?: string; // RUB|USD|EUR
  cashback_pct?: number;
};

type SalesKPI = {
  revenue_cents: number;
  orders: number;
  buyers: number;
  repeat_rate: number; // 0..1
  cashback_issued_coins: number;
  redeem_confirmed_coins: number;
  pending_confirms?: number;
  cancel_rate?: number; // 0..1
};

type SalesDay = {
  date: string; // YYYY-MM-DD
  revenue_cents: number;
  orders: number;
  buyers: number;
  cashback_coins: number;
  redeem_coins: number;
  net_cents: number; // redeem(₽) - cashback(₽)
};

type SalesFunnel = {
  scanned: number;
  recorded: number;
  cashback_confirmed: number;
  redeem_confirmed: number;
  pin_issued: number;
  pin_used: number;
  median_confirm_minutes?: number;
};

type CashierRow = {
  cashier_label: string;
  orders: number;
  revenue_cents: number;
  confirm_rate: number; // 0..1
  cancel_rate: number; // 0..1
  median_confirm_minutes: number;
  alerts?: string[];
};

type CustomerRow = {
  customer_label: string;
  orders: number;
  revenue_cents: number;
  ltv_cents: number;
  last_seen: string;
  segment: 'new' | 'repeat' | 'saver' | 'spender';
};

function toInt(v: any, d = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.trunc(n);
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

function fmtPct(x: number | null | undefined, d = '—') {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return d;
  return `${(Number(x) * 100).toFixed(1)}%`;
}

/* ===== Mock data (fallback) ===== */
function mkMock(range: SalesRange, settings: SalesSettings) {
  const dates = listDaysISO(range.from, range.to);
  const coinCents = Math.max(1, toInt(settings.coin_value_cents ?? 100, 100));

  let buyersBase = 40;

  const days: SalesDay[] = dates.map((d, i) => {
    const wave = Math.sin(i / 3.2) * 0.25 + 0.85;
    const orders = Math.max(8, Math.round((18 + (i % 5) * 3) * wave));
    buyersBase = Math.max(18, buyersBase + (i % 2 === 0 ? 1 : -1));
    const buyers = Math.max(10, Math.round(buyersBase * wave));

    const avg = 52000 + Math.round(14000 * Math.sin(i / 2.8)); // cents
    const revenue = Math.max(0, orders * avg);

    const cashbackCoins = Math.round((revenue / 100) * 0.06);
    const redeemCoins = Math.round((revenue / 100) * 0.045);

    const net = Math.round(redeemCoins * coinCents - cashbackCoins * coinCents);

    return {
      date: d,
      revenue_cents: revenue,
      orders,
      buyers,
      cashback_coins: cashbackCoins,
      redeem_coins: redeemCoins,
      net_cents: net,
    };
  });

  const kpi: SalesKPI = {
    revenue_cents: days.reduce((s, x) => s + x.revenue_cents, 0),
    orders: days.reduce((s, x) => s + x.orders, 0),
    buyers: Math.max(
      1,
      Math.round(days.reduce((s, x) => s + x.buyers, 0) / Math.max(1, days.length)),
    ),
    repeat_rate: 0.36 + Math.sin(days.length / 4) * 0.05,
    cashback_issued_coins: days.reduce((s, x) => s + x.cashback_coins, 0),
    redeem_confirmed_coins: days.reduce((s, x) => s + x.redeem_coins, 0),
    pending_confirms: Math.round(3 + (days.length % 4)),
    cancel_rate: 0.06 + Math.sin(days.length / 3) * 0.01,
  };

  const funnel: SalesFunnel = {
    scanned: Math.round(kpi.orders * 1.35),
    recorded: kpi.orders,
    cashback_confirmed: Math.round(kpi.orders * 0.92),
    redeem_confirmed: Math.round(kpi.orders * 0.58),
    pin_issued: Math.round(kpi.orders * 0.48),
    pin_used: Math.round(kpi.orders * 0.32),
    median_confirm_minutes: 3.6,
  };

  const cashiers: CashierRow[] = [
    {
      cashier_label: 'Кассир #1',
      orders: Math.round(kpi.orders * 0.46),
      revenue_cents: Math.round(kpi.revenue_cents * 0.49),
      confirm_rate: 0.93,
      cancel_rate: 0.05,
      median_confirm_minutes: 2.4,
    },
    {
      cashier_label: 'Кассир #2',
      orders: Math.round(kpi.orders * 0.33),
      revenue_cents: Math.round(kpi.revenue_cents * 0.31),
      confirm_rate: 0.88,
      cancel_rate: 0.09,
      median_confirm_minutes: 4.2,
      alerts: ['Высокие отмены'],
    },
    {
      cashier_label: 'Кассир #3',
      orders: Math.round(kpi.orders * 0.21),
      revenue_cents: Math.round(kpi.revenue_cents * 0.2),
      confirm_rate: 0.9,
      cancel_rate: 0.06,
      median_confirm_minutes: 3.1,
    },
  ];

  const customers: CustomerRow[] = [
    {
      customer_label: 'Покупатель A',
      orders: 7,
      revenue_cents: 410000,
      ltv_cents: 690000,
      last_seen: dates[dates.length - 1],
      segment: 'repeat',
    },
    {
      customer_label: 'Покупатель B',
      orders: 1,
      revenue_cents: 58000,
      ltv_cents: 58000,
      last_seen: dates[Math.max(0, dates.length - 2)],
      segment: 'new',
    },
    {
      customer_label: 'Покупатель C',
      orders: 5,
      revenue_cents: 260000,
      ltv_cents: 510000,
      last_seen: dates[Math.max(0, dates.length - 3)],
      segment: 'spender',
    },
    {
      customer_label: 'Покупатель D',
      orders: 4,
      revenue_cents: 210000,
      ltv_cents: 420000,
      last_seen: dates[Math.max(0, dates.length - 6)],
      segment: 'saver',
    },
  ];

  return { kpi, days, funnel, cashiers, customers, settings };
}

/* ===== segmented buttons (page-level) ===== */
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
      className={active ? 'sgp-seg__btn is-active' : 'sgp-seg__btn'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type HealthTone = 'good' | 'warn' | 'bad';

/* ===== Page ===== */
export default function Sales() {
  const { appId, range, setRange }: any = useAppState();

  const [tab, setTab] = React.useState<'summary' | 'funnel' | 'cashiers' | 'customers' | 'live'>(
    'summary',
  );

  const [quick, setQuick] = React.useState<'day' | 'week' | 'month' | 'custom'>('custom');
  const [customFrom, setCustomFrom] = React.useState(range?.from || '');
  const [customTo, setCustomTo] = React.useState(range?.to || '');

  const [openPro, setOpenPro] = React.useState(true);
  const [openInsights, setOpenInsights] = React.useState(true);
  const [openTop, setOpenTop] = React.useState(true);

  // overlay controls on chart
  const [showNet, setShowNet] = React.useState(true); // ProfitBar
  const [showRevenue, setShowRevenue] = React.useState(true); // Area
  const [showOrdersLine, setShowOrdersLine] = React.useState(false); // optional

  // settings draft (UI-only)
  const [currencyDraft, setCurrencyDraft] = React.useState('RUB');
  const [coinValueDraft, setCoinValueDraft] = React.useState('1.00');

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

  const settings: SalesSettings = React.useMemo(() => {
    const units = Number(String(coinValueDraft).replace(',', '.'));
    const cents = Math.floor((Number.isFinite(units) ? units : 1) * 100);
    return {
      coin_value_cents: Math.max(1, cents),
      currency: String(currencyDraft || 'RUB').toUpperCase(),
      cashback_pct: 5,
    };
  }, [coinValueDraft, currencyDraft]);

  const qAll = useQuery({
    enabled: !!appId && !!range?.from && !!range?.to,
    queryKey: [
      'sales_mock',
      appId,
      range?.from,
      range?.to,
      settings.currency,
      settings.coin_value_cents,
    ],
    queryFn: async () => {
      // позже:
      // const kpi = await apiFetch(`/api/cabinet/apps/${appId}/sales/kpi?...`);
      // const ts  = await apiFetch(`/api/cabinet/apps/${appId}/sales/timeseries?...`);
      // ...
      return mkMock(range as SalesRange, settings);
    },
    staleTime: 10_000,
  });

  const isLoading = qAll.isLoading;
  const currency = String(qAll.data?.settings?.currency || settings.currency || 'RUB').toUpperCase();
  const coinCents = Math.max(
    1,
    toInt(qAll.data?.settings?.coin_value_cents ?? settings.coin_value_cents ?? 100),
  );

  const kpi = qAll.data?.kpi;
  const days = qAll.data?.days || [];
  const funnel = qAll.data?.funnel;
  const cashiers = qAll.data?.cashiers || [];
  const customers = qAll.data?.customers || [];

  const totals = React.useMemo(() => {
    const revenueC = Number(kpi?.revenue_cents || 0);
    const orders = Number(kpi?.orders || 0);

    const avgCheck = orders > 0 ? revenueC / orders : 0;

    const cashbackCoins = Number(kpi?.cashback_issued_coins || 0);
    const redeemCoins = Number(kpi?.redeem_confirmed_coins || 0);

    const cashbackCent = cashbackCoins * coinCents;
    const redeemCent = redeemCoins * coinCents;
    const net = redeemCent - cashbackCent;

    const pending = Number(kpi?.pending_confirms || 0);
    const cancelRate = Number(kpi?.cancel_rate || 0);
    const buyers = Number(kpi?.buyers || 0);
    const repeat = Number(kpi?.repeat_rate || 0);

    return {
      revenueC,
      orders,
      buyers,
      repeat,
      avgCheck,
      cashbackCoins,
      redeemCoins,
      cashbackCent,
      redeemCent,
      net,
      pending,
      cancelRate,
    };
  }, [kpi, coinCents]);

  const alerts = React.useMemo(() => {
    const list: Array<{ key: string; title: string; sev: 'warn' | 'bad' }> = [];

    if (totals.pending >= 6)
      list.push({ key: 'pending', title: 'Зависшие подтверждения (критично)', sev: 'bad' });
    else if (totals.pending > 0)
      list.push({ key: 'pending', title: 'Есть зависшие подтверждения', sev: 'warn' });

    if (totals.cancelRate >= 0.12)
      list.push({ key: 'cancel', title: 'Высокий процент отмен', sev: 'bad' });
    else if (totals.cancelRate >= 0.08)
      list.push({ key: 'cancel', title: 'Процент отмен выше нормы', sev: 'warn' });

    return list;
  }, [totals.pending, totals.cancelRate]);

  const healthTone: HealthTone = React.useMemo(() => {
    const hasBad = alerts.some((a) => a.sev === 'bad');
    if (hasBad) return 'bad';
    if (alerts.length) return 'warn';
    return 'good';
  }, [alerts]);

  const healthTitle =
    healthTone === 'bad'
      ? 'Есть критичные проблемы — исправь алерты.'
      : healthTone === 'warn'
        ? 'Есть отклонения — стоит проверить.'
        : 'Ок';

  const series = React.useMemo(() => {
    return days.map((d) => ({
      date: d.date,
      revenue: d.revenue_cents,
      net: d.net_cents,
      orders: d.orders,
    }));
  }, [days]);

  const topCashiers = [...cashiers].sort(
    (a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0),
  );
  const topCustomers = [...customers].sort((a, b) => (b.ltv_cents || 0) - (a.ltv_cents || 0));

  const t = typeof window !== 'undefined' ? sgpChartTheme() : null;

  return (
    <SgPage
      className="sgp-sales"
      title="Продажи"
      subtitle={<span>Факт + качество кассы/правил. (DEV: сейчас mock)</span>}
      actions={
        <div className="sgp-rangebar">
          <div className="sgp-seg">
            <SegBtn active={quick === 'day'} onClick={() => pickQuick('day')}>
              День
            </SegBtn>
            <SegBtn active={quick === 'week'} onClick={() => pickQuick('week')}>
              Неделя
            </SegBtn>
            <SegBtn active={quick === 'month'} onClick={() => pickQuick('month')}>
              Месяц
            </SegBtn>
            <SegBtn active={quick === 'custom'} onClick={() => pickQuick('custom')}>
              Свой
            </SegBtn>
          </div>

          {quick === 'custom' ? (
            <div className="sgp-rangebar__custom">
              <span className="sgp-muted">от</span>
              <input
                type="date"
                className="sgp-input sgp-date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="sgp-muted">до</span>
              <input
                type="date"
                className="sgp-input sgp-date"
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
          ) : null}
        </div>
      }
      aside={
        <div className="sgp-aside">
          <SgCard tone={healthTone === 'bad' ? 'bad' : healthTone === 'warn' ? 'warn' : 'good'}>
            <SgCardHeader
              right={
                <HealthBadge
                  tone={healthTone}
                  title={healthTone === 'bad' ? 'ALERT' : healthTone === 'warn' ? 'WARN' : 'OK'}
                />
              }
            >
              <div>
                <SgCardTitle>Summary PRO</SgCardTitle>
                <SgCardSub>Сигналы качества + рекомендации</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <Tip tone={healthTone === 'bad' ? 'warn' : healthTone}>{healthTitle}</Tip>

              <div style={{ height: 10 }} />

              <Collapsible
                open={openPro}
                onToggle={() => setOpenPro((v) => !v)}
                title="Список алертов"
                sub="Мягкая подсветка (без кислотности)"
                right={
                  <span className="sgp-muted">
                    {alerts.length ? `${alerts.length} алерт(а)` : 'нет алертов'}
                  </span>
                }
                healthTone={healthTone}
                healthTitle={healthTitle}
              >
                {!alerts.length ? (
                  <div className="sgpRow is-good">
                    <div className="sgpRowLeft">
                      <div>
                        <div className="sgpRowTitle">Всё спокойно</div>
                        <div className="sgpRowMeta">Пока нет критичных отклонений</div>
                      </div>
                    </div>
                    <div className="sgpRowRight">
                      <div className="sgpRowVal">ok</div>
                      <div className="sgpRowSub">clean</div>
                    </div>
                  </div>
                ) : (
                  alerts.slice(0, 6).map((a) => (
                    <div
                      key={a.key}
                      className={'sgpRow ' + (a.sev === 'bad' ? 'is-bad' : 'is-warn')}
                    >
                      <div className="sgpRowLeft">
                        <div>
                          <div className="sgpRowTitle">{a.title}</div>
                          <div className="sgpRowMeta">sev: {a.sev}</div>
                        </div>
                      </div>
                      <div className="sgpRowRight">
                        <div className="sgpRowVal">{a.sev === 'bad' ? '!' : '·'}</div>
                        <div className="sgpRowSub">{a.sev}</div>
                      </div>
                    </div>
                  ))
                )}
              </Collapsible>
            </SgCardContent>
          </SgCard>

          <div style={{ height: 12 }} />

          <SgCard tone="neutral">
            <SgCardHeader right={<SgStatusBadge tone="dev" label="DEV" title="пока UI-only" />}>
              <div>
                <SgCardTitle>Стоимость монеты</SgCardTitle>
                <SgCardSub>Нужно для пересчёта монет → деньги</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div>
                  <div className="sgp-muted" style={{ marginBottom: 6 }}>
                    1 монета = (в {currencyLabel(currencyDraft)})
                  </div>
                  <SgInput
                    value={coinValueDraft}
                    onChange={(e) => setCoinValueDraft((e.target as any).value)}
                    placeholder="1.00"
                  />
                  <div className="sgp-muted" style={{ marginTop: 6 }}>
                    = {moneyFromCent(coinCents, currencyDraft)} / монета
                  </div>
                </div>

                <div>
                  <div className="sgp-muted" style={{ marginBottom: 6 }}>
                    Валюта
                  </div>
                  <SgSelect
                    value={currencyDraft}
                    onChange={(e) =>
                      setCurrencyDraft(String((e.target as any).value || 'RUB').toUpperCase())
                    }
                  >
                    <option value="RUB">RUB (₽)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </SgSelect>
                </div>

                <SgButton variant="secondary" size="sm" disabled>
                  Сохранить (позже)
                </SgButton>
                <div className="sgp-muted">
                  DEV: позже сделаем PUT /settings и invalidate queries
                </div>
              </div>
            </SgCardContent>
          </SgCard>
        </div>
      }
    >
      {/* ===== KPI strip ===== */}
      <div className="sgp-salesKpiRow">
        <SgCard tone="neutral" variant="subtle">
          <SgCardHeader right={<IconBtn title="info" active={false} onClick={() => {}}>?</IconBtn>}>
            <div>
              <SgCardSub>ВЫРУЧКА</SgCardSub>
              <div className="sgp-salesKpiVal">
                {isLoading ? '—' : moneyFromCent(totals.revenueC, currency)}
              </div>
              <div className="sgp-salesKpiMeta">
                {isLoading
                  ? ' '
                  : `в день: ${(totals.revenueC / Math.max(1, days.length) / 100).toFixed(2)} ${currencyLabel(currency)}`}
              </div>
            </div>
          </SgCardHeader>
        </SgCard>

        <SgCard tone="neutral" variant="subtle">
          <SgCardHeader right={<IconBtn title="info" active={false} onClick={() => {}}>?</IconBtn>}>
            <div>
              <SgCardSub>ЗАКАЗЫ</SgCardSub>
              <div className="sgp-salesKpiVal">{isLoading ? '—' : totals.orders}</div>
              <div className="sgp-salesKpiMeta">
                {isLoading ? ' ' : `ср. чек: ${moneyFromCent(totals.avgCheck, currency)}`}
              </div>
            </div>
          </SgCardHeader>
        </SgCard>

        <SgCard tone="neutral" variant="subtle">
          <SgCardHeader right={<IconBtn title="info" active={false} onClick={() => {}}>?</IconBtn>}>
            <div>
              <SgCardSub>ПОКУПАТЕЛИ</SgCardSub>
              <div className="sgp-salesKpiVal">{isLoading ? '—' : totals.buyers}</div>
              <div className="sgp-salesKpiMeta">
                {isLoading ? ' ' : `repeat: ${fmtPct(totals.repeat)}`}
              </div>
            </div>
          </SgCardHeader>
        </SgCard>

        <SgCard tone="neutral" variant="subtle">
          <SgCardHeader right={<IconBtn title="info" active={false} onClick={() => {}}>?</IconBtn>}>
            <div>
              <SgCardSub>КЭШБЭК</SgCardSub>
              <div className="sgp-salesKpiVal">
                {isLoading ? '—' : `${totals.cashbackCoins.toLocaleString('ru-RU')} мон`}
              </div>
              <div className="sgp-salesKpiMeta">
                {isLoading ? ' ' : `≈ ${moneyFromCent(totals.cashbackCent, currency)}`}
              </div>
            </div>
          </SgCardHeader>
        </SgCard>

        <SgCard tone={totals.net < 0 ? 'bad' : 'good'} variant="subtle">
          <SgCardHeader
            right={
              <SgStatusBadge tone={totals.net < 0 ? 'warn' : 'ok'} label={totals.net < 0 ? 'WARN' : 'OK'} />
            }
          >
            <div>
              <SgCardSub>NET</SgCardSub>
              <div className="sgp-salesKpiVal">
                {isLoading ? '—' : moneyFromCent(totals.net, currency)}
              </div>
              <div className="sgp-salesKpiMeta">
                {isLoading ? ' ' : `списано: ${moneyFromCent(totals.redeemCent, currency)}`}
              </div>
            </div>
          </SgCardHeader>
        </SgCard>
      </div>

      {/* ===== Chart ===== */}
      <SgCard>
        <SgCardHeader
          right={
            <div className="sgpIconGroup">
              <IconBtn title="Net bars" active={showNet} onClick={() => setShowNet((v) => !v)}>
                P
              </IconBtn>
              <IconBtn title="Revenue area" active={showRevenue} onClick={() => setShowRevenue((v) => !v)}>
                R
              </IconBtn>
              <IconBtn title="Orders line" active={showOrdersLine} onClick={() => setShowOrdersLine((v) => !v)}>
                O
              </IconBtn>
            </div>
          }
        >
          <div>
            <SgCardTitle>Факт: выручка и net</SgCardTitle>
            <SgCardSub>
              {range.from} — {range.to}
            </SgCardSub>
          </div>
        </SgCardHeader>

        <SgCardContent>
          {isLoading ? (
            <ShimmerLine />
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}>
                  <CartesianGrid stroke={t?.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => fmtDDMM(String(v || ''))} />
                  <YAxis tick={{ fill: t?.axis }} />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      if (name === 'revenue') return [moneyFromCent(Number(val), currency), 'Выручка/день'];
                      if (name === 'net') return [moneyFromCent(Number(val), currency), 'Net/день'];
                      if (name === 'orders') return [String(val), 'Заказы/день'];
                      return [val, name];
                    }}
                    labelFormatter={(label: any) => `Дата ${label}`}
                  />

                  {showRevenue ? (
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="revenue"
                      stroke={t?.neutral}
                      fill={t?.neutral}
                      fillOpacity={0.10}
                      dot={false}
                    />
                  ) : null}

                  {showNet ? <SgProfitBar data={series} dataKey="net" name="net" /> : null}

                  {showOrdersLine ? (
                    <Line
                      type="monotone"
                      dataKey="orders"
                      name="orders"
                      stroke={t?.axis}
                      strokeDasharray="6 6"
                      dot={false}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ marginTop: 12 }} className="sgp-seg">
            <SegBtn active={tab === 'summary'} onClick={() => setTab('summary')}>
              Сводка
            </SegBtn>
            <SegBtn active={tab === 'funnel'} onClick={() => setTab('funnel')}>
              Воронка
            </SegBtn>
            <SegBtn active={tab === 'cashiers'} onClick={() => setTab('cashiers')}>
              Кассиры
            </SegBtn>
            <SegBtn active={tab === 'customers'} onClick={() => setTab('customers')}>
              Клиенты
            </SegBtn>
            <SegBtn active={tab === 'live'} onClick={() => setTab('live')}>
              Live
            </SegBtn>
          </div>

          <div style={{ marginTop: 10 }}>
            <Tip tone={healthTone === 'bad' ? 'warn' : 'good'}>
              Это эталон премиум-страницы: corner-badge и цвета графика берутся из SGP.
            </Tip>
          </div>
        </SgCardContent>
      </SgCard>

      {/* ===== TAB: SUMMARY ===== */}
      {tab === 'summary' ? (
        <div className="sgp-salesTwoCol">
          <SgCard tone={totals.pending >= 6 ? 'bad' : totals.pending > 0 ? 'warn' : 'good'} variant="subtle">
            <SgCardHeader
              right={
                <SgStatusBadge
                  tone={totals.pending >= 6 ? 'bad' : totals.pending > 0 ? 'warn' : 'ok'}
                  label={totals.pending >= 6 ? 'WARN' : totals.pending > 0 ? 'WARN' : 'OK'}
                />
              }
            >
              <div>
                <SgCardTitle>Зависшие подтверждения</SgCardTitle>
                <SgCardSub>Портит UX: клиент не видит результат</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <div className="sgp-salesBig">{isLoading ? '—' : totals.pending}</div>
              <div className="sgp-muted">
                {isLoading ? ' ' : totals.pending >= 6 ? 'критично' : totals.pending > 0 ? 'есть' : 'ок'}
              </div>
            </SgCardContent>
          </SgCard>

          <SgCard
            tone={totals.cancelRate >= 0.12 ? 'bad' : totals.cancelRate >= 0.08 ? 'warn' : 'good'}
            variant="subtle"
          >
            <SgCardHeader
              right={
                <SgStatusBadge
                  tone={totals.cancelRate >= 0.12 ? 'bad' : totals.cancelRate >= 0.08 ? 'warn' : 'ok'}
                  label={totals.cancelRate >= 0.12 ? 'WARN' : totals.cancelRate >= 0.08 ? 'WARN' : 'OK'}
                />
              }
            >
              <div>
                <SgCardTitle>Процент отмен</SgCardTitle>
                <SgCardSub>Сигнал проблем в кассе/правилах</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <div className="sgp-salesBig">{isLoading ? '—' : fmtPct(totals.cancelRate)}</div>
              <div className="sgp-muted">
                {isLoading ? ' ' : totals.cancelRate >= 0.12 ? 'плохо' : totals.cancelRate >= 0.08 ? 'риск' : 'ок'}
              </div>
            </SgCardContent>
          </SgCard>

          <SgCard tone="neutral">
            <SgCardHeader right={<SgStatusBadge tone="dev" label="DEV" />}>
              <div>
                <SgCardTitle>Инсайты</SgCardTitle>
                <SgCardSub>Сценарии улучшения (позже автоген)</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <Collapsible
                open={openInsights}
                onToggle={() => setOpenInsights((v) => !v)}
                title="Рекомендации"
                sub="4 карточки (пример)"
                healthTone={healthTone === 'bad' ? 'warn' : 'good'}
                healthTitle={healthTone === 'bad' ? 'Сначала исправь алерты' : 'Ок'}
                right={<span className="sgp-muted">4 cards</span>}
              >
                {isLoading ? (
                  <ShimmerLine />
                ) : (
                  <>
                    <div className="sgpRow is-warn">
                      <div className="sgpRowLeft">
                        <div>
                          <div className="sgpRowTitle">Сократи время подтверждения</div>
                          <div className="sgpRowMeta">Если median &gt; 5 мин — UX падает</div>
                        </div>
                      </div>
                      <div className="sgpRowRight">
                        <div className="sgpRowVal">hint</div>
                        <div className="sgpRowSub">flow</div>
                      </div>
                    </div>

                    <div className="sgpRow is-good">
                      <div className="sgpRowLeft">
                        <div>
                          <div className="sgpRowTitle">VIP для spender</div>
                          <div className="sgpRowMeta">Сделай “привилегии” — удержание</div>
                        </div>
                      </div>
                      <div className="sgpRowRight">
                        <div className="sgpRowVal">ok</div>
                        <div className="sgpRowSub">vip</div>
                      </div>
                    </div>
                  </>
                )}
              </Collapsible>
            </SgCardContent>
          </SgCard>

          <SgCard tone="neutral">
            <SgCardHeader right={<SgStatusBadge tone="ok" label="OK" />}>
              <div>
                <SgCardTitle>Топ</SgCardTitle>
                <SgCardSub>Кассиры и клиенты (коротко)</SgCardSub>
              </div>
            </SgCardHeader>
            <SgCardContent>
              <Collapsible
                open={openTop}
                onToggle={() => setOpenTop((v) => !v)}
                title="Top 6"
                sub="Выручка / LTV"
                healthTone="good"
                healthTitle="Ок"
                right={<span className="sgp-muted">Top 6</span>}
              >
                {isLoading ? (
                  <ShimmerLine />
                ) : (
                  <>
                    {topCashiers.slice(0, 3).map((c) => (
                      <div key={c.cashier_label} className="sgpRow">
                        <div className="sgpRowLeft">
                          <div>
                            <div className="sgpRowTitle">{c.cashier_label}</div>
                            <div className="sgpRowMeta">
                              confirm {fmtPct(c.confirm_rate)} · cancel {fmtPct(c.cancel_rate)} · median{' '}
                              {c.median_confirm_minutes.toFixed(1)}m
                            </div>
                          </div>
                        </div>
                        <div className="sgpRowRight">
                          <div className="sgpRowVal">{moneyFromCent(c.revenue_cents, currency)}</div>
                          <div className="sgpRowSub">revenue</div>
                        </div>
                      </div>
                    ))}

                    <div style={{ height: 10 }} />

                    {topCustomers.slice(0, 3).map((c) => (
                      <div key={c.customer_label} className="sgpRow">
                        <div className="sgpRowLeft">
                          <div>
                            <div className="sgpRowTitle">{c.customer_label}</div>
                            <div className="sgpRowMeta">
                              сегмент {c.segment} · заказов {c.orders} · last {c.last_seen}
                            </div>
                          </div>
                        </div>
                        <div className="sgpRowRight">
                          <div className="sgpRowVal">{moneyFromCent(c.ltv_cents, currency)}</div>
                          <div className="sgpRowSub">LTV</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </Collapsible>
            </SgCardContent>
          </SgCard>
        </div>
      ) : null}

      {/* ===== TAB: FUNNEL ===== */}
      {tab === 'funnel' ? (
        <SgCard tone="neutral">
          <SgCardHeader right={<SgStatusBadge tone="dev" label="DEV" />}>
            <div>
              <SgCardTitle>Воронка</SgCardTitle>
              <SgCardSub>Где падает конверсия (касса/правила/UX)</SgCardSub>
            </div>
          </SgCardHeader>
          <SgCardContent>
            {isLoading ? (
              <ShimmerLine />
            ) : (
              <div className="sgp-salesFunnel">
                <div className="sgpRow">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">Скан → Запись → Подтверждения</div>
                      <div className="sgpRowMeta">Слабое место = где больше всего падает</div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">
                      {funnel?.scanned} → {funnel?.recorded}
                    </div>
                    <div className="sgpRowSub">{funnel?.cashback_confirmed} confirmed</div>
                  </div>
                </div>

                <div className="sgpRow">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">PIN: выдано → использовано</div>
                      <div className="sgpRowMeta">Показывает “дожим” до награды</div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">
                      {funnel?.pin_issued} → {funnel?.pin_used}
                    </div>
                    <div className="sgpRowSub">
                      conv:{' '}
                      {fmtPct(funnel && funnel.pin_issued ? funnel.pin_used / funnel.pin_issued : 0)}
                    </div>
                  </div>
                </div>

                <div
                  className={
                    'sgpRow ' + ((funnel?.median_confirm_minutes ?? 0) > 5 ? 'is-warn' : 'is-good')
                  }
                >
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">Подтверждение (median)</div>
                      <div className="sgpRowMeta">От “записали” до “confirmed”</div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">{(funnel?.median_confirm_minutes ?? 0).toFixed(1)} мин</div>
                    <div className="sgpRowSub">
                      {(funnel?.median_confirm_minutes ?? 0) > 5 ? 'медленно' : 'ок'}
                    </div>
                  </div>
                </div>

                <div className="sgpRow">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">Списание (подтверждено)</div>
                      <div className="sgpRowMeta">Если низко — люди не тратят монеты</div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">{funnel?.redeem_confirmed}</div>
                    <div className="sgpRowSub">
                      rate:{' '}
                      {fmtPct(funnel && funnel.recorded ? funnel.redeem_confirmed / funnel.recorded : 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SgCardContent>
        </SgCard>
      ) : null}

      {/* ===== TAB: CASHIERS ===== */}
      {tab === 'cashiers' ? (
        <SgCard tone="neutral">
          <SgCardHeader>
            <div>
              <SgCardTitle>Кассиры</SgCardTitle>
              <SgCardSub>hover подсветка как “Склад”</SgCardSub>
            </div>
          </SgCardHeader>
          <SgCardContent>
            {isLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="sgpRow">
                    <div className="sgpRowLeft">
                      <div>
                        <div className="sgpRowTitle">—</div>
                        <div className="sgpRowMeta">—</div>
                      </div>
                    </div>
                    <div className="sgpRowRight">
                      <div className="sgpRowVal">—</div>
                      <div className="sgpRowSub">—</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              topCashiers.map((c) => {
                const tone: HealthTone =
                  c.cancel_rate >= 0.12 || c.confirm_rate <= 0.86
                    ? 'bad'
                    : c.cancel_rate >= 0.08 || c.confirm_rate <= 0.9
                      ? 'warn'
                      : 'good';

                const tip =
                  c.alerts?.length
                    ? c.alerts.join(' / ')
                    : tone === 'bad'
                      ? 'Риск: проверь отмены/подтверждения'
                      : tone === 'warn'
                        ? 'Есть отклонения — стоит проверить'
                        : 'Всё норм по метрикам';

                return (
                  <div
                    key={c.cashier_label}
                    className={'sgpRow ' + (tone === 'bad' ? 'is-bad' : tone === 'warn' ? 'is-warn' : 'is-good')}
                  >
                    <div className="sgpRowLeft">
                      <div>
                        <div className="sgpRowTitle">{c.cashier_label}</div>
                        <div className="sgpRowMeta">
                          выручка: {moneyFromCent(c.revenue_cents, currency)} · заказы: {c.orders} · confirm:{' '}
                          {fmtPct(c.confirm_rate)} · cancel: {fmtPct(c.cancel_rate)}
                        </div>
                        <div className="sgpRowMeta">{tip}</div>
                      </div>
                    </div>
                    <div className="sgpRowRight">
                      <div className="sgpRowVal">{c.median_confirm_minutes.toFixed(1)} мин</div>
                      <div className="sgpRowSub">{tone === 'bad' ? 'риск' : tone === 'warn' ? 'внимание' : 'норма'}</div>
                    </div>
                  </div>
                );
              })
            )}
          </SgCardContent>
        </SgCard>
      ) : null}

      {/* ===== TAB: CUSTOMERS ===== */}
      {tab === 'customers' ? (
        <SgCard tone="neutral">
          <SgCardHeader>
            <div>
              <SgCardTitle>Клиенты</SgCardTitle>
              <SgCardSub>сегменты: new / repeat / saver / spender</SgCardSub>
            </div>
          </SgCardHeader>
          <SgCardContent>
            {isLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="sgpRow">
                    <div className="sgpRowLeft">
                      <div>
                        <div className="sgpRowTitle">—</div>
                        <div className="sgpRowMeta">—</div>
                      </div>
                    </div>
                    <div className="sgpRowRight">
                      <div className="sgpRowVal">—</div>
                      <div className="sgpRowSub">—</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              topCustomers.map((c) => {
                const tone: HealthTone = c.segment === 'saver' ? 'warn' : 'good';

                const alert =
                  c.segment === 'saver'
                    ? 'Накопил и не тратит — пуши на списание'
                    : c.segment === 'spender'
                      ? 'Часто тратит — VIP'
                      : c.segment === 'repeat'
                        ? 'Повторный клиент'
                        : 'Новый клиент';

                return (
                  <div key={c.customer_label} className={'sgpRow ' + (tone === 'warn' ? 'is-warn' : 'is-good')}>
                    <div className="sgpRowLeft">
                      <div>
                        <div className="sgpRowTitle">{c.customer_label}</div>
                        <div className="sgpRowMeta">
                          LTV: {moneyFromCent(c.ltv_cents, currency)} · заказов: {c.orders} · last: {c.last_seen} · сегмент:{' '}
                          {c.segment}
                        </div>
                        <div className="sgpRowMeta">{alert}</div>
                      </div>
                    </div>
                    <div className="sgpRowRight">
                      <div className="sgpRowVal">{moneyFromCent(c.revenue_cents, currency)}</div>
                      <div className="sgpRowSub">за период</div>
                    </div>
                  </div>
                );
              })
            )}
          </SgCardContent>
        </SgCard>
      ) : null}

      {/* ===== TAB: LIVE ===== */}
      {tab === 'live' ? (
        <SgCard tone="neutral">
          <SgCardHeader right={<SgStatusBadge tone="dev" label="DEV" />}>
            <div>
              <SgCardTitle>Live лента</SgCardTitle>
              <SgCardSub>потом будет реально из воркера</SgCardSub>
            </div>
          </SgCardHeader>
          <SgCardContent>
            {isLoading ? (
              <ShimmerLine />
            ) : (
              <>
                <div className="sgpRow is-good">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">sale_recorded</div>
                      <div className="sgpRowMeta">
                        Покупка 520 ₽ · cashback +31 мон · кассир #2 · 12:44
                      </div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">ok</div>
                    <div className="sgpRowSub">event</div>
                  </div>
                </div>

                <div className="sgpRow is-good">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">redeem_confirmed</div>
                      <div className="sgpRowMeta">
                        Списано 120 мон · net +12 ₽ · кассир #1 · 12:40
                      </div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">vip</div>
                    <div className="sgpRowSub">segment</div>
                  </div>
                </div>

                <div className="sgpRow is-warn">
                  <div className="sgpRowLeft">
                    <div>
                      <div className="sgpRowTitle">cashback_pending</div>
                      <div className="sgpRowMeta">
                        Ждёт подтверждения · кассир #2 · 12:33
                      </div>
                    </div>
                  </div>
                  <div className="sgpRowRight">
                    <div className="sgpRowVal">risk</div>
                    <div className="sgpRowSub">alert</div>
                  </div>
                </div>
              </>
            )}
          </SgCardContent>
        </SgCard>
      ) : null}
    </SgPage>
  );
}
