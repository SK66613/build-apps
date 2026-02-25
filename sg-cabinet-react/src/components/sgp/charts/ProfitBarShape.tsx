import React from 'react';

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Premium "glass" bar:
 * - почти прозрачная заливка (без мути)
 * - тонкая единая обводка
 * - внутренний блик сверху
 * - лёгкая тень вниз
 */
export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;

  // ✅ единые цвета из токенов (скручиваешь в scss один раз)
  const pos = cssVar('--sgp-chart-pos', 'rgba(34,197,94,.32)');
  const neg = cssVar('--sgp-chart-neg', 'rgba(239,68,68,.30)');

  // “стекло”: делаем не плотную заливку, а очень лёгкий тинт
  // (тут можно крутить альфу)
  const fill = isNeg ? 'rgba(239,68,68,.06)' : 'rgba(34,197,94,.06)';

  // ✅ обводка одна, очень мягкая
  const stroke = cssVar('--sgp-chart-stroke', 'rgba(15,23,42,.10)');

  // чтобы не было капсул при широких барах
  const rx = Math.round(clamp(w * 0.12, 4, 9));

  // блик сверху можно чуть подкрашивать pos/neg (даёт “дороже”)
  const highlight = isNeg ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.62)';

  return (
    <g>
      {/* мягкая тень/воздух */}
      <rect
        x={x}
        y={yy + 1}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill="rgba(15,23,42,.08)"
        opacity={0.10}
      />

      {/* основное стекло */}
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.9}
        shapeRendering="geometricPrecision"
      />

      {/* верхний блик */}
      <rect
        x={x + 1}
        y={yy + 1}
        width={Math.max(0, w - 2)}
        height={Math.max(0, Math.min(12, h * 0.22))}
        rx={Math.max(3, rx - 2)}
        ry={Math.max(3, rx - 2)}
        fill={highlight}
        opacity={0.42}
      />

      {/* микро-линия внизу (линза) */}
      <rect
        x={x + 1}
        y={yy + Math.max(0, h - 4)}
        width={Math.max(0, w - 2)}
        height={Math.min(3, h)}
        rx={Math.max(3, rx - 2)}
        ry={Math.max(3, rx - 2)}
        fill="rgba(255,255,255,.22)"
        opacity={0.22}
      />

      {/* тонкий edge-акцент по знаку (почти не заметно, но “читабельно”) */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={Math.max(3, rx - 2)}
        ry={Math.max(3, rx - 2)}
        fill={isNeg ? neg : pos}
        opacity={0.22}
      />
    </g>
  );
}
