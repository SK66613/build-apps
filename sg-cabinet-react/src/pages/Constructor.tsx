import React from 'react';
import { useAppState } from '../app/appState';

const CTOR_BASE = '/miniapp_sections_fixed2/app';
const CTOR_INDEX = `${CTOR_BASE}/index.html`;
const CTOR_TEMPLATES = `${CTOR_BASE}/templates.js`;
const CTOR_STUDIO = `${CTOR_BASE}/studio.js`;
const CTOR_CSS = `${CTOR_BASE}/studio.css`;

function ensureLink(id: string, href: string){
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id;
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

function ensureScript(id: string, src: string){
  return new Promise<void>((res, rej) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) return res();

    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

function ensureStyle(id: string, cssText: string){
  if (document.getElementById(id)) return;
  const st = document.createElement('style');
  st.id = id;
  st.textContent = cssText;
  document.head.appendChild(st);
}

export default function Constructor(){
  const { appId } = useAppState();
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const bootedRef = React.useRef(false);

  // 1) boot once: inject html body + styles + scripts
  React.useEffect(() => {
    let cancelled = false;

    async function boot(){
      if (bootedRef.current) return;
      const host = hostRef.current;
      if (!host) return;

      // CSS
      ensureLink('sg-ctor-css', CTOR_CSS);

      // CTOR API base (same-origin worker routes)
      (window as any).CTOR_API_BASE = '';

      // Load index.html and inject body content into host
      const r = await fetch(CTOR_INDEX, { credentials: 'include' });
      const html = await r.text();
      if (cancelled) return;

      const doc = new DOMParser().parseFromString(html, 'text/html');

      // take ALL <style> from ctor head (там важные инлайны)
      const headStyles = Array.from(doc.head.querySelectorAll('style'));
      headStyles.forEach((st, i) => ensureStyle(`sg-ctor-inline-style-${i}`, st.textContent || ''));

      // inject body
      host.innerHTML = doc.body.innerHTML;

      // hide stuff that embed=1 would hide (чтобы не было дубля выбора app_id в ctor)
      try{
        const row = host.querySelector('.app-id-row') as HTMLElement | null;
        if (row) row.style.display = 'none';
        const sw = host.querySelector('.appSwitchBox') as HTMLElement | null;
        if (sw) sw.style.display = 'none';
      }catch(_){}

      // scripts (важно: templates.js ДО studio.js)
      await ensureScript('sg-ctor-templates', CTOR_TEMPLATES);
      await ensureScript('sg-ctor-studio', CTOR_STUDIO);

      bootedRef.current = true;

      // after boot: set current appId if exists
      if (appId){
        const input = host.querySelector('#app_id') as HTMLInputElement | null;
        if (input) input.value = String(appId);

        // tell ctor to reload
        window.dispatchEvent(new CustomEvent('sg:appchange', { detail: { appId } }));
      }
    }

    boot().catch((e)=>console.error('[ctor boot]', e));

    return () => { cancelled = true; };
  }, []); // boot once

  // 2) when appId changes: push into ctor and reload ctor data
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !bootedRef.current) return;
    if (!appId) return;

    const input = host.querySelector('#app_id') as HTMLInputElement | null;
    if (input) input.value = String(appId);

    window.dispatchEvent(new CustomEvent('sg:appchange', { detail: { appId } }));
  }, [appId]);

  return (
    <div style={{ height: 'calc(100vh - 72px)', minHeight: 640 }}>
      <div
        ref={hostRef}
        style={{
          height: '100%',
          overflow: 'hidden',
          borderRadius: 18,
          background: 'transparent',
        }}
      />
    </div>
  );
}
