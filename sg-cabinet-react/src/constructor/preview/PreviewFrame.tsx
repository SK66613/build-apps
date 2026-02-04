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

export function PreviewFrame(){
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);

  const appId = useConstructorStore(s=>s.appId);
  const bp = useConstructorStore(s=>s.blueprint);
  const selected = useConstructorStore(s=>s.selected);
  const selectRoute = useConstructorStore(s=>s.selectRoute);
  const selectBlock = useConstructorStore(s=>s.selectBlock);

  const src = React.useMemo(()=>buildPreviewUrl(appId), [appId]);

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
        // preview initiated navigation (e.g. clicking bottom tabs)
        selectRoute(d.path);
      }
      if (d.type === 'block:edit' && d.id){
        // preview asked to edit a block
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

    return (
    <div className="sg-card ctor-card ctor-preview">
      <iframe
        ref={frameRef}
        key={src}
        title="Miniapp preview"
        src={src}
        className="ctor-preview__frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );

}
