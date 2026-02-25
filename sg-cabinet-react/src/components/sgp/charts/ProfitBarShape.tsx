import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// ===== SINGLE SOURCE OF TRUTH (bars look) =====
// крутилки "дорого/стекло"
const TINT = 0.34;       // 0.28..0.42 (выше = сочнее, но всё ещё стекло)
const HIGHLIGHT = 0.38;  // 0.28..0.55
const SHADOW = 0.09;     // 0.06..0.14

// нормальные, не болотный/не розовый
const POS_RGB: [number, number, number] = [16, 185, 129]; // emerald
const NEG_RGB: [number, number, number] = [239, 68, 68];  // red

// единая мягкая обводка (дороже, чем цветная)
const STROKE = 'rgba(15,23,42,.10)';

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Premium glass bar (single source):
 * - чистый цвет (emerald/red) без мути
 * - тонкая единая обводка
 * - блик + лёгкая тень
 * - корректная отрисовка отрицательных значений
 */
export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  // меньше скругление => не "сосиски"
  const rx = Math.round(clamp(w * 0.10, 3, 8));

  return (
    <g>
      {/* воздух / тень */}
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
        stroke={STROKE}
        strokeWidth={0.9}
        shapeRendering="geometricPrecision"
      />

      {/* блик */}
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

      {/* линза снизу */}
      <rect
        x={x + 1}
        y={yy + Math.max(0, h - 4)}
        width={Math.max(0, w - 2)}
        height={Math.min(3, h)}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill="rgba(255,255,255,.26)"
        opacity={0.20}
      />

      {/* очень тонкий цветовой edge сверху (чистый оттенок, без мути) */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill={rgba(baseRGB, 0.85)}
        opacity={0.14}
      />
    </g>
  );
}
