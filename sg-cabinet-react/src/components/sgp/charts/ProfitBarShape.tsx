import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Lime + Rose premium bars
 */

// прозрачность
const ALPHA = 0.18;

// 🟢 НЕОН-ЛАЙМ (кислотный)
const POS_RGB: [number, number, number] = [190, 242, 100]; // neon lime

// 🌸 НЕОН-РОЗОВЫЙ (кислотный)
const NEG_RGB: [number, number, number] = [251, 113, 209]; // neon pink

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

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
      stroke="rgba(15,23,42,.06)"
      strokeWidth={0.8}
      shapeRendering="geometricPrecision"
    />
  );
}
