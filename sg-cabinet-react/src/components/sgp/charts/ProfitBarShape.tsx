// sg-cabinet-react/src/components/sgp/charts/ProfitBarShape.tsx
import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * DEBUG MODE: solid bars (no glass, no opacity tricks)
 * Purpose: проверить “истинный” цвет без влияния стекла.
 */
const POS_RGB: [number, number, number] = [16, 185, 129]; // emerald
const NEG_RGB: [number, number, number] = [239, 68, 68];  // red

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  // маленькое скругление чтобы не “колбаса”
  const rx = Math.round(clamp(w * 0.06, 2, 6));

  return (
    <rect
      x={x}
      y={yy}
      width={w}
      height={h}
      rx={rx}
      ry={rx}
      fill={rgba(baseRGB, 1)} // 100% solid
      stroke="none"
      shapeRendering="geometricPrecision"
    />
  );
}
