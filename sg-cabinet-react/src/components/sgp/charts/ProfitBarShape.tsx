import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Lime + Rose PREMIUM (glass) bars
 * - тонкая единая обводка
 * - лёгкая тень “воздух”
 * - верхний highlight (дороже)
 * - микро edge-акцент сверху цветом (почти незаметно, но “премиум”)
 */

// “стекло” (насыщенность)
const ALPHA = 0.18;       // 0.18..0.30
const HIGHLIGHT = 0.38;   // 0.28..0.55
const SHADOW = 0.10;      // 0.06..0.14

// 🟢 Ultra Neon Green
const POS_RGB: [number, number, number] = [66, 255, 0];

// 🔴 Ultra Neon Red
const NEG_RGB: [number, number, number] = [255, 0, 60];

// единая “дорогая” обводка (НЕ цветная)
const STROKE = 'rgba(15,23,42,.07)';

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  // меньше скругление => меньше “сосисок” при широких барах
  const rx = Math.round(clamp(w * 0.08, 3, 7));

  // размеры бликов/линзы
  const hiH = Math.max(0, Math.min(12, h * 0.22));
  const lensH = Math.min(3, h);

  return (
    <g>
      {/* 1) воздух: мягкая тень вниз */}
      <rect
        x={x}
        y={yy + 1}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill="rgba(15,23,42,.12)"
        opacity={SHADOW}
      />

      {/* 2) стекло: основной слой */}
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={0}
        ry={0}
        fill={rgba(baseRGB, ALPHA)}
        stroke={STROKE}
        strokeWidth={0.85}
        shapeRendering="geometricPrecision"
      />

      {/* 3) верхний блик (делает “дороже”) */}
      <rect
        x={x + 1}
        y={yy + 1}
        width={Math.max(0, w - 2)}
        height={hiH}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill="rgba(255,255,255,.92)"
        opacity={HIGHLIGHT}
      />

      {/* 4) линза снизу: микро отражение */}
      <rect
        x={x + 1}
        y={yy + Math.max(0, h - 4)}
        width={Math.max(0, w - 2)}
        height={lensH}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill="rgba(255,255,255,.26)"
        opacity={0.22}
      />

      {/* 5) тонкий цветовой edge сверху (почти незаметный акцент) */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={Math.max(2, rx - 2)}
        ry={Math.max(2, rx - 2)}
        fill={rgba(baseRGB, 0.70)}
        opacity={0.16}
      />
    </g>
  );
}
