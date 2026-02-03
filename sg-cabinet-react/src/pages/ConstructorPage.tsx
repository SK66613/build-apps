import React from 'react';
import { useAppState } from '../app/appState';

/**
 * Constructor embedded natively into React (NO iframe).
 * Assets are served under: /panel-react/miniapp/app/*
 *
 * Requirements:
 *  - /panel-react/miniapp/app/index.html
 *  - /panel-react/miniapp/app/templates.js
 *  - /panel-react/miniapp/app/studio.js
 *  - /panel-react/miniapp/app/studio.css
 *
 * Behavior:
 *  - Loads index.html and injects BODY into host div
 *  - Executes inline <script> from HEAD (theme/embed)
 *  - Loads templates.js then studio.js (order matters)
 *  - Hides internal app switch UI inside constructor (React controls appId)
 *  - On appId change -> updates #app_id and dispatches `sg:appchange`
 */

const CTOR_BASE = '/panel-react/miniapp/app';
const CTOR_INDEX = `${CTOR_BASE}/index.html`;
const CTOR_CSS = `${CTOR_BASE}/studio.css?v=react_ctor`;
const CTOR_TEMPLATES = `${CTOR_BASE}/templates.js?v=react_ctor`;
const CTOR_STUDIO = `${CTOR_BASE}/studio.js?v=react_ctor`;

function ensureLink(id: string, href: string) {
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id;
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

function ensureInlineScript(id: string, code: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

function ensureScript(id: string, src: string) {
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

function hideCtorInternalSwitchers(host: HTMLElement) {
  // these exist in your ctor UI; we control appId from React instead
  try {
    const row = host.querySelector('.app-id-row') as HTMLElement | null;
    if (row) row.style.display = 'none';
  } catch (_) {}

  try {
    const sw = host.querySelector('.appSwitchBox') as HTMLElement | null;
    if (sw) sw.style.display = 'none';
  } catch (_) {}
}

function setCtorAppId(host: HTMLElement, appId: string) {
  const input = host.querySelector('#app_id') as HTMLInputElement | null;
  if (input) input.value = String(appId);

  // notify ctor engine to reload
  try {
    window.dispatchEvent(new CustomEvent('sg:appchange', { detail: { appId } }));
  } catch (_) {}
}

export function ConstructorPage() {
  const { appId } = useAppState();

  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const bootedRef = React.useRef(false);

  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = React.useState<string>('');

  // Boot once
  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (bootedRef.current) return;
      const host = hostRef.current;
      if (!host) return;

      setStatus('loading');
      setErr('');

      try {
        // Your ctor uses this to call same-origin endpoints
        (window as any).CTOR_API_BASE = '';

        // Ensure ctor CSS
        ensureLink('sg-ctor-css', CTOR_CSS);

        // Fetch index.html
        const r = await fetch(CTOR_INDEX, { credentials: 'include' });
        if (!r.ok) throw new Error(`CTOR index HTTP ${r.status}`);
        const html = await r.text();
        if (cancelled) return;

        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Execute inline scripts from <head> (theme/embed logic etc)
        const headInlineScripts = Array.from(doc.head.querySelectorAll('script')).filter((s) => !s.src);
        headInlineScripts.forEach((s, i) => {
          const code = s.textContent || '';
          if (code.trim()) ensureInlineScript(`sg-ctor-head-inline-${i}`, code);
        });

        // Inject body markup into host
        host.innerHTML = doc.body.innerHTML;

        // Hide internal project switchers
        hideCtorInternalSwitchers(host);

        // Load scripts in correct order
        // (IMPORTANT: templates.js must be loaded before studio.js)
        await ensureScript('sg-ctor-templates', CTOR_TEMPLATES);
        await ensureScript('sg-ctor-studio', CTOR_STUDIO);

        bootedRef.current = true;

        // Set initial appId if already selected
        if (appId) setCtorAppId(host, String(appId));

        setStatus('ready');
      } catch (e: any) {
        console.error('[ConstructorPage boot error]', e);
        setErr(String(e?.message || e || 'unknown error'));
        setStatus('error');
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  // Update appId when project changes
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !bootedRef.current) return;
    if (!appId) return;

    setCtorAppId(host, String(appId));
  }, [appId]);

  return (
    <div className="sg-grid" style={{ gap: 14 }}>
      <div>
        <h1 className="sg-h1">Конструктор</h1>
        <div className="sg-sub">Редактирование вкладок и блоков, предпросмотр, публикация.</div>
      </div>

      {status === 'loading' && (
        <div style={{ padding: 12, fontWeight: 900 }}>Загрузка конструктора…</div>
      )}

      {status === 'error' && (
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Ошибка запуска конструктора</div>
          <div style={{ whiteSpace: 'pre-wrap', opacity: 0.85 }}>{err}</div>
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            Проверь Network/Console: нет ли 404 на <code>index.html</code>, <code>templates.js</code>,{' '}
            <code>studio.js</code>, <code>studio.css</code>.
          </div>
        </div>
      )}

      {/* host for injected constructor DOM */}
      <div
        ref={hostRef}
        style={{
          height: 'calc(100vh - 170px)',
          minHeight: 700,
          overflow: 'auto',
          borderRadius: 18,
          background: 'transparent',
        }}
      />
    </div>
  );
}
