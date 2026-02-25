import React from 'react';
import { Bar } from 'recharts';
import { ProfitBarShape } from '../ProfitBarShape';

export function ProfitBars({ barSize }: { barSize: number }) {
  return (
    <Bar
      dataKey="profit"
      name="profit"
      barSize={barSize}
      shape={<ProfitBarShape />}
      isAnimationActive={false}
    />
  );
}
