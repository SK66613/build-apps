// sg-cabinet-react/src/components/sgp/charts/ProfitBarShape.tsx
import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Streamlined "premium glass" bar:
 * - убрана верхняя шапочка / блик
 * - убрана цветная тонкая edge
 * - оставлен градиент для стекла (чтобы сохранить глубину)
 * - очень тонкая нейтральная обводка
 * - маленькое закругление (rx = 2..4)
 */

// ====== COLORS (правь только тут) ======
const POS_RGB: [number, number, number] = [34, 197, 94];   // зеленый
const NEG_RGB: [number, number, number] = [239, 68, 68];   // красный

// ====== MIX SETTINGS ======
const GLASS_A = 0.18;       // заливка стеклом
const GLASS_BOTTOM_K = 0.56;
const STROKE_A = 0.07;      // очень тонкая нейтральная рамка
const SHADOW_A = 0.10;      // мягкая тень/воздух

// маленькое закругление
const SMALL_RX = 3;

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  const rx = Math.round(clamp(SMALL_RX, 0, 8));

  const gid = `sgpGlass_${isNeg ? 'n' : 'p'}_${Math.round(x)}_${Math.round(yy)}_${Math.round(w)}_${Math.round(h)}`;

  const aTop = clamp(GLASS_A, 0, 1);
  const aBot = clamp(GLASS_A * GLASS_BOTTOM_K, 0, 1);

  const stroke = `rgba(15, 23, 42, ${clamp(STROKE_A, 0, 1)})`;

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rgba(baseRGB, aTop)} />
          <stop offset="70%" stopColor={rgba(baseRGB, aBot)} />
          <stop offset="100%" stopColor={rgba(baseRGB, aBot * 0.92)} />
        </linearGradient>
      </defs>

      {/* 1) воздух: мягкая тень/подложка */}
      <rect
        x={x}
        y={yy + 1}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill="rgba(15,23,42,.12)"
        opacity={clamp(SHADOW_A, 0, 1)}
      />

      {/* 2) основное "стекло" - градиент */}
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={`url(#${gid})`}
        stroke={stroke}
        strokeWidth={0.6}
        shapeRendering="geometricPrecision"
      />

      {/* (блик и цветной edge удалены — чистый и дорогой вид) */}
    </g>
  );
}
