import React from 'react';
import { Bar, Cell } from 'recharts';
import { sgpChartTheme } from './theme';

export function SgProfitBar({
  data,
  dataKey,
  radius = 8,
  name,
}: {
  data: any[];
  dataKey: string;
  radius?: number;
  name?: string;
}) {
  const t = sgpChartTheme();

  return (
    <Bar dataKey={dataKey} name={name} radius={[radius, radius, radius, radius]}>
      {data.map((row, i) => {
        const v = Number(row?.[dataKey]) || 0;
        return <Cell key={i} fill={v >= 0 ? t.pos : t.neg} />;
      })}
    </Bar>
  );
}
