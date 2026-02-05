import React from 'react';
import { useConstructorStore } from '../state/constructorStore';

const BASE_URL = (import.meta as any).env?.BASE_URL || '/';

function buildPreviewUrl(appId?: string | null){
  const u = new URL(`${BASE_URL}miniapp/preview/index.html`, window.location.origin);
  u.searchParams.set('embed','1');
  if (appId) u.searchParams.set('app_id', String(appId));
  u.searchParams.set('preview','draft');
  u.searchParams.set('v', String(Date.now()));
  return u.pathname + u.search;
}

type PresetKey = 'iphone13' | 'iphoneSE' | 'pixel7';
const PRESETS: Record<PresetKey, { label: string; w: number; h: number; radius: number }> = {
  iphone13: { label: 'iPhone 13', w: 390, h: 844, radius: 44 },
  iphoneSE: { label: 'iPhone SE', w: 375, h: 667, radius: 34 },
  pixel7:   { label: 'Pixel 7',   w: 412, h: 915, radius: 38 },
};

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

export function PreviewFrame(){
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const appId = useConstructorStore(s=>s.appId);
  const bp = useConstructorStore(s=>s.blueprint);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);
  const selectBlock = useConstructorStore(s=>s.selectBlock);

  // (опционально) экшены — если есть в сторе, подключатся. Если нет — останутся заглушки.
  const undo = useConstructorStore((s:any)=>s.undo);
  const redo = useConstructorStore((s:any)=>s.redo);
  const saveNow = useConstructorStore((s:any)=>s.saveNow || s.saveBlueprint);

  const src = React.useMemo(()=>buildPreviewUrl(appId), [appId]);

  // presets + zoom (как в старом)
  const [preset, setPreset] = useLS<PresetKey>('ctor_preset', 'iphone13');
  const [zoom, setZoom] = useLS<number>('ctor_zoom', 100);
  const p = PRESETS[preset];

  // push bp into preview
  const post = React.useCallback((msg:any)=>{
    try{ frameRef.current?.contentWindow?.postMessage(msg, '*'); }catch(_){ }
  },[]);

  React.useEffect(()=>{
    const onMsg = (e: MessageEvent)=>{
      const d:any = e.data || {};
      if (d.type === 'ready'){
        post({ type:'bp:inline', bp });
        if (selected?.kind === 'route') post({ type:'nav:go', path: selected.path });
        if (selected?.kind === 'block') post({ type:'block:focus', id: selected.id });
      }
      if (d.type === 'nav:go' && typeof d.path === 'string'){
        selectRoute(d.path);
      }
      if (d.type === 'block:edit' && d.id){
        const path = typeof d.path === 'string' ? d.path : (selected?.kind ? (selected as any).path : '/');
        selectBlock(path, String(d.id));
      }
    };
    window.addEventListener('message', onMsg);
    return ()=>window.removeEventListener('message', onMsg);
  }, [bp, post, selected, selectRoute, selectBlock]);

  // throttle live updates
  React.useEffect(()=>{
    const t = setTimeout(()=> post({ type:'bp:inline', bp }), 80);
    return ()=>clearTimeout(t);
  }, [bp, post]);

  // reflect selection
  React.useEffect(()=>{
    if (selected?.kind === 'route'){
      post({ type:'nav:go', path: selected.path });
    }
    if (selected?.kind === 'block'){
      post({ type:'nav:go', path: selected.path });
      post({ type:'block:focus', id: selected.id });
    }
  }, [selected, post]);

  const scale = Math.max(30, Math.min(130, Number(zoom) || 100)) / 100;

  const canUndo = typeof undo === 'function';
  const canRedo = typeof redo === 'function';

  return (
    <div className="sg-card ctor-card ctor-preview ctor-preview--phone">
      {/* top controls like old, but style like Design/Panel */}
<div className="ctor-preview__hdr">
  {/* Плашка как у Дизайн/Панель */}
  <div className="ctorSeg ctorPreviewSeg">
    {Object.entries(PRESETS).map(([k, v]) => (
      <button
        key={k}
        className={'ctorSeg__btn' + (preset === (k as PresetKey) ? ' is-active' : '')}
        onClick={()=>setPreset(k as PresetKey)}
        type="button"
      >
        {v.label}
      </button>
    ))}

    {/* сюда потом добавим Undo/Redo/Save/Publish в том же стиле */}
    <button className="ctorSeg__btn" type="button" title="Отменить">↶</button>
    <button className="ctorSeg__btn" type="button" title="Вернуть">↷</button>
    <button className="ctorSeg__btn" type="button">Сохранить</button>
    <button className="ctorSeg__btn is-active" type="button">Опубликовать</button>
  </div>


        {/* zoom как было */}
        <div className="ctor-preview__zoom">
          <div className="ctor-preview__zoomLbl">Масштаб</div>
          <input
            className="ctor-preview__zoomSlider"
            type="range"
            min={30}
            max={130}
            value={zoom}
            onChange={(e)=>setZoom(Number(e.target.value))}
          />
          <div className="ctor-preview__zoomVal">{Math.round(scale*100)}%</div>
        </div>
      </div>

      {/* phone stage */}
      <div className="ctor-preview__stage">
        <div className="ctor-phoneDock" style={{ transform: `scale(${scale})` }}>
          <div
            className="ctor-phone"
            style={{
              width: p.w,
              height: p.h,
              borderRadius: p.radius,
            }}
          >
            <div className="ctor-notch" />
            <div className="ctor-screen">
              <iframe
                ref={frameRef}
                key={src}
                title="Miniapp preview"
                src={src}
                className="ctor-preview__frame"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
