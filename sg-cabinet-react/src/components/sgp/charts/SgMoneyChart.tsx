// sg-cabinet-react/src/components/sgp/charts/SgMoneyChart.tsx
import React from 'react';
import { Area, Line, Bar } from 'recharts';

import { ChartFrame } from './ChartFrame';
import { ProfitBarShape } from './ProfitBarShape';

type Datum = {
  date: string; // ISO YYYY-MM-DD
  revenue?: number; // cents
  payout?: number; // cents
  profit?: number; // cents
  cum_profit?: number; // cents
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
 * ✅ Широкие бары + маленький зазор между ними
 * Идея: barSize ≈ ширина категории - 1px
 */
function barSizeTight(containerW: number, points: number) {
  if (!containerW || points <= 0) return 10;

  // примерно "полезная" ширина (оси/поля)
  const usable = Math.max(0, containerW - 24 - 14 - 18);
  const per = usable / points;

  // оставляем микро-зазор
  const raw = per - 1;

  return Math.round(clamp(raw, 4, 999));
}

// ===== Premium line tokens (правь только тут) =====
const LINE = {
  // Выручка: спокойный premium-blue
  revenueStroke: 'rgba(37, 99, 235, 0.92)',
  revenueFill: 'rgba(37, 99, 235, 0.08)',

  // Расход: нейтральный ink/slate
  payoutStroke: 'rgba(15, 23, 42, 0.42)',

  // Кумулятив: тёплый amber/orange (дорого рядом с green/red барами)
  cumStroke: 'rgba(245, 158, 11, 0.82)',
  cumDash: '6 6',
};

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
        barGap={1} // ✅ маленькое расстояние между барами
        barCategoryGap={0} // ✅ почти вплотную по категориям
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
        {showRevenue ? (
          <Area
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke={LINE.revenueStroke}
            strokeWidth={2}
            fill={LINE.revenueFill}
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ) : null}

        {showPayout ? (
          <Line
            type="monotone"
            dataKey="payout"
            name="payout"
            dot={false}
            stroke={LINE.payoutStroke}
            strokeWidth={2}
            opacity={1}
            isAnimationActive={false}
          />
        ) : null}

        {showProfitBars ? (
          <Bar
            dataKey="profit"
            name="profit"
            barSize={barSize} // ✅ ширина управляется здесь
            shape={<ProfitBarShape />}
            isAnimationActive={false}
          />
        ) : null}

        {showCum ? (
          <Line
            type="monotone"
            dataKey="cum_profit"
            name="cum_profit"
            dot={false}
            stroke={LINE.cumStroke}
            strokeWidth={2}
            strokeDasharray={LINE.cumDash}
            opacity={1}
            isAnimationActive={false}
          />
        ) : null}
      </ChartFrame>
    </div>
  );
}
