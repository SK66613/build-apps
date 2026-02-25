import React from 'react';
import { Bar } from 'recharts';
import { ProfitBarShape } from './ProfitBarShape';

export function SgProfitBar({
  dataKey,
  name,
  barSize,
}: {
  dataKey: string;
  name?: string;
  barSize?: number;
}) {
  return (
    <Bar
      dataKey={dataKey}
      name={name}
      barSize={barSize}
      isAnimationActive={false}
      shape={<ProfitBarShape />}
    />
  );
}
