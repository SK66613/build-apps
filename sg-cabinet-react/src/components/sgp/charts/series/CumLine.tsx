import React from 'react';
import { Line } from 'recharts';

export function CumLine() {
  return (
    <Line
      type="monotone"
      dataKey="cum_profit"
      name="cum_profit"
      dot={false}
      stroke="var(--accent2)"
      strokeWidth={2}
      strokeDasharray="6 6"
      opacity={0.52}
      isAnimationActive={false}
    />
  );
}
