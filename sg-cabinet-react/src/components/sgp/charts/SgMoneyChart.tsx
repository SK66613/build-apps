import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  Line,
  Bar,
} from 'recharts';

import { ProfitBarShape } from './ProfitBarShape';

type Datum = {
  date: string; // ISO YYYY-MM-DD
  revenue?: number; // cents
  payout?: number;  // cents
  profit?: number;  // cents
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
 * Wide bars with tiny gap:
 * - barSize ~ per-cell width minus 1..2px
 */
function barSizeWide(containerW: number, points: number) {
  if (!containerW || points <= 0) return 12;

  const usable = Math.max(0, containerW - 24 - 14 - 18); // margin-ish
  const per = usable / points;

  // хотим почти впритык, но оставить 1-2px “разрез” между столбиками
  const raw = per - 2;

  // safety clamp
  return Math.round(clamp(raw, 6, 999));
}

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

  const barSize = barSizeWide(width, points);

  return (
    <div ref={ref} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 18, right: 14, left: 6, bottom: 0 }}
          // tiny gaps between categories/bars:
          barGap={1}
          barCategoryGap={1}
        >
          <CartesianGrid stroke={theme.grid} strokeDasharray="4 6" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={(v) => fmtTick(String(v || ''))}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: 'rgba(15,23,42,.10)' }}
            tickLine={{ stroke: 'rgba(15,23,42,.10)' }}
          />

          <YAxis
            tickFormatter={(v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return '';
              return String(Math.round(n / 100));
            }}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: 'rgba(15,23,42,.10)' }}
            tickLine={{ stroke: 'rgba(15,23,42,.10)' }}
          />

          <Tooltip
            formatter={(val: any, name: any) => {
              const v = Number(val);
              if (!Number.isFinite(v)) return [val, name];

              if (name === 'profit') return [moneyFmt(v, currency), 'Прибыль/день'];
              if (name === 'revenue') return [moneyFmt(v, currency), 'Выручка/день'];
              if (name === 'payout') return [moneyFmt(v, currency), 'Расход/день'];
              if (name === 'cum_profit') return [moneyFmt(v, currency), 'Кум. прибыль'];

              return [val, name];
            }}
            labelFormatter={(_: any, payload: any) => {
              const d = payload?.[0]?.payload?.date;
              return d ? `Дата ${d}` : 'Дата';
            }}
          />

          {showRevenue ? (
            <Area
              type="monotone"
              dataKey="revenue"
              name="revenue"
              stroke="var(--accent2)"
              strokeWidth={2}
              fill="var(--accent2)"
              fillOpacity={0.10}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : null}

          {showPayout ? (
            <Line
              type="monotone"
              dataKey="payout"
              name="payout"
              dot={false}
              stroke="rgba(148,163,184,.85)"
              strokeWidth={2}
              opacity={0.9}
            />
          ) : null}

          {showProfitBars ? (
            <Bar
              dataKey="profit"
              name="profit"
              barSize={barSize}
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
              stroke="var(--accent2)"
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.55}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
