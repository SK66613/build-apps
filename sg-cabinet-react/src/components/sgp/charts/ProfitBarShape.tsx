import React from 'react';

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Clean premium bars (no gimmicks)
 * - четкие цвета
 * - легкая прозрачность (из-за нее красный станет чуть розоватым)
 * - одна мягкая обводка
 * - прямые углы (без радиусов)
 */

// прозрачность заливки (меньше = чище, больше = сочнее)
const ALPHA = 0.32;

// ✅ ЧИСТЫЙ ЗЕЛЕНЫЙ (яркий, не болотный)
const POS_RGB: [number, number, number] = [34, 197, 94];   // emerald/green

// ✅ ЧИСТЫЙ КРАСНЫЙ (при ALPHA станет чуть “розоватым”)
const NEG_RGB: [number, number, number] = [239, 68, 68];   // red

// одна мягкая обводка (дороже, чем цветная)
const STROKE = 'rgba(15,23,42,.08)';

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  return (
    <rect
      x={x}
      y={yy}
      width={w}
      height={h}
      rx={0}
      ry={0}
      fill={rgba(baseRGB, ALPHA)}
      stroke={STROKE}
      strokeWidth={1}
      shapeRendering="geometricPrecision"
    />
  );
}
