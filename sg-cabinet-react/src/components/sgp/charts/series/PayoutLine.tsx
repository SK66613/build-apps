import React from 'react';
import { Line } from 'recharts';

export function PayoutLine() {
  return (
    <Line
      type="monotone"
      dataKey="payout"
      name="payout"
      dot={false}
      stroke="rgba(148,163,184,.85)"
      strokeWidth={2}
      opacity={0.85}
      isAnimationActive={false}
    />
  );
}
