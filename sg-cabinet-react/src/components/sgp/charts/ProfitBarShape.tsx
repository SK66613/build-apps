// sg-cabinet-react/src/components/sgp/charts/ProfitBarShape.tsx
import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Minimal premium bars
 * - чистый emerald / red
 * - только прозрачность
 * - без стекла
 * - без бликов
 * - без теней
 */

// 👇 крути 0.25 – 0.40
const ALPHA = 0.32;

// iOS-like чистые цвета
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

  // аккуратное скругление
  const rx = Math.round(clamp(w * 0.08, 3, 7));

  return (
    <rect
      x={x}
      y={yy}
      width={w}
      height={h}
      rx={rx}
      ry={rx}
      fill={rgba(baseRGB, ALPHA)}
      stroke="rgba(15,23,42,.08)"   // мягкий единый контур (можешь убрать)
      strokeWidth={0.8}
      shapeRendering="geometricPrecision"
    />
  );
}
