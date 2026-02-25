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
 * Single Source of Truth: premium glass bar
 * Управляется токенами:
 *  --sgp-chart-pos / --sgp-chart-neg       (база цвета)
 *  --sgp-chart-stroke                      (единая обводка)
 *  --sgp-bar-tint                          (насколько "плотная" заливка-стекло, 0..1)
 *  --sgp-bar-highlight                     (яркость блика, 0..1)
 *  --sgp-bar-shadow                        (сила тени, 0..1)
 *
 * По умолчанию — стекло (воздушно), но можно сделать насыщеннее одной цифрой.
 */
export function ProfitBarShape(props: any) {
  const { x, y, width, height, value } = props;

  const w = Math.max(0, Number(width) || 0);
  const hRaw = Number(height) || 0;
  const h = Math.abs(hRaw);
  const yy = hRaw >= 0 ? y : y - h;

  if (w <= 0 || h <= 0) return null;

  const isNeg = Number(value) < 0;

  // базовые цвета (их ты правишь в scss один раз)
  const pos = cssVar('--sgp-chart-pos', 'rgba(16,185,129,.34)'); // emerald
  const neg = cssVar('--sgp-chart-neg', 'rgba(244,63,94,.30)');  // rose
  const base = isNeg ? neg : pos;

  // единая обводка (дороже чем цветная)
  const stroke = cssVar('--sgp-chart-stroke', 'rgba(15,23,42,.10)');

  // “крутилки” прозрачности (строками, чтобы можно было задать в css как 0.14)
  const tintA = Number(cssVar('--sgp-bar-tint', '0.76'));       // плотность стекла
  const hiA = Number(cssVar('--sgp-bar-highlight', '0.82'));    // блик
  const shA = Number(cssVar('--sgp-bar-shadow', '0.10'));       // тень

  // clamp на случай мусора в css
  const tint = clamp(Number.isFinite(tintA) ? tintA : 0.16, 0, 1);
  const hi = clamp(Number.isFinite(hiA) ? hiA : 0.42, 0, 1);
  const sh = clamp(Number.isFinite(shA) ? shA : 0.10, 0, 1);

  // чтобы не было "капсул" при широких барах
  const rx = Math.round(clamp(w * 0.12, 4, 9));

  // хитрость: заливаем base цветом, но маленькой альфой => чистое стекло, не муть
  // (и при этом насыщенность регулируется --sgp-chart-pos/neg + --sgp-bar-tint)
  const fill = base.replace(/rgba?\(([^)]+)\)/, (m) => {
    // если base уже rgba(...) — просто подменим альфу
    if (m.startsWith('rgba(')) {
      const parts = m.slice(5, -1).split(',').map((s) => s.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${tint})`;
    }
    // если вдруг base = rgb(...) — добавим альфу
    if (m.startsWith('rgb(')) {
      const parts = m.slice(4, -1).split(',').map((s) => s.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${tint})`;
    }
    return m;
  });

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
        fill="rgba(15,23,42,.12)"
        opacity={sh}
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
        fill="rgba(255,255,255,.85)"
        opacity={hi}
      />

      {/* микро-линия внизу (линза) */}
      <rect
        x={x + 1}
        y={yy + Math.max(0, h - 4)}
        width={Math.max(0, w - 2)}
        height={Math.min(3, h)}
        rx={Math.max(3, rx - 2)}
        ry={Math.max(3, rx - 2)}
        fill="rgba(255,255,255,.26)"
        opacity={0.22}
      />

      {/* тонкий edge-акцент по знаку */}
      <rect
        x={x + 0.5}
        y={yy + 0.5}
        width={Math.max(0, w - 1)}
        height={Math.max(0, Math.min(2, h))}
        rx={Math.max(3, rx - 2)}
        ry={Math.max(3, rx - 2)}
        fill={base}
        opacity={0.18}
      />
    </g>
  );
}
