import React from 'react';
import { PagesTree } from './PagesTree';
import { BlocksPalette } from './BlocksPalette';
import { Inspector } from './Inspector';
import { useConstructorStore } from '../state/constructorStore';
import { ensureThemeTokens } from '../design/theme';
import { THEME_PRESETS } from '../design/presets';

type Mode = 'panel' | 'design';

function useLS<T>(key: string, init: T){
  const [v, setV] = React.useState<T>(() => {
    try{
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    }catch(_){
      return init;
    }
  });
  React.useEffect(()=>{
    try{ localStorage.setItem(key, JSON.stringify(v)); }catch(_){ }
  }, [key, v]);
  return [v, setV] as const;
}

/** простая “гармошка” без зависимостей */
function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}){
  return (
    <details className="ctorAcc" open={defaultOpen}>
      <summary className="ctorAcc__sum">
        <span className="ctorAcc__title">{title}</span>
        <span className="ctorAcc__chev">▾</span>
      </summary>
      <div className="ctorAcc__body">{children}</div>
    </details>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode)=>void;
}){
  return (
    <div className="ctorSeg" role="tablist" aria-label="Constructor mode">
      <button
        type="button"
        className={'ctorSeg__btn' + (value==='design' ? ' is-active' : '')}
        onClick={()=>onChange('design')}
        role="tab"
        aria-selected={value==='design'}
      >
        Дизайн
      </button>
      <button
        type="button"
        className={'ctorSeg__btn' + (value==='panel' ? ' is-active' : '')}
        onClick={()=>onChange('panel')}
        role="tab"
        aria-selected={value==='panel'}
      >
        Панель
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }){
  return (
    <div className="ctorRow">
      <div className="ctorRow__lbl">{label}</div>
      <div className="ctorRow__ctl">{children}</div>
    </div>
  );
}

function clamp01(v:any){
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function clampNum(v:any, min:number, max:number){
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function fmt2(v:any){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}
function truthy01(v:any){ return v ? 1 : 0; }

export function ConstructorDrawer(){
  const [mode, setMode] = useLS<Mode>('ctor_mode', 'panel');

  const bp = useConstructorStore(s => s.blueprint);
  const updateThemeTokens = useConstructorStore(s => (s as any).updateThemeTokens) as ((p:any)=>void);

  // raw tokens from BP could contain old keys — keep them, but render as new model
  const rawTokens = bp?.app?.themeTokens || {};
  const tokens = React.useMemo(()=>ensureThemeTokens(rawTokens), [rawTokens]);

  /**
   * Alias bridge:
   * - UI работает с NEW keys (camelCase) из theme.ts
   * - но если в bp лежат OLD keys ('color-bg', 'a-surface', etc.), мы их читаем тоже
   * - при записи: пишем NEW key (основной), а для критичных — дублируем в OLD key (чтобы ничего старого не отвалилось)
   */
  const ALIAS: Record<string, string[]> = {
    // colors old -> new
    colorBg: ['color-bg'],
    colorSurface: ['color-surface'],
    colorCard: ['color-card'],
    colorBorder: ['color-border'],
    colorText: ['color-text'],
    colorMuted: ['color-muted'],
    colorBrand: ['color-brand'],
    colorBrandSoft: ['color-brand-soft'],
    colorBrand2: ['color-brand2', 'color-brand-2'],

    btnPrimaryBg: ['btn-primary-bg'],
    btnPrimaryText: ['btn-primary-text'],
    btnSecondaryBg: ['btn-secondary-bg'],
    btnSecondaryText: ['btn-secondary-text'],

    tabbarBg: ['tabbar-bg'],
    tabbarText: ['tabbar-text'],
    tabbarActive: ['tabbar-active'],

    radiusCard: ['radius-card'],
    radiusBtn: ['radius-btn'],
    radiusInput: ['radius-input'],

    shadowA: ['shadow-a'],
    glowA: ['glow-a'],

    // alpha old -> new
    surfaceA: ['a-surface'],
    cardA: ['a-card'],
    overlayA: ['a-overlay'],

    fontBody: ['font-body'],
    fontHead: ['font-head'],
    fontBtn: ['font-btn'],

    fwBody: ['fw-body'],
    fwHead: ['fw-head'],
    fwBtn: ['fw-btn'],
  };

  const getTok = (k: string) => {
    // prefer ensureThemeTokens output (new model)
    if (tokens && Object.prototype.hasOwnProperty.call(tokens, k)) return (tokens as any)[k];
    // fallback to raw old keys
    const aliases = ALIAS[k] || [];
    for (const old of aliases) {
      if (rawTokens && Object.prototype.hasOwnProperty.call(rawTokens, old)) return (rawTokens as any)[old];
    }
    return undefined;
  };

  const setTok = (k: string, v: any) => {
    const patch: any = { [k]: v };
    const aliases = ALIAS[k] || [];
    // keep backward compatibility for already stored blueprints
    // write old aliases too (harmless)
    for (const old of aliases) patch[old] = v;
    updateThemeTokens?.(patch);
  };

  const setColor = (k: string, v: string) => setTok(k, v);
  const setNum   = (k: string, v: number) => setTok(k, v);

  // Helpers for inputs
  const Color = ({ k }: { k: string }) => (
    <input type="color" value={String(getTok(k) || '#000000')} onChange={e=>setColor(k, e.target.value)} />
  );

  const Range = ({ k, min, max, step=1 }: { k:string; min:number; max:number; step?:number }) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={Number(getTok(k) || 0)}
      onChange={e=>setNum(k, Number(e.target.value))}
    />
  );

  const Check01 = ({ k, label }: { k:string; label:string }) => (
    <label style={{display:'flex', gap:8, alignItems:'center'}}>
      <input
        type="checkbox"
        checked={!!Number(getTok(k) || 0)}
        onChange={e=>setNum(k, e.target.checked ? 1 : 0)}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="ctorDrawer">
      <div className="ctorDrawer__top">
        <Segmented value={mode} onChange={setMode} />
      </div>

      <div className="ctorDrawer__hint">
        Добавляй вкладки и страницы, редактируй блоки; превью обновляется сразу, сохраняется по кнопке.
      </div>

      {mode === 'panel' ? (
        <div className="ctorDrawer__stack">

            <PagesTree />

        </div>
      ) : (
        <div className="ctorDrawer__stack">
          <Accordion title="Пресеты" defaultOpen>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              {THEME_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="sg-btn"
                  onClick={()=>updateThemeTokens?.(p.tokens)}
                >
                  {p.title}
                </button>
              ))}
            </div>
            <div className="ctorStub" style={{marginTop:10}}>
              Пресет применяет токены в blueprint и сразу обновляет превью.
            </div>
          </Accordion>

          <Accordion title="Базовые стили" defaultOpen>
            <Row label="Background"><Color k="colorBg" /></Row>
            <Row label="Surface"><Color k="colorSurface" /></Row>
            <Row label="Card"><Color k="colorCard" /></Row>
            <Row label="Border"><Color k="colorBorder" /></Row>
            <Row label="Text"><Color k="colorText" /></Row>
            <Row label="Muted"><Color k="colorMuted" /></Row>

            <div className="ctorHr" />

            <Row label="Brand"><Color k="colorBrand" /></Row>
            <Row label="Brand 2"><Color k="colorBrand2" /></Row>
            <Row label="Brand soft (base)"><Color k="colorBrandSoft" /></Row>
          </Accordion>

          <Accordion title="Статусы">
            <Row label="Success"><Color k="colorSuccess" /></Row>
            <Row label="Warning"><Color k="colorWarning" /></Row>
            <Row label="Danger"><Color k="colorDanger" /></Row>
          </Accordion>

          <Accordion title="Кнопки">
            <Row label="Primary bg"><Color k="btnPrimaryBg" /></Row>
            <Row label="Primary text"><Color k="btnPrimaryText" /></Row>
            <Row label="Secondary bg"><Color k="btnSecondaryBg" /></Row>
            <Row label="Secondary text"><Color k="btnSecondaryText" /></Row>

            <div className="ctorHr" />

            <Row label={`Primary bg α (${fmt2(getTok('btnPrimaryBgA'))})`}>
              <Range k="btnPrimaryBgA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Primary text α (${fmt2(getTok('btnPrimaryTextA'))})`}>
              <Range k="btnPrimaryTextA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Secondary bg α (${fmt2(getTok('btnSecondaryBgA'))})`}>
              <Range k="btnSecondaryBgA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Secondary text α (${fmt2(getTok('btnSecondaryTextA'))})`}>
              <Range k="btnSecondaryTextA" min={0} max={1} step={0.01} />
            </Row>
          </Accordion>

          <Accordion title="Навбар / Overlay">
            <Row label="Tabbar bg"><Color k="tabbarBg" /></Row>
            <Row label="Tabbar text"><Color k="tabbarText" /></Row>
            <Row label="Tabbar active"><Color k="tabbarActive" /></Row>

            <div className="ctorHr" />

            <Row label={`Tabbar bg α (${fmt2(getTok('tabbarBgA'))})`}>
              <Range k="tabbarBgA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Tabbar text α (${fmt2(getTok('tabbarTextA'))})`}>
              <Range k="tabbarTextA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Tabbar active α (${fmt2(getTok('tabbarActiveA'))})`}>
              <Range k="tabbarActiveA" min={0} max={1} step={0.01} />
            </Row>

            <div className="ctorHr" />

            <Row label="Overlay color"><Color k="colorOverlay" /></Row>
            <Row label={`Overlay α (${fmt2(getTok('overlayA'))})`}>
              <Range k="overlayA" min={0} max={0.6} step={0.01} />
            </Row>
          </Accordion>

          <Accordion title="Радиусы">
            <Row label={`Card (${Number(getTok('radiusCard')||0)}px)`}>
              <Range k="radiusCard" min={0} max={42} step={1} />
            </Row>
            <Row label={`Button (${Number(getTok('radiusBtn')||0)}px)`}>
              <Range k="radiusBtn" min={0} max={42} step={1} />
            </Row>
            <Row label={`Input (${Number(getTok('radiusInput')||0)}px)`}>
              <Range k="radiusInput" min={0} max={42} step={1} />
            </Row>
          </Accordion>

          <Accordion title="Тени / Glow">
            <Row label={`Shadow (${fmt2(getTok('shadowA'))})`}>
              <Range k="shadowA" min={0} max={0.35} step={0.005} />
            </Row>
            <Row label={`Shadow2 (${fmt2(getTok('shadow2A'))})`}>
              <Range k="shadow2A" min={0} max={0.30} step={0.005} />
            </Row>
            <Row label={`Glow (${fmt2(getTok('glowA'))})`}>
              <Range k="glowA" min={0} max={0.6} step={0.01} />
            </Row>
            <Row label={`Glow blur (${Number(getTok('glowBlur')||0)}px)`}>
              <Range k="glowBlur" min={0} max={80} step={1} />
            </Row>
          </Accordion>

          <Accordion title="Прозрачность (Advanced)">
            <Row label={`BG α (${fmt2(getTok('bgA'))})`}>
              <Range k="bgA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Surface α (${fmt2(getTok('surfaceA'))})`}>
              <Range k="surfaceA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Surface2 α (${fmt2(getTok('surface2A'))})`}>
              <Range k="surface2A" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Card α (${fmt2(getTok('cardA'))})`}>
              <Range k="cardA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Border α (${fmt2(getTok('borderA'))})`}>
              <Range k="borderA" min={0} max={1} step={0.01} />
            </Row>

            <div className="ctorHr" />

            <Row label={`Text α (${fmt2(getTok('textA'))})`}>
              <Range k="textA" min={0} max={1} step={0.01} />
            </Row>
            <Row label={`Muted α (${fmt2(getTok('mutedA'))})`}>
              <Range k="mutedA" min={0} max={1} step={0.01} />
            </Row>

            <div className="ctorHr" />

            <Row label={`Brand soft α (${fmt2(getTok('brandSoftA'))})`}>
              <Range k="brandSoftA" min={0} max={1} step={0.01} />
            </Row>

            <div className="ctorStub" style={{marginTop:10}}>
              Совет: используй токены <b>--color-card</b>/<b>--color-surface</b>/<b>--overlay</b> — они генерятся как rgba и Telegram их понимает.
            </div>
          </Accordion>

          <Accordion title="Типографика">
            <Row label="Body font">
              <input
                className="ctorText"
                value={String(getTok('fontBody') || '')}
                onChange={e=>setTok('fontBody', e.target.value)}
              />
            </Row>
            <Row label="Head font">
              <input
                className="ctorText"
                value={String(getTok('fontHead') || '')}
                onChange={e=>setTok('fontHead', e.target.value)}
              />
            </Row>
            <Row label="Button font">
              <input
                className="ctorText"
                value={String(getTok('fontBtn') || '')}
                onChange={e=>setTok('fontBtn', e.target.value)}
              />
            </Row>
            <Row label="Menu font">
              <input
                className="ctorText"
                value={String(getTok('fontMenu') || '')}
                onChange={e=>setTok('fontMenu', e.target.value)}
              />
            </Row>

            <div className="ctorHr" />

            <Row label={`FS body (${Number(getTok('fsBody')||0)}px)`}><Range k="fsBody" min={10} max={22} step={1} /></Row>
            <Row label={`FS btn (${Number(getTok('fsBtn')||0)}px)`}><Range k="fsBtn" min={10} max={22} step={1} /></Row>
            <Row label={`FS menu (${Number(getTok('fsMenu')||0)}px)`}><Range k="fsMenu" min={10} max={22} step={1} /></Row>
            <Row label={`FS H1 (${Number(getTok('fsH1')||0)}px)`}><Range k="fsH1" min={14} max={44} step={1} /></Row>
            <Row label={`FS H2 (${Number(getTok('fsH2')||0)}px)`}><Range k="fsH2" min={12} max={34} step={1} /></Row>
            <Row label={`FS H3 (${Number(getTok('fsH3')||0)}px)`}><Range k="fsH3" min={12} max={30} step={1} /></Row>

            <div className="ctorHr" />

            <Row label={`FW body (${Number(getTok('fwBody')||0)})`}><Range k="fwBody" min={100} max={900} step={50} /></Row>
            <Row label={`FW head (${Number(getTok('fwHead')||0)})`}><Range k="fwHead" min={100} max={900} step={50} /></Row>
            <Row label={`FW btn (${Number(getTok('fwBtn')||0)})`}><Range k="fwBtn" min={100} max={900} step={50} /></Row>
            <Row label={`FW menu (${Number(getTok('fwMenu')||0)})`}><Range k="fwMenu" min={100} max={900} step={50} /></Row>

            <div className="ctorHr" />

            <Row label="Body style">
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <Check01 k="itBody" label="Italic" />
                <Check01 k="ulBody" label="Underline" />
              </div>
            </Row>
            <Row label="Head style">
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <Check01 k="itHead" label="Italic" />
                <Check01 k="ulHead" label="Underline" />
              </div>
            </Row>
            <Row label="Button style">
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <Check01 k="itBtn" label="Italic" />
                <Check01 k="ulBtn" label="Underline" />
              </div>
            </Row>
            <Row label="Menu style">
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <Check01 k="itMenu" label="Italic" />
                <Check01 k="ulMenu" label="Underline" />
              </div>
            </Row>
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default ConstructorDrawer;
