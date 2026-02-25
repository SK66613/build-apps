import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * iOS-premium glass bars
 * - чистые iOS-цвета (emerald/red)
 * - прозрачное стекло (без “мути”)
 * - единая мягкая обводка
 * - аккуратный highlight сверху
 *
 * Крутилки (если захочешь):
 *  - TINT: плотность заливки (0.16..0.34)
 *  - HIGHLIGHT: яркость блика (0.30..0.55)
 *  - STROKE_A: заметность контура (0.05..0.12)
 */
const TINT = 0.26;
const HIGHLIGHT = 0.42;
const SHADOW = 0.10;

const POS_RGB: [number, number, number] = [16, 185, 129]; // emerald (iOS-ish)
const NEG_RGB: [number, number, number] = [239, 68, 68];  // red (clean)
const STROKE_A = 0.09; // единый мягкий контур

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  // чтобы не выглядело “сосиской” даже при широких барах
  const rx = Math.round(clamp(w * 0.10, 3, 8));

  // единая (не цветная) обводка => iOS / premium
  const stroke = `rgba(15, 23, 42, ${STROKE_A})`;

  return (
    <g>
      {/* лёгкая тень вниз (воздух) */}
      <rect
        x={x}
        y={yy + 1}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill="rgba(15,23,42,.14)"
        opacity={SHADOW}
      />

      {/* стекло */}
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={rgba(baseRGB, TINT)}
        stroke={stroke}
        strokeWidth={0.9}
        shapeRendering="geometricPrecision"
      />

      {/* блик сверху */}
      <rect
        x={x + 1}
        y={yy + 1}
        width={Math.max(0, w - 2)}
        height={Math.max(0, Math.min(12, h * 0.22))}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill="rgba(255,255,255,.90)"
        opacity={HIGHLIGHT}
      />

      {/* микро “линза” снизу */}
      <rect
        x={x + 1}
        y={yy + Math.max(0, h - 4)}
        width={Math.max(0, w - 2)}
        height={Math.min(3, h)}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill="rgba(255,255,255,.26)"
        opacity={0.22}
      />

      {/* тонкая цветовая кромка сверху (почти незаметно, но чище) */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill={rgba(baseRGB, 0.70)}
        opacity={0.18}
      />
    </g>
  );
}
