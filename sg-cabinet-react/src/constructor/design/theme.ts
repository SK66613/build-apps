// TG-safe theme tokens (no color-mix). Blueprint-only.
// Generates :root CSS variables that the mini runtime can consume.

export type ThemeTokens = Record<string, any>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  // ===== base palette (hex) =====
  colorBg: '#f4f6ff',
  colorSurface: '#ffffff',
  colorCard: '#ffffff',
  colorBorder: '#0f172a',
  colorText: '#0b1220',
  colorMuted: '#334155',

  colorBrand: '#22d3ee',
  colorBrand2: '#3b82f6',
  colorBrandSoft: '#22d3ee',

  // status
  colorSuccess: '#22c55e',
  colorWarning: '#f59e0b',
  colorDanger: '#ef4444',

  // overlay
  colorOverlay: '#0b1220',

  // buttons
  btnPrimaryBg: '#22d3ee',
  btnPrimaryText: '#0b1220',
  btnSecondaryBg: '#ffffff',
  btnSecondaryText: '#0b1220',

  // tabbar
  tabbarBg: '#ffffff',
  tabbarText: '#334155',
  tabbarActive: '#0b1220',

  // ===== opacity (0..1) =====
  bgA: 1,
  surfaceA: 0.92,
  surface2A: 0.72,
  cardA: 0.86,
  borderA: 0.12,
  textA: 1,
  mutedA: 0.62,

  brandA: 1,
  brand2A: 1,
  brandSoftA: 0.14,

  overlayA: 0.22,

  btnPrimaryBgA: 0.95,
  btnPrimaryTextA: 1,
  btnSecondaryBgA: 0.78,
  btnSecondaryTextA: 1,

  tabbarBgA: 0.86,
  tabbarTextA: 0.68,
  tabbarActiveA: 1,

  successA: 1,
  warningA: 1,
  dangerA: 1,

  // ===== radius (px) =====
  radiusCard: 18,
  radiusBtn: 14,
  radiusInput: 12,
  radiusChip: 999,

  // ===== shadow/glow strength =====
  shadowA: 0.10,   // card shadow alpha multiplier
  shadow2A: 0.08,  // secondary shadow alpha
  glowA: 0.22,     // glow alpha multiplier
  glowBlur: 28,    // px
  shadowY: 18,     // px
  shadowBlur: 52,  // px
  shadow2Y: 10,    // px
  shadow2Blur: 28, // px

  // ===== typography =====
  fontBody: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  fontHead: 'Montserrat, Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  fontBtn: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  fontMenu: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',

  fsBody: 14,
  fsBtn: 14,
  fsMenu: 13,
  fsH1: 22,
  fsH2: 18,
  fsH3: 16,

  fwBody: 400,
  fwHead: 800,
  fwBtn: 700,
  fwMenu: 700,

  itBody: 0,
  itHead: 0,
  itBtn: 0,
  itMenu: 0,

  ulBody: 0,
  ulHead: 0,
  ulBtn: 0,
  ulMenu: 0,
};

// ===== helpers =====
export function clamp01(x: any) {
  const v = Number(x);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function clampNum(x: any, min: number, max: number) {
  const v = Number(x);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function normalizeHex(hex: any): string {
  const s = String(hex || '').trim();
  if (!s) return '#000000';
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    // #abc -> #aabbcc
    return '#' + s.slice(1).split('').map((c) => c + c).join('');
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  // fallback attempt: strip non-hex
  const t = s.replace(/[^0-9a-f]/gi, '');
  if (t.length === 6) return '#' + t;
  return '#000000';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

export function rgbaFromHex(hex: string, a: any): string {
  const { r, g, b } = hexToRgb(hex);
  const aa = clamp01(a);
  // keep 3 decimals to avoid huge diffs in diffs
  const a3 = Math.round(aa * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a3})`;
}

// Merge defaults + user tokens and clamp everything into valid ranges
export function ensureThemeTokens(input?: ThemeTokens | null): ThemeTokens {
  const t: ThemeTokens = { ...DEFAULT_THEME_TOKENS, ...(input || {}) };

  // normalize all hex colors
  const hexKeys = [
    'colorBg','colorSurface','colorCard','colorBorder','colorText','colorMuted',
    'colorBrand','colorBrand2','colorBrandSoft',
    'colorSuccess','colorWarning','colorDanger',
    'colorOverlay',
    'btnPrimaryBg','btnPrimaryText','btnSecondaryBg','btnSecondaryText',
    'tabbarBg','tabbarText','tabbarActive',
  ];
  for (const k of hexKeys) t[k] = normalizeHex(t[k]);

  // clamp opacities
  const aKeys = [
    'bgA','surfaceA','surface2A','cardA','borderA','textA','mutedA',
    'brandA','brand2A','brandSoftA',
    'overlayA',
    'btnPrimaryBgA','btnPrimaryTextA','btnSecondaryBgA','btnSecondaryTextA',
    'tabbarBgA','tabbarTextA','tabbarActiveA',
    'successA','warningA','dangerA',
    'shadowA','shadow2A','glowA',
  ];
  for (const k of aKeys) t[k] = clamp01(t[k]);

  // clamp radius
  t.radiusCard = clampNum(t.radiusCard, 0, 42);
  t.radiusBtn = clampNum(t.radiusBtn, 0, 42);
  t.radiusInput = clampNum(t.radiusInput, 0, 42);
  t.radiusChip = clampNum(t.radiusChip, 0, 999);

  // clamp shadow numbers
  t.glowBlur = clampNum(t.glowBlur, 0, 80);
  t.shadowY = clampNum(t.shadowY, 0, 60);
  t.shadowBlur = clampNum(t.shadowBlur, 0, 120);
  t.shadow2Y = clampNum(t.shadow2Y, 0, 60);
  t.shadow2Blur = clampNum(t.shadow2Blur, 0, 120);

  // typography numbers
  t.fsBody = clampNum(t.fsBody, 10, 22);
  t.fsBtn = clampNum(t.fsBtn, 10, 22);
  t.fsMenu = clampNum(t.fsMenu, 10, 22);
  t.fsH1 = clampNum(t.fsH1, 14, 44);
  t.fsH2 = clampNum(t.fsH2, 12, 34);
  t.fsH3 = clampNum(t.fsH3, 12, 30);

  t.fwBody = clampNum(t.fwBody, 100, 900);
  t.fwHead = clampNum(t.fwHead, 100, 900);
  t.fwBtn = clampNum(t.fwBtn, 100, 900);
  t.fwMenu = clampNum(t.fwMenu, 100, 900);

  // ital/underline booleans (0/1)
  t.itBody = t.itBody ? 1 : 0;
  t.itHead = t.itHead ? 1 : 0;
  t.itBtn = t.itBtn ? 1 : 0;
  t.itMenu = t.itMenu ? 1 : 0;

  t.ulBody = t.ulBody ? 1 : 0;
  t.ulHead = t.ulHead ? 1 : 0;
  t.ulBtn = t.ulBtn ? 1 : 0;
  t.ulMenu = t.ulMenu ? 1 : 0;

  // fonts (strings)
  t.fontBody = String(t.fontBody || DEFAULT_THEME_TOKENS.fontBody);
  t.fontHead = String(t.fontHead || DEFAULT_THEME_TOKENS.fontHead);
  t.fontBtn = String(t.fontBtn || DEFAULT_THEME_TOKENS.fontBtn);
  t.fontMenu = String(t.fontMenu || DEFAULT_THEME_TOKENS.fontMenu);

  return t;
}

// Create CSS variables for runtime.
// Includes both *-hex and final rgba variables.
export function themeTokensToCss(input?: ThemeTokens | null): string {
  const t = ensureThemeTokens(input);

  const bg = rgbaFromHex(t.colorBg, t.bgA);
  const surface = rgbaFromHex(t.colorSurface, t.surfaceA);
  const surface2 = rgbaFromHex(t.colorSurface, t.surface2A);
  const card = rgbaFromHex(t.colorCard, t.cardA);
  const border = rgbaFromHex(t.colorBorder, t.borderA);
  const text = rgbaFromHex(t.colorText, t.textA);
  const muted = rgbaFromHex(t.colorMuted, t.mutedA);

  const brand = rgbaFromHex(t.colorBrand, t.brandA);
  const brand2 = rgbaFromHex(t.colorBrand2, t.brand2A);
  const brandSoft = rgbaFromHex(t.colorBrandSoft, t.brandSoftA);

  const success = rgbaFromHex(t.colorSuccess, t.successA);
  const warning = rgbaFromHex(t.colorWarning, t.warningA);
  const danger = rgbaFromHex(t.colorDanger, t.dangerA);

  const overlay = rgbaFromHex(t.colorOverlay, t.overlayA);

  const btnPrimaryBg = rgbaFromHex(t.btnPrimaryBg, t.btnPrimaryBgA);
  const btnPrimaryText = rgbaFromHex(t.btnPrimaryText, t.btnPrimaryTextA);
  const btnSecondaryBg = rgbaFromHex(t.btnSecondaryBg, t.btnSecondaryBgA);
  const btnSecondaryText = rgbaFromHex(t.btnSecondaryText, t.btnSecondaryTextA);

  const tabbarBg = rgbaFromHex(t.tabbarBg, t.tabbarBgA);
  const tabbarText = rgbaFromHex(t.tabbarText, t.tabbarTextA);
  const tabbarActive = rgbaFromHex(t.tabbarActive, t.tabbarActiveA);

  // shadows/glow (match old vibe)
  const shadow = `0 ${Math.round(t.shadowY)}px ${Math.round(t.shadowBlur)}px rgba(2, 6, 23, ${Math.round(t.shadowA * 1000) / 1000})`;
  const shadow2 = `0 ${Math.round(t.shadow2Y)}px ${Math.round(t.shadow2Blur)}px rgba(2, 6, 23, ${Math.round(t.shadow2A * 1000) / 1000})`;
  const glow = `0 0 ${Math.round(t.glowBlur)}px ${rgbaFromHex(t.colorBrand, t.glowA).replace(/^rgba\(/, '').replace(/\)$/, '')})`; // tricky, but ok
  // Alternative (clean): use brand rgb with glowA
  const { r: br, g: bg2r, b: bb } = hexToRgb(t.colorBrand);
  const glowBrand = `0 0 ${Math.round(t.glowBlur)}px rgba(${br}, ${bg2r}, ${bb}, ${Math.round(t.glowA * 1000) / 1000})`;

  const itBody = t.itBody ? 'italic' : 'normal';
  const itHead = t.itHead ? 'italic' : 'normal';
  const itBtn = t.itBtn ? 'italic' : 'normal';
  const itMenu = t.itMenu ? 'italic' : 'normal';

  const ulBody = t.ulBody ? 'underline' : 'none';
  const ulHead = t.ulHead ? 'underline' : 'none';
  const ulBtn = t.ulBtn ? 'underline' : 'none';
  const ulMenu = t.ulMenu ? 'underline' : 'none';

  // Build CSS
  return `
:root{
  /* ===== Figma tokens (hex) ===== */
  --color-bg-hex:${t.colorBg};
  --color-surface-hex:${t.colorSurface};
  --color-card-hex:${t.colorCard};
  --color-border-hex:${t.colorBorder};
  --color-text-hex:${t.colorText};
  --color-muted-hex:${t.colorMuted};

  --color-brand-hex:${t.colorBrand};
  --color-brand2-hex:${t.colorBrand2};
  --color-brand-soft-hex:${t.colorBrandSoft};

  --color-success-hex:${t.colorSuccess};
  --color-warning-hex:${t.colorWarning};
  --color-danger-hex:${t.colorDanger};

  --color-overlay-hex:${t.colorOverlay};

  --btn-primary-bg-hex:${t.btnPrimaryBg};
  --btn-primary-text-hex:${t.btnPrimaryText};
  --btn-secondary-bg-hex:${t.btnSecondaryBg};
  --btn-secondary-text-hex:${t.btnSecondaryText};

  --tabbar-bg-hex:${t.tabbarBg};
  --tabbar-text-hex:${t.tabbarText};
  --tabbar-active-hex:${t.tabbarActive};

  /* ===== Final rgba tokens (TG-safe) ===== */
  --color-bg:${bg};
  --color-surface:${surface};
  --color-surface2:${surface2};
  --color-card:${card};
  --color-border:${border};
  --color-text:${text};
  --color-muted:${muted};

  --color-brand:${brand};
  --color-brand2:${brand2};
  --color-brand-soft:${brandSoft};

  --color-success:${success};
  --color-warning:${warning};
  --color-danger:${danger};

  --overlay:${overlay};

  --btn-primary-bg:${btnPrimaryBg};
  --btn-primary-text:${btnPrimaryText};
  --btn-secondary-bg:${btnSecondaryBg};
  --btn-secondary-text:${btnSecondaryText};

  --tabbar-bg:${tabbarBg};
  --tabbar-text:${tabbarText};
  --tabbar-active:${tabbarActive};

  /* ===== Radiuses ===== */
  --radius-card:${Math.round(t.radiusCard)}px;
  --radius-btn:${Math.round(t.radiusBtn)}px;
  --radius-input:${Math.round(t.radiusInput)}px;
  --radius-chip:${Math.round(t.radiusChip)}px;

  /* ===== Shadow/Glow ===== */
  --shadow-card:${shadow};
  --shadow-soft:${shadow2};
  --glow-brand:${glowBrand};
  --shadow-a:${Math.round(t.shadowA * 1000) / 1000};
  --shadow2-a:${Math.round(t.shadow2A * 1000) / 1000};
  --glow-a:${Math.round(t.glowA * 1000) / 1000};

  /* ===== Typography ===== */
  --font-body:${t.fontBody};
  --font-head:${t.fontHead};
  --font-btn:${t.fontBtn};
  --font-menu:${t.fontMenu};

  --fs-body:${Math.round(t.fsBody)}px;
  --fs-btn:${Math.round(t.fsBtn)}px;
  --fs-menu:${Math.round(t.fsMenu)}px;
  --fs-h1:${Math.round(t.fsH1)}px;
  --fs-h2:${Math.round(t.fsH2)}px;
  --fs-h3:${Math.round(t.fsH3)}px;

  --fw-body:${Math.round(t.fwBody)};
  --fw-head:${Math.round(t.fwHead)};
  --fw-btn:${Math.round(t.fwBtn)};
  --fw-menu:${Math.round(t.fwMenu)};

  --it-body:${itBody};
  --it-head:${itHead};
  --it-btn:${itBtn};
  --it-menu:${itMenu};

  --ul-body:${ulBody};
  --ul-head:${ulHead};
  --ul-btn:${ulBtn};
  --ul-menu:${ulMenu};
}
`.trim();
}
