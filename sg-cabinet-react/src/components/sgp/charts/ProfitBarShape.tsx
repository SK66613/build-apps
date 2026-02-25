import React from 'react';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function rgba([r, g, b]: [number, number, number], a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Premium "mirror glass" bars (single source of truth)
 * - чистые цвета
 * - стекло: градиент (плотнее сверху, легче снизу)
 * - мягкая единая обводка
 * - верхний блик (зеркальность)
 * - тонкий цветной edge сверху (почти незаметно, но дорого)
 *
 * Хочешь “более стекло” -> уменьшаешь GLASS_A
 * Хочешь “сочнее” -> увеличиваешь GLASS_A
 */

// ====== COLORS (правь только тут) ======
// Зеленый: чистый (не болотный)
const POS_RGB: [number, number, number] = [34, 197, 94];  // emerald/green
// Красный: чистый (при стекле станет чуть розоватым — это нормально)
const NEG_RGB: [number, number, number] = [239, 68, 68];  // red

// ====== “MIXES” (правь только тут) ======
const GLASS_A = 0.28;        // плотность стекла 0.18..0.40
const GLASS_BOTTOM_K = 0.55; // насколько низ легче (0.45..0.70)
const STROKE_A = 0.08;       // мягкая обводка (0.05..0.12)
const SHADOW_A = 0.10;       // воздух/тень (0.06..0.14)
const HIGHLIGHT_A = 0.38;    // зеркальный блик (0.25..0.55)
const EDGE_A = 0.22;         // цветной edge сверху (0.12..0.28)

// если хочешь вообще без скруглений — оставь 0
const RADIUS = 0;

export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;
  const baseRGB = isNeg ? NEG_RGB : POS_RGB;

  // если хочешь “квадратные” — RADIUS=0
  // если хочешь слегка мягче — поставь 4..6
  const rx = RADIUS > 0 ? clamp(RADIUS, 0, 10) : 0;

  // уникальный id градиента для каждого бара (чтобы не конфликтовали)
  const gid = `sgpGlass_${isNeg ? 'n' : 'p'}_${Math.round(x)}_${Math.round(yy)}_${Math.round(w)}_${Math.round(h)}`;

  // верх плотнее, низ легче
  const aTop = clamp(GLASS_A, 0, 1);
  const aBot = clamp(GLASS_A * GLASS_BOTTOM_K, 0, 1);

  // мягкая единая обводка
  const stroke = `rgba(15, 23, 42, ${clamp(STROKE_A, 0, 1)})`;

  // размеры блика
  const hiH = Math.max(0, Math.min(12, h * 0.22));

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rgba(baseRGB, aTop)} />
          <stop offset="70%" stopColor={rgba(baseRGB, aBot)} />
          <stop offset="100%" stopColor={rgba(baseRGB, aBot * 0.92)} />
        </linearGradient>
      </defs>

      {/* 1) воздух: мягкая тень (дороже) */}
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

      {/* 2) стекло: градиентная заливка */}
      <rect
        x={x}
        y={yy}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={`url(#${gid})`}
        stroke={stroke}
        strokeWidth={1}
        shapeRendering="geometricPrecision"
      />

      {/* 3) верхний блик (зеркальность) */}
      {hiH > 0 ? (
        <rect
          x={x + 1}
          y={yy + 1}
          width={Math.max(0, w - 2)}
          height={hiH}
          rx={rx > 0 ? Math.max(2, rx - 2) : 0}
          ry={rx > 0 ? Math.max(2, rx - 2) : 0}
          fill="rgba(255,255,255,.92)"
          opacity={clamp(HIGHLIGHT_A, 0, 1)}
        />
      ) : null}

      {/* 4) тонкий цветной edge сверху (супер-деликатно) */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={rx > 0 ? Math.max(2, rx - 2) : 0}
        ry={rx > 0 ? Math.max(2, rx - 2) : 0}
        fill={rgba(baseRGB, 0.85)}
        opacity={clamp(EDGE_A, 0, 1)}
      />
    </g>
  );
}
