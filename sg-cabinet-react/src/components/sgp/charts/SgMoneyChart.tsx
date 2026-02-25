// sg-cabinet-react/src/components/sgp/charts/SgMoneyChart.tsx
import React from 'react';
import { Area, Line, Bar } from 'recharts';

import { ChartFrame } from './ChartFrame';
import { ProfitBarShape } from './ProfitBarShape';

type Datum = {
  date: string;
  revenue?: number;
  payout?: number;
  profit?: number;
  cum_profit?: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function useResizeWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [w, setW] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const ww = entries[0]?.contentRect?.width ?? 0;
      setW(Math.round(ww));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width: w };
}

/**
 * Широкие бары + микро-зазор
 */
function barSizeTight(containerW: number, points: number) {
  if (!containerW || points <= 0) return 10;

  const usable = Math.max(0, containerW - 24 - 14 - 18);
  const per = usable / points;

  const raw = per - 1;
  return Math.round(clamp(raw, 4, 999));
}

/* ===============================
   🎨 PREMIUM LINE PALETTE
   =============================== */

// 🟠 Выручка — тёплый дорогой orange
const REVENUE_STROKE = 'rgba(249, 115, 22, 0.95)';   // orange-500
const REVENUE_FILL   = 'rgba(249, 115, 22, 0.10)';   // прозрачная подложка

// ⚫ Расход — нейтральный graphite
const PAYOUT_STROKE  = 'rgba(15, 23, 42, 0.45)';

// ⚫ Кумулятив — чёрный аккуратный пунктир
const CUM_STROKE     = 'rgba(15, 23, 42, 0.85)';
const CUM_DASH       = '6 6';

export function SgMoneyChart({
  data,
  currency,
  theme,
  height = 340,

  showRevenue = true,
  showPayout = false,
  showProfitBars = true,
  showCum = true,

  fmtTick,
  moneyFmt,
}: {
  data: Datum[];
  currency: string;
  theme: { grid: string; axis: string };
  height?: number;

  showRevenue?: boolean;
  showPayout?: boolean;
  showProfitBars?: boolean;
  showCum?: boolean;

  fmtTick: (iso: string) => string;
  moneyFmt: (cent: number, currency: string) => string;
}) {
  const { ref, width } = useResizeWidth<HTMLDivElement>();
  const points = data?.length || 0;
  const barSize = barSizeTight(width, points);

  return (
    <div ref={ref} style={{ height }}>
      <ChartFrame
        data={data}
        height={height}
        theme={theme}
        barGap={1}
        barCategoryGap={0}
        fmtTick={fmtTick}
        yTickFormatter={(v) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return '';
          return String(Math.round(n / 100));
        }}
        tooltipFormatter={(val: any, name: any) => {
          const v = Number(val);
          if (!Number.isFinite(v)) return [val, name];

          if (name === 'profit') return [moneyFmt(v, currency), 'Прибыль/день'];
          if (name === 'revenue') return [moneyFmt(v, currency), 'Выручка/день'];
          if (name === 'payout') return [moneyFmt(v, currency), 'Расход/день'];
          if (name === 'cum_profit') return [moneyFmt(v, currency), 'Кум. прибыль'];

          return [val, name];
        }}
        tooltipLabelFormatter={(_: any, payload: any) => {
          const d = payload?.[0]?.payload?.date;
          return d ? `Дата ${d}` : 'Дата';
        }}
      >
        {/* 🟠 Выручка */}
        {showRevenue ? (
          <Area
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke={REVENUE_STROKE}
            strokeWidth={2.2}
            fill={REVENUE_FILL}
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ) : null}

        {/* ⚫ Расход */}
        {showPayout ? (
          <Line
            type="monotone"
            dataKey="payout"
            name="payout"
            dot={false}
            stroke={PAYOUT_STROKE}
            strokeWidth={2}
            opacity={1}
            isAnimationActive={false}
          />
        ) : null}

        {/* 🟢/🔴 Profit bars */}
        {showProfitBars ? (
          <Bar
            dataKey="profit"
            name="profit"
            barSize={barSize}
            shape={<ProfitBarShape />}
            isAnimationActive={false}
          />
        ) : null}

        {/* ⚫ Кумулятив — чёрный пунктир */}
        {showCum ? (
          <Line
            type="monotone"
            dataKey="cum_profit"
            name="cum_profit"
            dot={false}
            stroke={CUM_STROKE}
            strokeWidth={2}
            strokeDasharray={CUM_DASH}
            opacity={1}
            isAnimationActive={false}
          />
        ) : null}
      </ChartFrame>
    </div>
  );
}
