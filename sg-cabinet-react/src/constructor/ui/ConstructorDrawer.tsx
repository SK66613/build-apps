import React from 'react';
import { useConstructorStore } from '../state/constructorStore';
import { ensureThemeTokens } from '../design/theme';

type SectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function Section({ title, children, defaultOpen }: SectionProps) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="ctor-sec">
      <button className="ctor-sec__head" type="button" onClick={() => setOpen((v) => !v)}>
        <div className="ctor-sec__title">{title}</div>
        <div className="ctor-sec__chev">{open ? '▾' : '▸'}</div>
      </button>
      {open ? <div className="ctor-sec__body">{children}</div> : null}
    </div>
  );
}

function Row({ label, hint, right, children }: any) {
  return (
    <div className="ctor-row">
      <div className="ctor-row__left">
        <div className="ctor-row__label">{label}</div>
        {hint ? <div className="ctor-row__hint">{hint}</div> : null}
      </div>
      <div className="ctor-row__mid">{children}</div>
      {right ? <div className="ctor-row__right">{right}</div> : null}
    </div>
  );
}

function clamp01(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clampNum(v: any, min: number, max: number) {
  const x = Number(v);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function fmtA(v: any) {
  const x = clamp01(v);
  return x.toFixed(2);
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input
        type="color"
        value={String(value || '#000000')}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 38, height: 34, padding: 0, borderRadius: 10, border: '1px solid rgba(15,23,42,.12)', background: 'transparent' }}
      />
      <input
        type="text"
        value={String(value || '')}
        onChange={(e) => onChange(e.target.value)}
        className="ctor-input"
        placeholder="#RRGGBB"
      />
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      value={String(value)}
      min={String(min)}
      max={String(max)}
      step={String(step)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="ctor-range"
    />
  );
}

function NumField({ value, onChange, min, max, step }: any) {
  return (
    <input
      type="number"
      className="ctor-input"
      value={String(value ?? '')}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function ConstructorDrawer() {

  const bp = useConstructorStore((s: any) => s.blueprint);
  const updateThemeTokens = useConstructorStore((s: any) => s.updateThemeTokens);

  const raw = bp?.app?.themeTokens || {};
  const tokens = React.useMemo(() => ensureThemeTokens(raw), [raw]);

  const setTok = React.useCallback(
    (patch: Record<string, any>) => {
      updateThemeTokens?.(patch);
    },
    [updateThemeTokens]
  );

  // ===== UI blocks =====
  return (
    <div className="ctor-drawer">
      {/* === DESIGN PANEL === */}
      <div className="ctor-drawer__title">Design</div>

      <Section title="Colors" defaultOpen>
        <Row label="Background">
          <ColorField value={tokens.colorBg} onChange={(v) => setTok({ colorBg: v })} />
        </Row>
        <Row label="Surface">
          <ColorField value={tokens.colorSurface} onChange={(v) => setTok({ colorSurface: v })} />
        </Row>
        <Row label="Card">
          <ColorField value={tokens.colorCard} onChange={(v) => setTok({ colorCard: v })} />
        </Row>
        <Row label="Border">
          <ColorField value={tokens.colorBorder} onChange={(v) => setTok({ colorBorder: v })} />
        </Row>
        <Row label="Text">
          <ColorField value={tokens.colorText} onChange={(v) => setTok({ colorText: v })} />
        </Row>
        <Row label="Muted">
          <ColorField value={tokens.colorMuted} onChange={(v) => setTok({ colorMuted: v })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Brand">
          <ColorField value={tokens.colorBrand} onChange={(v) => setTok({ colorBrand: v })} />
        </Row>
        <Row label="Brand 2">
          <ColorField value={tokens.colorBrand2} onChange={(v) => setTok({ colorBrand2: v })} />
        </Row>
        <Row label="Brand Soft (base)">
          <ColorField value={tokens.colorBrandSoft} onChange={(v) => setTok({ colorBrandSoft: v })} />
        </Row>
      </Section>

      <Section title="Status">
        <Row label="Success">
          <ColorField value={tokens.colorSuccess} onChange={(v) => setTok({ colorSuccess: v })} />
        </Row>
        <Row label="Warning">
          <ColorField value={tokens.colorWarning} onChange={(v) => setTok({ colorWarning: v })} />
        </Row>
        <Row label="Danger">
          <ColorField value={tokens.colorDanger} onChange={(v) => setTok({ colorDanger: v })} />
        </Row>
      </Section>

      <Section title="Buttons">
        <Row label="Primary BG">
          <ColorField value={tokens.btnPrimaryBg} onChange={(v) => setTok({ btnPrimaryBg: v })} />
        </Row>
        <Row label="Primary Text">
          <ColorField value={tokens.btnPrimaryText} onChange={(v) => setTok({ btnPrimaryText: v })} />
        </Row>
        <Row label="Secondary BG">
          <ColorField value={tokens.btnSecondaryBg} onChange={(v) => setTok({ btnSecondaryBg: v })} />
        </Row>
        <Row label="Secondary Text">
          <ColorField value={tokens.btnSecondaryText} onChange={(v) => setTok({ btnSecondaryText: v })} />
        </Row>
      </Section>

      <Section title="Tabbar">
        <Row label="Tabbar BG">
          <ColorField value={tokens.tabbarBg} onChange={(v) => setTok({ tabbarBg: v })} />
        </Row>
        <Row label="Tabbar Text">
          <ColorField value={tokens.tabbarText} onChange={(v) => setTok({ tabbarText: v })} />
        </Row>
        <Row label="Tabbar Active">
          <ColorField value={tokens.tabbarActive} onChange={(v) => setTok({ tabbarActive: v })} />
        </Row>
      </Section>

      <Section title="Radius">
        <Row label="Card radius" right={`${Math.round(tokens.radiusCard)}px`}>
          <Slider value={tokens.radiusCard} min={0} max={42} step={1} onChange={(v) => setTok({ radiusCard: v })} />
        </Row>
        <Row label="Button radius" right={`${Math.round(tokens.radiusBtn)}px`}>
          <Slider value={tokens.radiusBtn} min={0} max={42} step={1} onChange={(v) => setTok({ radiusBtn: v })} />
        </Row>
        <Row label="Input radius" right={`${Math.round(tokens.radiusInput)}px`}>
          <Slider value={tokens.radiusInput} min={0} max={42} step={1} onChange={(v) => setTok({ radiusInput: v })} />
        </Row>
      </Section>

      <Section title="Shadow & Glow">
        <Row label="Shadow strength" right={fmtA(tokens.shadowA)}>
          <Slider value={tokens.shadowA} min={0} max={0.35} step={0.005} onChange={(v) => setTok({ shadowA: clamp01(v) })} />
        </Row>
        <Row label="Shadow 2 strength" right={fmtA(tokens.shadow2A)}>
          <Slider value={tokens.shadow2A} min={0} max={0.30} step={0.005} onChange={(v) => setTok({ shadow2A: clamp01(v) })} />
        </Row>
        <Row label="Glow strength" right={fmtA(tokens.glowA)}>
          <Slider value={tokens.glowA} min={0} max={0.6} step={0.01} onChange={(v) => setTok({ glowA: clamp01(v) })} />
        </Row>
        <Row label="Glow blur" right={`${Math.round(tokens.glowBlur)}px`}>
          <Slider value={tokens.glowBlur} min={0} max={80} step={1} onChange={(v) => setTok({ glowBlur: clampNum(v, 0, 80) })} />
        </Row>
      </Section>

      <Section title="Opacity (Advanced)">
        <Row label="BG alpha" right={fmtA(tokens.bgA)}>
          <Slider value={tokens.bgA} min={0} max={1} step={0.01} onChange={(v) => setTok({ bgA: clamp01(v) })} />
        </Row>
        <Row label="Surface alpha" right={fmtA(tokens.surfaceA)}>
          <Slider value={tokens.surfaceA} min={0} max={1} step={0.01} onChange={(v) => setTok({ surfaceA: clamp01(v) })} />
        </Row>
        <Row label="Surface2 alpha" right={fmtA(tokens.surface2A)}>
          <Slider value={tokens.surface2A} min={0} max={1} step={0.01} onChange={(v) => setTok({ surface2A: clamp01(v) })} />
        </Row>
        <Row label="Card alpha" right={fmtA(tokens.cardA)}>
          <Slider value={tokens.cardA} min={0} max={1} step={0.01} onChange={(v) => setTok({ cardA: clamp01(v) })} />
        </Row>
        <Row label="Border alpha" right={fmtA(tokens.borderA)}>
          <Slider value={tokens.borderA} min={0} max={1} step={0.01} onChange={(v) => setTok({ borderA: clamp01(v) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Overlay color">
          <ColorField value={tokens.colorOverlay} onChange={(v) => setTok({ colorOverlay: v })} />
        </Row>
        <Row label="Overlay alpha" right={fmtA(tokens.overlayA)}>
          <Slider value={tokens.overlayA} min={0} max={0.6} step={0.01} onChange={(v) => setTok({ overlayA: clamp01(v) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Primary BG alpha" right={fmtA(tokens.btnPrimaryBgA)}>
          <Slider value={tokens.btnPrimaryBgA} min={0} max={1} step={0.01} onChange={(v) => setTok({ btnPrimaryBgA: clamp01(v) })} />
        </Row>
        <Row label="Primary Text alpha" right={fmtA(tokens.btnPrimaryTextA)}>
          <Slider value={tokens.btnPrimaryTextA} min={0} max={1} step={0.01} onChange={(v) => setTok({ btnPrimaryTextA: clamp01(v) })} />
        </Row>
        <Row label="Secondary BG alpha" right={fmtA(tokens.btnSecondaryBgA)}>
          <Slider value={tokens.btnSecondaryBgA} min={0} max={1} step={0.01} onChange={(v) => setTok({ btnSecondaryBgA: clamp01(v) })} />
        </Row>
        <Row label="Secondary Text alpha" right={fmtA(tokens.btnSecondaryTextA)}>
          <Slider value={tokens.btnSecondaryTextA} min={0} max={1} step={0.01} onChange={(v) => setTok({ btnSecondaryTextA: clamp01(v) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Tabbar BG alpha" right={fmtA(tokens.tabbarBgA)}>
          <Slider value={tokens.tabbarBgA} min={0} max={1} step={0.01} onChange={(v) => setTok({ tabbarBgA: clamp01(v) })} />
        </Row>
        <Row label="Tabbar Text alpha" right={fmtA(tokens.tabbarTextA)}>
          <Slider value={tokens.tabbarTextA} min={0} max={1} step={0.01} onChange={(v) => setTok({ tabbarTextA: clamp01(v) })} />
        </Row>
        <Row label="Tabbar Active alpha" right={fmtA(tokens.tabbarActiveA)}>
          <Slider value={tokens.tabbarActiveA} min={0} max={1} step={0.01} onChange={(v) => setTok({ tabbarActiveA: clamp01(v) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Brand soft alpha" right={fmtA(tokens.brandSoftA)}>
          <Slider value={tokens.brandSoftA} min={0} max={1} step={0.01} onChange={(v) => setTok({ brandSoftA: clamp01(v) })} />
        </Row>
      </Section>

      <Section title="Typography">
        <Row label="Body font">
          <input className="ctor-input" value={tokens.fontBody} onChange={(e) => setTok({ fontBody: e.target.value })} />
        </Row>
        <Row label="Head font">
          <input className="ctor-input" value={tokens.fontHead} onChange={(e) => setTok({ fontHead: e.target.value })} />
        </Row>
        <Row label="Button font">
          <input className="ctor-input" value={tokens.fontBtn} onChange={(e) => setTok({ fontBtn: e.target.value })} />
        </Row>
        <Row label="Menu font">
          <input className="ctor-input" value={tokens.fontMenu} onChange={(e) => setTok({ fontMenu: e.target.value })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Body size" right={`${Math.round(tokens.fsBody)}px`}>
          <Slider value={tokens.fsBody} min={10} max={22} step={1} onChange={(v) => setTok({ fsBody: clampNum(v, 10, 22) })} />
        </Row>
        <Row label="Button size" right={`${Math.round(tokens.fsBtn)}px`}>
          <Slider value={tokens.fsBtn} min={10} max={22} step={1} onChange={(v) => setTok({ fsBtn: clampNum(v, 10, 22) })} />
        </Row>
        <Row label="Menu size" right={`${Math.round(tokens.fsMenu)}px`}>
          <Slider value={tokens.fsMenu} min={10} max={22} step={1} onChange={(v) => setTok({ fsMenu: clampNum(v, 10, 22) })} />
        </Row>
        <Row label="H1 size" right={`${Math.round(tokens.fsH1)}px`}>
          <Slider value={tokens.fsH1} min={14} max={44} step={1} onChange={(v) => setTok({ fsH1: clampNum(v, 14, 44) })} />
        </Row>
        <Row label="H2 size" right={`${Math.round(tokens.fsH2)}px`}>
          <Slider value={tokens.fsH2} min={12} max={34} step={1} onChange={(v) => setTok({ fsH2: clampNum(v, 12, 34) })} />
        </Row>
        <Row label="H3 size" right={`${Math.round(tokens.fsH3)}px`}>
          <Slider value={tokens.fsH3} min={12} max={30} step={1} onChange={(v) => setTok({ fsH3: clampNum(v, 12, 30) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Body weight">
          <NumField value={tokens.fwBody} min={100} max={900} step={50} onChange={(v: number) => setTok({ fwBody: clampNum(v, 100, 900) })} />
        </Row>
        <Row label="Head weight">
          <NumField value={tokens.fwHead} min={100} max={900} step={50} onChange={(v: number) => setTok({ fwHead: clampNum(v, 100, 900) })} />
        </Row>
        <Row label="Button weight">
          <NumField value={tokens.fwBtn} min={100} max={900} step={50} onChange={(v: number) => setTok({ fwBtn: clampNum(v, 100, 900) })} />
        </Row>
        <Row label="Menu weight">
          <NumField value={tokens.fwMenu} min={100} max={900} step={50} onChange={(v: number) => setTok({ fwMenu: clampNum(v, 100, 900) })} />
        </Row>

        <div className="ctor-split" />

        <Row label="Body italic / underline">
          <div style={{ display: 'flex', gap: 10 }}>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.itBody} onChange={(e) => setTok({ itBody: e.target.checked ? 1 : 0 })} />
              <span>Italic</span>
            </label>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.ulBody} onChange={(e) => setTok({ ulBody: e.target.checked ? 1 : 0 })} />
              <span>Underline</span>
            </label>
          </div>
        </Row>

        <Row label="Head italic / underline">
          <div style={{ display: 'flex', gap: 10 }}>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.itHead} onChange={(e) => setTok({ itHead: e.target.checked ? 1 : 0 })} />
              <span>Italic</span>
            </label>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.ulHead} onChange={(e) => setTok({ ulHead: e.target.checked ? 1 : 0 })} />
              <span>Underline</span>
            </label>
          </div>
        </Row>

        <Row label="Button italic / underline">
          <div style={{ display: 'flex', gap: 10 }}>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.itBtn} onChange={(e) => setTok({ itBtn: e.target.checked ? 1 : 0 })} />
              <span>Italic</span>
            </label>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.ulBtn} onChange={(e) => setTok({ ulBtn: e.target.checked ? 1 : 0 })} />
              <span>Underline</span>
            </label>
          </div>
        </Row>

        <Row label="Menu italic / underline">
          <div style={{ display: 'flex', gap: 10 }}>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.itMenu} onChange={(e) => setTok({ itMenu: e.target.checked ? 1 : 0 })} />
              <span>Italic</span>
            </label>
            <label className="ctor-check">
              <input type="checkbox" checked={!!tokens.ulMenu} onChange={(e) => setTok({ ulMenu: e.target.checked ? 1 : 0 })} />
              <span>Underline</span>
            </label>
          </div>
        </Row>
      </Section>

      {/* ===== minimal CSS for drawer controls (if you already have it, remove this section) */}
      <style>{`
        .ctor-drawer{ padding: 14px; display:flex; flex-direction:column; gap: 10px; }
        .ctor-drawer__title{ font-weight: 900; font-size: 16px; margin-bottom: 2px; }
        .ctor-sec{ border:1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.66); border-radius: 16px; overflow:hidden; }
        .ctor-sec__head{ width:100%; display:flex; justify-content:space-between; align-items:center; padding: 10px 12px; background: rgba(255,255,255,.6); border:0; cursor:pointer; }
        .ctor-sec__title{ font-weight: 900; font-size: 13px; }
        .ctor-sec__chev{ opacity:.7; }
        .ctor-sec__body{ padding: 10px 12px; display:flex; flex-direction:column; gap: 10px; }
        .ctor-row{ display:grid; grid-template-columns: 170px 1fr auto; gap: 10px; align-items:center; }
        .ctor-row__label{ font-size: 12px; font-weight: 800; }
        .ctor-row__hint{ font-size: 11px; opacity:.65; margin-top: 2px; }
        .ctor-row__mid{ min-width: 0; }
        .ctor-row__right{ font-size: 11px; opacity:.7; }
        .ctor-input{ width:100%; padding: 9px 10px; border-radius: 12px; border:1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.78); font-size: 13px; }
        .ctor-range{ width:100%; }
        .ctor-check{ display:flex; gap: 8px; align-items:center; font-size: 12px; }
        .ctor-split{ height:1px; background: rgba(15,23,42,.08); margin: 4px 0; }
        @media (max-width: 900px){
          .ctor-row{ grid-template-columns: 1fr; }
          .ctor-row__right{ justify-self:start; }
        }
      `}</style>
    </div>
  );
}

export default ConstructorDrawer;

