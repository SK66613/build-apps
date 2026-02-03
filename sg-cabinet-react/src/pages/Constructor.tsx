import React from 'react';
import { useAppState } from '../app/appState';

const CTOR_BASE = '/panel-react/miniapp/app';
const CTOR_INDEX = `${CTOR_BASE}/index.html`;
const CTOR_TEMPLATES = `${CTOR_BASE}/templates.js?v=react_ctor`;
const CTOR_STUDIO = `${CTOR_BASE}/studio.js?v=react_ctor`;
const CTOR_CSS = `${CTOR_BASE}/studio.css?v=react_ctor`;

function ensureLink(id: string, href: string){
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id;
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

function ensureInlineScript(id: string, code: string){
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

function ensureScript(id: string, src: string){
  return new Promise<void>((res, rej) => {
    const ex = document.getElementById(id) as HTMLScriptElement | null;
    if (ex) return res();
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

export default function Constructor(){
  const { appId } = useAppState();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const bootedRef = React.useRef(false);

  const [status, setStatus] = React.useState<'loading'|'ready'|'error'>('loading');
  const [err, setErr] = React.useState<string>('');

  React.useEffect(() => {
    let cancelled = false;

    async function boot(){
      if (bootedRef.current) return;
      const host = hostRef.current;
      if (!host) return;

      setStatus('loading');
      setErr('');

      try{
        // same-origin API for constructor
        (window as any).CTOR_API_BASE = '';

        ensureLink('sg-ctor-css', CTOR_CSS);

        const r = await fetch(CTOR_INDEX, { credentials: 'include' });
        const html = await r.text();
        if (cancelled) return;

        const doc = new DOMParser().parseFromString(html, 'text/html');

        // execute inline scripts from ctor <head> (theme/embed/etc)
        const headInline = Array.from(doc.head.querySelectorAll('script')).filter(s => !s.src);
        headInline.forEach((s, i) => {
          const code = s.textContent || '';
          if (code.trim()) ensureInlineScript(`sg-ctor-head-inline-${i}`, code);
        });

        // inject body
        host.innerHTML = doc.body.innerHTML;

        // hide ctor internal appId switch UI (we control it from React)
        try{ const row = host.querySelector('.app-id-row') as HTMLElement | null; if (row) row.style.display = 'none'; }catch(_){}
        try{ const sw  = host.querySelector('.appSwitchBox') as HTMLElement | null; if (sw) sw.style.display = 'none'; }catch(_){}

        // IMPORTANT: templates before studio
        await ensureScript('sg-ctor-templates', CTOR_TEMPLATES);
        await ensureScript('sg-ctor-studio', CTOR_STUDIO);

        bootedRef.current = true;

        // push current appId
        if (appId){
          const input = host.querySelector('#app_id') as HTMLInputElement | null;
          if (input) input.value = String(appId);
          window.dispatchEvent(new CustomEvent('sg:appchange', { detail: { appId } }));
        }

        setStatus('ready');
      }catch(e: any){
        console.error('[ctor boot error]', e);
        setErr(String(e?.message || e || 'unknown error'));
        setStatus('error');
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !bootedRef.current) return;
    if (!appId) return;

    const input = host.querySelector('#app_id') as HTMLInputElement | null;
    if (input) input.value = String(appId);
    window.dispatchEvent(new CustomEvent('sg:appchange', { detail: { appId } }));
  }, [appId]);

  return (
    <div style={{ height:'calc(100vh - 80px)', minHeight: 640 }}>
      {status === 'loading' && <div style={{ padding: 12, fontWeight: 900 }}>Загрузка конструктора…</div>}
      {status === 'error' && (
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 950 }}>Ошибка запуска конструктора</div>
          <div style={{ whiteSpace:'pre-wrap', opacity:.85 }}>{err}</div>
        </div>
      )}

      <div ref={hostRef} style={{ height:'100%', overflow:'auto', borderRadius: 18 }} />
    </div>
  );
}
