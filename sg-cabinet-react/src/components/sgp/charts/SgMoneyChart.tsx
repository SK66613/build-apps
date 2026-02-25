import React from 'react';
import { ChartFrame } from './ChartFrame';

import { RevenueArea } from './series/RevenueArea';
import { PayoutLine } from './series/PayoutLine';
import { ProfitBars } from './series/ProfitBars';
import { CumLine } from './series/CumLine';

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

// ✅ почти “впритык”, но с микро-зазором через barGap=1 в ChartFrame
function barSizeTight(containerW: number, points: number) {
  if (!containerW || points <= 0) return 12;

  const usable = Math.max(0, containerW - 24 - 14 - 18);
  const per = usable / points;

  const raw = per * 0.98;
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
  const barSize = barSizeTight(width, points);

  return (
    <div ref={ref} style={{ height }}>
      <ChartFrame
        data={data as any}
        height={height}
        theme={theme}
        // ✅ маленькое расстояние между столбиками
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
        {showRevenue ? <RevenueArea /> : null}
        {showPayout ? <PayoutLine /> : null}
        {showProfitBars ? <ProfitBars barSize={barSize} /> : null}
        {showCum ? <CumLine /> : null}
      </ChartFrame>
    </div>
  );
}
