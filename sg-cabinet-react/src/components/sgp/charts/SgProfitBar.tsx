import React from 'react';
import { Bar, Cell } from 'recharts';
import { sgpChartTheme } from './theme';

export function SgProfitBar({
  data,
  dataKey,
  radius = 10,
  name,
  barSize = 14,
}: {
  data: any[];
  dataKey: string;
  radius?: number;
  name?: string;
  barSize?: number;
}) {
  const t = sgpChartTheme();

  return (
    <Bar
      dataKey={dataKey}
      name={name}
      barSize={barSize}
      isAnimationActive={false}
    >
      {data.map((row, i) => {
        const v = Number(row?.[dataKey]) || 0;

        // premium: rounded only on “free” side
        // + : round top corners
        // - : round bottom corners
        const r = Math.max(0, radius);
        const rad: [number, number, number, number] =
          v >= 0 ? [r, r, 0, 0] : [0, 0, r, r];

        const fill = v >= 0 ? t.pos : t.neg;

        return (
          <Cell
            key={i}
            fill={fill}
            fillOpacity={0.55}                 // <-- “дорого”: полупрозрачность
            stroke="rgba(15,23,42,.14)"        // <-- лёгкий контур
            strokeOpacity={0.35}
            strokeWidth={1}
            radius={rad as any}                // Cell принимает radius в recharts 2.x
          />
        );
      })}
    </Bar>
  );
}


