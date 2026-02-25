import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type Datum = Record<string, any>;

function DefaultTooltip({
  active,
  label,
  payload,
  formatter,
  labelFormatter,
}: any) {
  if (!active || !payload?.length) return null;

  const title = labelFormatter ? labelFormatter(label, payload) : String(label ?? '');

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(15,23,42,.12)',
        background: 'rgba(255,255,255,.94)',
        boxShadow: '0 18px 42px rgba(15,23,42,.14)',
        padding: '10px 12px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          fontWeight: 900,
          marginBottom: 6,
          color: 'rgba(15,23,42,.84)',
          fontSize: 13,
        }}
      >
        {title}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        {payload.map((p: any, i: number) => {
          const rawName = p?.name ?? p?.dataKey ?? '';
          const rawVal = p?.value;

          const out = formatter ? formatter(rawVal, rawName, p, i) : [rawVal, rawName];
          const val = Array.isArray(out) ? out[0] : out;
          const name = Array.isArray(out) ? out[1] : rawName;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                fontWeight: 800,
                fontSize: 12,
                color: 'rgba(15,23,42,.72)',
              }}
            >
              <span style={{ opacity: 0.9 }}>{String(name)}</span>
              <span style={{ color: 'rgba(15,23,42,.86)' }}>{String(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartFrame({
  data,
  height = 340,
  theme,
  barGap = 1,          // ✅ микро-расстояние между барами
  barCategoryGap = 0,  // ✅ почти впритык по категориям
  fmtTick,
  yTickFormatter,
  tooltipFormatter,
  tooltipLabelFormatter,
  children,
}: {
  data: Datum[];
  height?: number;
  theme: { grid: string; axis: string };

  barGap?: number;
  barCategoryGap?: number;

  fmtTick: (iso: string) => string;
  yTickFormatter: (v: any) => string;

  tooltipFormatter?: (val: any, name: any, p?: any, i?: any) => any;
  tooltipLabelFormatter?: (label: any, payload: any) => string;

  children: React.ReactNode;
}) {
  return (
    <div style={{ height, background: 'transparent' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 18, right: 14, left: 6, bottom: 0 }}
          barGap={barGap}
          barCategoryGap={barCategoryGap}
        >
          <CartesianGrid
            stroke={theme.grid}
            strokeDasharray="4 6"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tickFormatter={(v) => fmtTick(String(v || ''))}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: 'rgba(15,23,42,.10)' }}
            tickLine={{ stroke: 'rgba(15,23,42,.10)' }}
          />

          <YAxis
            tickFormatter={yTickFormatter}
            tick={{ fill: theme.axis, fontSize: 12 }}
            axisLine={{ stroke: 'rgba(15,23,42,.10)' }}
            tickLine={{ stroke: 'rgba(15,23,42,.10)' }}
          />

          <Tooltip
            content={
              <DefaultTooltip
                formatter={tooltipFormatter}
                labelFormatter={tooltipLabelFormatter}
              />
            }
          />

          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
