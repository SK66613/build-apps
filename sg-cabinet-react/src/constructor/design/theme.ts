// sg-cabinet-react/src/constructor/design/theme.ts
export type ThemeTokens = Record<string, string | number>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  // base colors
  'color-bg': '#0f1219',
  'color-surface': '#121a2a',
  'color-card': '#101827',
  'color-border': '#263048',
  'color-text': '#e8f0ff',
  'color-muted': '#97aac4',

  // brand + soft
  'color-brand': '#7C5CFF',
  'color-brand-soft': '#2A2352',

  // buttons
  'btn-primary-bg': '#7C5CFF',
  'btn-primary-text': '#ffffff',
  'btn-secondary-bg': '#1a2336',
  'btn-secondary-text': '#e8f0ff',

  // tabbar
  'tabbar-bg': '#0c0d12',
  'tabbar-text': '#97aac4',
  'tabbar-active': '#ffffff',




  // radius
  'radius-card': 16,
  'radius-btn': 14,
  'radius-input': 12,

  // shadow/glow strengths (0..1)
  'shadow-a': 0.18,
  'glow-a': 0.25,

  // typography
  'font-body': 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  'font-head': 'Montserrat, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  'font-btn': 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',

  // weights
  'fw-body': 650,
  'fw-head': 900,
  'fw-btn': 800,

  // italics/underline flags
  'it-body': 0,
  'it-head': 0,
  'it-btn': 0,
  'ul-body': 0,
  'ul-head': 0,
  'ul-btn': 0,

    // transparency strengths (0..1)
  'a-surface': 0.90,
  'a-card': 0.92,
  'a-overlay': 0.70,

};

const clamp01 = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

const toPx = (v: any, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : d;
};

const toInt = (v: any, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : d;
};

function rgbaFromHex(hex: string, a: number) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return `rgba(0,0,0,${clamp01(a)})`;
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${clamp01(a)})`;
}

export function ensureThemeTokens(tokens?: ThemeTokens): ThemeTokens {
  const out: ThemeTokens = { ...DEFAULT_THEME_TOKENS, ...(tokens || {}) };
  // нормализуем числа
  out['radius-card'] = toPx(out['radius-card'], 16);
  out['radius-btn'] = toPx(out['radius-btn'], 14);
  out['radius-input'] = toPx(out['radius-input'], 12);
  out['shadow-a'] = clamp01(out['shadow-a']);
  out['glow-a'] = clamp01(out['glow-a']);
  out['fw-body'] = toInt(out['fw-body'], 650);
  out['fw-head'] = toInt(out['fw-head'], 900);
  out['fw-btn'] = toInt(out['fw-btn'], 800);

  out['a-surface'] = clamp01(out['a-surface']);
  out['a-card'] = clamp01(out['a-card']);
  out['a-overlay'] = clamp01(out['a-overlay']);

  return out;
}

export function themeTokensToCss(tokensRaw?: ThemeTokens) {
  const t = ensureThemeTokens(tokensRaw);

  const shadowA = clamp01(t['shadow-a']);
  const glowA = clamp01(t['glow-a']);

  // базовые вычисляемые переменные (как в старом)
  const shadowCard = `0 16px 40px rgba(0,0,0,${(0.10 + shadowA * 0.22).toFixed(3)})`;
  const shadowSoft = `0 8px 24px rgba(0,0,0,${(0.08 + shadowA * 0.18).toFixed(3)})`;
  const glowBrand = `0 0 0 4px ${rgbaFromHex(String(t['color-brand']), 0.10 + glowA * 0.25)}`;

  // IMPORTANT: без color-mix (TG не умеет)
  return `
:root{
  --color-bg:${t['color-bg']};
  --color-surface:${t['color-surface']};
  --color-card:${t['color-card']};
  --color-border:${t['color-border']};
  --color-text:${t['color-text']};
  --color-muted:${t['color-muted']};

  --color-brand:${t['color-brand']};
  --color-brand-soft:${t['color-brand-soft']};

  --btn-primary-bg:${t['btn-primary-bg']};
  --btn-primary-text:${t['btn-primary-text']};
  --btn-secondary-bg:${t['btn-secondary-bg']};
  --btn-secondary-text:${t['btn-secondary-text']};

  --tabbar-bg:${t['tabbar-bg']};
  --tabbar-text:${t['tabbar-text']};
  --tabbar-active:${t['tabbar-active']};

  --radius-card:${t['radius-card']}px;
  --radius-btn:${t['radius-btn']}px;
  --radius-input:${t['radius-input']}px;

  --shadow-card:${shadowCard};
  --shadow-soft:${shadowSoft};
  --glow-brand:${glowBrand};

  --font-body:${t['font-body']};
  --font-head:${t['font-head']};
  --font-btn:${t['font-btn']};

  --fw-body:${t['fw-body']};
  --fw-head:${t['fw-head']};
  --fw-btn:${t['fw-btn']};

  --it-body:${Number(t['it-body']) ? 'italic' : 'normal'};
  --it-head:${Number(t['it-head']) ? 'italic' : 'normal'};
  --it-btn:${Number(t['it-btn']) ? 'italic' : 'normal'};

  --ul-body:${Number(t['ul-body']) ? 'underline' : 'none'};
  --ul-head:${Number(t['ul-head']) ? 'underline' : 'none'};
  --ul-btn:${Number(t['ul-btn']) ? 'underline' : 'none'};

    --a-surface:${clamp01(t['a-surface'])};
  --a-card:${clamp01(t['a-card'])};
  --a-overlay:${clamp01(t['a-overlay'])};

  /* TG-safe прозрачные версии без color-mix */
  --color-surface-a:${rgbaFromHex(String(t['color-surface']), clamp01(t['a-surface']))};
  --color-card-a:${rgbaFromHex(String(t['color-card']), clamp01(t['a-card']))};
  --color-overlay-a:${rgbaFromHex(String(t['color-bg']), clamp01(t['a-overlay']))};
  
}
`.trim();
}

