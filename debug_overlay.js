
(function(){
  // включение: ?debug=1 или localStorage.sg_debug="1"
  const params = new URLSearchParams(location.search);
  const enabled = params.get('debug') === '1' || localStorage.getItem('sg_debug') === '1';
  if (!enabled) return;

  const MAX = 500;
  const panelId = 'sgDebugOverlay';
  const storeKey = 'sg_debug_logs';
  const now = () => new Date().toISOString().slice(11,23);
  const safe = (v) => {
    try {
      if (v instanceof Error) return v.stack || v.message || String(v);
      if (typeof v === 'string') return v;
      return JSON.stringify(v);
    } catch(_) { return String(v); }
  };

  let logs = [];
  try { logs = JSON.parse(sessionStorage.getItem(storeKey)||'[]'); } catch(_){}

  function push(type, ...args){
    const line = `[${now()}] ${type}: ` + args.map(safe).join(' ');
    logs.push(line);
    if (logs.length > MAX) logs.splice(0, logs.length - MAX);
    try { sessionStorage.setItem(storeKey, JSON.stringify(logs)); } catch(_){}
    render();
  }

  function cssBtn(){
    return "background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#e6edf3;padding:6px 8px;border-radius:10px;cursor:pointer";
  }

  function create(){
    if (document.getElementById(panelId)) return;
    const root = document.createElement('div');
    root.id = panelId;
    root.style.cssText =
      "position:fixed;z-index:999999;left:10px;right:10px;bottom:10px;max-height:55vh;" +
      "background:rgba(10,12,16,.92);color:#e6edf3;border:1px solid rgba(255,255,255,.12);" +
      "border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);" +
      "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow:hidden";
    root.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;padding:10px 10px 8px;border-bottom:1px solid rgba(255,255,255,.10)">
        <div style="font-weight:800">SG Debug</div>
        <div id="sgDbgMeta" style="opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1"></div>
        <button data-a="me" style="${cssBtn()}">/api/me</button>
        <button data-a="copy" style="${cssBtn()}">Copy</button>
        <button data-a="clear" style="${cssBtn()}">Clear</button>
        <button data-a="hide" style="${cssBtn()}">Hide</button>
      </div>
      <pre id="sgDbgLog" style="margin:0;padding:10px;overflow:auto;max-height:calc(55vh - 44px)"></pre>
    `;
    document.body.appendChild(root);

    root.addEventListener('click', async (e)=>{
      const b = e.target.closest('button'); if (!b) return;
      const a = b.getAttribute('data-a');
      if (a === 'hide') root.style.display = 'none';
      if (a === 'clear') { logs=[]; sessionStorage.removeItem(storeKey); render(); }
      if (a === 'copy') {
        const text = logs.join('\n');
        try { await navigator.clipboard.writeText(text); push('INFO', 'copied'); }
        catch(_) { push('WARN', 'clipboard failed; dumping to console'); console.log(text); }
      }
      if (a === 'me') await testMe();
    });

    meta();
    render();
  }

  function render(){
    const el = document.getElementById('sgDbgLog');
    if (!el) return;
    el.textContent = logs.join('\n');
    el.scrollTop = el.scrollHeight;
  }

  function meta(){
    const el = document.getElementById('sgDbgMeta');
    if (!el) return;
    const m = [
      `host=${location.host}`,
      `path=${location.pathname}`,
      `API_BASE=${window.API_BASE || '-'}`,
      `SG_BLOCKS_ROOT=${window.SG_BLOCKS_ROOT || '-'}`,
      `SG_BLOCKS_BASE=${window.SG_BLOCKS_BASE || '-'}`,
      `SG_BLOCKS_INDEX_URL=${window.SG_BLOCKS_INDEX_URL || '-'}`,
    ].join(' | ');
    el.textContent = m;
    push('META', m);
  }

  // ---- console capture
  const orig = { log:console.log, warn:console.warn, error:console.error, info:console.info, debug:console.debug };
  ['log','warn','error','info','debug'].forEach((k)=>{
    console[k] = function(...args){
      push(k.toUpperCase(), ...args);
      return orig[k].apply(console, args);
    };
  });

  // ---- errors
  window.addEventListener('error', (e)=> push('WINDOW.ERROR', e.message, (e.filename||'') + ':' + e.lineno + ':' + e.colno));
  window.addEventListener('unhandledrejection', (e)=> push('UNHANDLED', e.reason));

  // ---- navigation hooks
  const _pushState = history.pushState.bind(history);
  history.pushState = function(s,t,u){ push('NAV', 'pushState', u||''); return _pushState(s,t,u); };
  const _replaceState = history.replaceState.bind(history);
  history.replaceState = function(s,t,u){ push('NAV', 'replaceState', u||''); return _replaceState(s,t,u); };
  window.addEventListener('popstate', ()=> push('NAV','popstate', location.href));

  // ---- fetch interceptor (logs status/time + detects redirects)
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = (typeof input === 'string') ? input : (input && input.url) ? input.url : String(input);
    const method = (init && init.method) ? init.method : 'GET';
    const cred = (init && init.credentials) ? init.credentials : 'default';
    const t0 = performance.now();
    try{
      const res = await nativeFetch(input, init);
      const ms = Math.round(performance.now() - t0);
      push('FETCH', method, res.status, `${ms}ms`, `cred=${cred}`, url, res.redirected ? '(redirected)' : '');
      return res;
    }catch(err){
      const ms = Math.round(performance.now() - t0);
      push('FETCH_FAIL', method, `${ms}ms`, `cred=${cred}`, url, err);
      throw err;
    }
  };

  // ---- XHR interceptor (если где-то старый XHR)
  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const _open = XHR.prototype.open;
    XHR.prototype.open = function(method, url){
      this.__sg_method = method; this.__sg_url = url;
      return _open.apply(this, arguments);
    };
    const _send = XHR.prototype.send;
    XHR.prototype.send = function(){
      const t0 = performance.now();
      this.addEventListener('loadend', ()=>{
        const ms = Math.round(performance.now() - t0);
        push('XHR', this.__sg_method, this.status, `${ms}ms`, this.__sg_url);
      });
      return _send.apply(this, arguments);
    };
  }

  async function testMe(){
    const base = window.API_BASE || ''; // если у тебя API_BASE есть
    const url = (base ? base.replace(/\/$/,'') : '') + '/api/auth/me';
    push('TEST', 'GET', url || '/api/auth/me');
    try{
      const r = await nativeFetch(url || '/api/auth/me', { credentials:'include', cache:'no-store' });
      const txt = await r.text();
      push('TEST', 'me status', r.status, 'len', txt.length, 'head', JSON.stringify(txt.slice(0,120)));
    }catch(e){
      push('TEST', 'me failed', e);
    }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ create(); push('INFO','debug enabled'); }, { once:true });
  } else {
    create(); push('INFO','debug enabled');
  }

  // helper toggles
  window.SG_DEBUG = {
    on(){ localStorage.setItem('sg_debug','1'); location.reload(); },
    off(){ localStorage.removeItem('sg_debug'); location.reload(); },
    meta
  };
})();

