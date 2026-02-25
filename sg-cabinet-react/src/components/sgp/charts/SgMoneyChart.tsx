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
 * ✅ Колонки “как в топ-дашбордах”:
 * - barSize имеет МАКС ширину (maxBar)
 * - когда дат мало, вместо “сосисок” растёт gap (воздух между датами)
 * - когда дат много, barSize уменьшается, но не падает ниже minBar
 */
function calcBarLayout(containerW: number, points: number) {
  const minBar = 8;   // не палки
  const maxBar = 20;  // максимальная ширина столбика на дату (подкрути 18/20/22)

  if (!containerW || points <= 0) {
    return { barSize: 12, categoryGapPx: 14 };
  }

  // примерная “полезная ширина”
  const usable = Math.max(0, containerW - 24 - 14 - 18);

  // ширина одной “категории” (одной даты)
  const per = usable / points;

  // хотим, чтобы внутри категории был бар + gap вокруг
  // gap делаем пикселями: на малом points увеличится, на большом уменьшится
  const categoryGapPx = Math.round(clamp(per * 0.45, 10, 26));

  // доступно под бар внутри одной категории с учетом gap
  const availableForBar = per - categoryGapPx;

  // бар берём как 90% доступного, но ограничиваем min/max
  const barSize = Math.round(clamp(availableForBar * 0.90, minBar, maxBar));

  return { barSize, categoryGapPx };
}

/** Столбики (не “сосиски”): чуть меньше радиус */
function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;
  const v = Number(value || 0);

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const fill = v >= 0 ? 'rgba(34,197,94,.22)' : 'rgba(239,68,68,.20)';
  const stroke = v >= 0 ? 'rgba(34,197,94,.55)' : 'rgba(239,68,68,.55)';

  // радиус не должен превращать бар в “капсулу”
  const rx = Math.round(clamp(w * 0.18, 4, 8));

  return (
    <g>
      <rect x={x} y={yy} width={w} height={h} rx={rx} ry={rx} fill={fill} />
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, h - 1)}
        rx={rx}
        ry={rx}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1}
      />
    </g>
  );
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

  const { barSize, categoryGapPx } = React.useMemo(
    () => calcBarLayout(width, points),
    [width, points]
  );

  return (
    <div ref={ref} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 14, left: 6, bottom: 0 }}>
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
              barGap={2}
              barCategoryGap={categoryGapPx} // ✅ пиксели, не проценты
              shape={<ProfitBarShape />}
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
