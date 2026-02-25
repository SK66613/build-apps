import React from 'react';
import { Area } from 'recharts';

export function RevenueArea() {
  return (
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
      isAnimationActive={false}
    />
  );
}
