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

export function ConstructorDrawer(){
  const [mode, setMode] = useLS<Mode>('ctor_mode', 'panel');

  const bp = useConstructorStore(s => s.blueprint);
  const updateThemeTokens = useConstructorStore(s => (s as any).updateThemeTokens) as ((p:any)=>void);

  const tokens = React.useMemo(()=>ensureThemeTokens(bp?.app?.themeTokens || {}), [bp?.app?.themeTokens]);

  const setColor = (k: string, v: string) => updateThemeTokens?.({ [k]: v });
  const setNum   = (k: string, v: number) => updateThemeTokens?.({ [k]: v });

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
          <Accordion title="Страницы" defaultOpen>
            <PagesTree />
          </Accordion>

          <Accordion title="Блоки" defaultOpen>
            <BlocksPalette />
          </Accordion>

          <Accordion title="Inspector" defaultOpen>
            <Inspector />
          </Accordion>
        </div>
      ) : (
        <div className="ctorDrawer__stack">
          <Accordion title="Темы" defaultOpen>
            <div className="ctorStub">
              Пока без пресетов: мы редактируем токены ниже и сразу видим результат в превью.
            </div>
          </Accordion>

          <Accordion title="Базовые стили" defaultOpen>
            <Row label="Background"><input type="color" value={String(tokens['color-bg'])} onChange={e=>setColor('color-bg', e.target.value)} /></Row>
            <Row label="Surface"><input type="color" value={String(tokens['color-surface'])} onChange={e=>setColor('color-surface', e.target.value)} /></Row>
            <Row label="Card"><input type="color" value={String(tokens['color-card'])} onChange={e=>setColor('color-card', e.target.value)} /></Row>
            <Row label="Border"><input type="color" value={String(tokens['color-border'])} onChange={e=>setColor('color-border', e.target.value)} /></Row>
            <Row label="Text"><input type="color" value={String(tokens['color-text'])} onChange={e=>setColor('color-text', e.target.value)} /></Row>
            <Row label="Muted"><input type="color" value={String(tokens['color-muted'])} onChange={e=>setColor('color-muted', e.target.value)} /></Row>

            <div className="ctorHr" />

            <Row label="Brand"><input type="color" value={String(tokens['color-brand'])} onChange={e=>setColor('color-brand', e.target.value)} /></Row>
            <Row label="Brand soft"><input type="color" value={String(tokens['color-brand-soft'])} onChange={e=>setColor('color-brand-soft', e.target.value)} /></Row>
          </Accordion>

          <Accordion title="Кнопки">
            <Row label="Primary bg"><input type="color" value={String(tokens['btn-primary-bg'])} onChange={e=>setColor('btn-primary-bg', e.target.value)} /></Row>
            <Row label="Primary text"><input type="color" value={String(tokens['btn-primary-text'])} onChange={e=>setColor('btn-primary-text', e.target.value)} /></Row>
            <Row label="Secondary bg"><input type="color" value={String(tokens['btn-secondary-bg'])} onChange={e=>setColor('btn-secondary-bg', e.target.value)} /></Row>
            <Row label="Secondary text"><input type="color" value={String(tokens['btn-secondary-text'])} onChange={e=>setColor('btn-secondary-text', e.target.value)} /></Row>
          </Accordion>

          <Accordion title="Навбар / Overlay">
            <Row label="Tabbar bg"><input type="color" value={String(tokens['tabbar-bg'])} onChange={e=>setColor('tabbar-bg', e.target.value)} /></Row>
            <Row label="Tabbar text"><input type="color" value={String(tokens['tabbar-text'])} onChange={e=>setColor('tabbar-text', e.target.value)} /></Row>
            <Row label="Tabbar active"><input type="color" value={String(tokens['tabbar-active'])} onChange={e=>setColor('tabbar-active', e.target.value)} /></Row>
          </Accordion>

          <Accordion title="Радиусы">
            <Row label={`Card (${tokens['radius-card']}px)`}>
              <input type="range" min={0} max={32} value={Number(tokens['radius-card'])} onChange={e=>setNum('radius-card', Number(e.target.value))} />
            </Row>
            <Row label={`Button (${tokens['radius-btn']}px)`}>
              <input type="range" min={0} max={32} value={Number(tokens['radius-btn'])} onChange={e=>setNum('radius-btn', Number(e.target.value))} />
            </Row>
            <Row label={`Input (${tokens['radius-input']}px)`}>
              <input type="range" min={0} max={32} value={Number(tokens['radius-input'])} onChange={e=>setNum('radius-input', Number(e.target.value))} />
            </Row>
          </Accordion>

          <Accordion title="Тени / Glow">
            <Row label={`Shadow (${Number(tokens['shadow-a']).toFixed(2)})`}>
              <input type="range" min={0} max={1} step={0.01} value={Number(tokens['shadow-a'])} onChange={e=>setNum('shadow-a', Number(e.target.value))} />
            </Row>
            <Row label={`Glow (${Number(tokens['glow-a']).toFixed(2)})`}>
              <input type="range" min={0} max={1} step={0.01} value={Number(tokens['glow-a'])} onChange={e=>setNum('glow-a', Number(e.target.value))} />
            </Row>
          </Accordion>




          <Accordion title="Прозрачность">
  <Row label={`Surface α (${Number(tokens['a-surface']).toFixed(2)})`}>
    <input type="range" min={0} max={1} step={0.01}
      value={Number(tokens['a-surface'])}
      onChange={e=>setNum('a-surface', Number(e.target.value))}
    />
  </Row>

  <Row label={`Card α (${Number(tokens['a-card']).toFixed(2)})`}>
    <input type="range" min={0} max={1} step={0.01}
      value={Number(tokens['a-card'])}
      onChange={e=>setNum('a-card', Number(e.target.value))}
    />
  </Row>

  <Row label={`Overlay α (${Number(tokens['a-overlay']).toFixed(2)})`}>
    <input type="range" min={0} max={1} step={0.01}
      value={Number(tokens['a-overlay'])}
      onChange={e=>setNum('a-overlay', Number(e.target.value))}
    />
  </Row>

  <div className="ctorStub" style={{marginTop:10}}>
    Совет: в блоках/оверлеях используй <b>--color-card-a</b>/<b>--color-surface-a</b>, TG их понимает.
  </div>
</Accordion>



          

          <Accordion title="Шрифты">
            <Row label="Body font">
              <input
                className="ctorText"
                value={String(tokens['font-body'])}
                onChange={e=>updateThemeTokens?.({ 'font-body': e.target.value })}
              />
            </Row>
            <Row label="Head font">
              <input
                className="ctorText"
                value={String(tokens['font-head'])}
                onChange={e=>updateThemeTokens?.({ 'font-head': e.target.value })}
              />
            </Row>
            <Row label="Button font">
              <input
                className="ctorText"
                value={String(tokens['font-btn'])}
                onChange={e=>updateThemeTokens?.({ 'font-btn': e.target.value })}
              />
            </Row>

            <div className="ctorHr" />

            <Row label={`FW body (${tokens['fw-body']})`}>
              <input type="range" min={300} max={950} step={50} value={Number(tokens['fw-body'])} onChange={e=>setNum('fw-body', Number(e.target.value))} />
            </Row>
            <Row label={`FW head (${tokens['fw-head']})`}>
              <input type="range" min={300} max={950} step={50} value={Number(tokens['fw-head'])} onChange={e=>setNum('fw-head', Number(e.target.value))} />
            </Row>
            <Row label={`FW btn (${tokens['fw-btn']})`}>
              <input type="range" min={300} max={950} step={50} value={Number(tokens['fw-btn'])} onChange={e=>setNum('fw-btn', Number(e.target.value))} />
            </Row>
          </Accordion>
        </div>
      )}
    </div>
  );
}

export default ConstructorDrawer;
