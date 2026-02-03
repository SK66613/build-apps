import React from 'react';
import { useAppState } from '../app/appState';

/**
 * Constructor embedded via SAME-ORIGIN iframe.
 *
 * Why iframe:
 *  - constructor (studio.js) relies on `window.location` and relative URLs
 *  - it contains its own preview iframe (../preview/...) and auth redirects
 *  - injecting DOM into React route breaks those paths
 *
 * Static assets are served from Vite `public/miniapp/*` and published under Vite `base`.
 * Example in prod:   /panel-react/miniapp/app/index.html
 */

const BASE_URL = (import.meta as any).env?.BASE_URL || '/'; // always ends with '/'

function buildCtorUrl(appId?: string | number | null) {
  const u = new URL(`${BASE_URL}miniapp/app/index.html`, window.location.origin);
  u.searchParams.set('embed', '1');
  if (appId) u.searchParams.set('app_id', String(appId));
  // soft cache-bust when switching projects, avoids stale ctor state in some browsers
  u.searchParams.set('v', String(Date.now()));
  return u.pathname + u.search;
}

export function ConstructorPage() {
  const { appId } = useAppState();
  const [src, setSrc] = React.useState<string>(() => buildCtorUrl(appId));

  React.useEffect(() => {
    setSrc(buildCtorUrl(appId));
  }, [appId]);

  return (
    <div className="sg-grid" style={{ gap: 14 }}>
      <div>
        <h1 className="sg-h1">Конструктор</h1>
        <div className="sg-sub">Редактирование вкладок и блоков, предпросмотр, публикация.</div>
      </div>

      <div
        style={{
          height: 'calc(100vh - 170px)',
          minHeight: 700,
          overflow: 'hidden',
          borderRadius: 18,
          background: 'transparent',
        }}
      >
        <iframe
          key={src}
          title="SG Constructor"
          src={src}
          style={{ width: '100%', height: '100%', border: 0, borderRadius: 18 }}
          // same-origin, needed for session cookies and internal fetch
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
        />
      </div>
    </div>
  );
}
