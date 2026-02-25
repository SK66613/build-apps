import React from 'react';

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  // Recharts может дать отрицательную высоту/координаты — нормализуем
  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const isNeg = Number(value) < 0;

  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h; // если отрицательный — подтянуть вверх

  if (w <= 0 || h <= 0) return null;

  const rx = Math.min(12, Math.max(6, Math.round(w * 0.28)));
  const fill = isNeg ? 'url(#sgpBarNeg)' : 'url(#sgpBarPos)';

  return (
    <g>
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke="rgba(15,23,42,.08)"
        strokeWidth={1}
      />
      {/* лёгкий “внутренний блик” */}
      <rect
        x={x + 1}
        y={yy + 1}
        width={Math.max(0, w - 2)}
        height={Math.max(0, Math.min(10, h * 0.22))}
        rx={Math.max(4, rx - 2)}
        ry={Math.max(4, rx - 2)}
        fill="rgba(255,255,255,.22)"
        opacity={0.55}
      />
    </g>
  );
}
