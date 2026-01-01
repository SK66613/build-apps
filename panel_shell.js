(function(){
  const API_BASE = (window.API_BASE || 'https://build-apps.cyberian13.workers.dev').replace(/\/$/,'');
  const AUTH_URL = (window.SG_AUTH_URL || '/auth.html'); // relative to cabinet.salesgenius.ru
  const LOGOUT_KEY = 'sg_logout_ts';
  const CURRENT_APP_KEY = 'sg_current_app';

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('sg_auth') : null;
  function broadcastLogout(){
    try{ localStorage.setItem(LOGOUT_KEY, String(Date.now())); }catch(_){}
    try{ bc && bc.postMessage('logout'); }catch(_){}
  }
  function redirectToAuth(){
    // preserve "next" so after login can return
    let target = '/auth.html';
    try{
      const u = new URL(location.href);
      const next = u.pathname + u.search + u.hash;
      const a = new URL('/auth.html', location.origin);
      a.searchParams.set('next', next);
      target = a.toString();
    }catch(_){}
    try{
      if (window.top && window.top !== window.self){
        window.top.location.href = target;
        return;
      }
    }catch(_){}
    try{
      location.href = target;
    }catch(_){
      location.href = AUTH_URL;
    }
  }

  window.addEventListener('storage', (e)=>{
    if (e.key === LOGOUT_KEY && e.newValue){
      redirectToAuth();
    }
  });
  if (bc){
    bc.onmessage = (ev)=>{
      if (ev && ev.data === 'logout') redirectToAuth();
    };
  }

  async function api(path, opts){
    try{
      const res = await fetch(API_BASE + path, Object.assign({
        credentials:'include',
        headers:{'Content-Type':'application/json'}
      }, opts||{}));
      let data=null;
      try{ data = await res.json(); }catch(_){}
      return {res,data};
    }catch(err){
      return {res:null,data:null,error:err};
    }
  }

  async function authMe(){
    const {res,data} = await api('/api/auth/me', {method:'GET'});
    if (!res || !res.ok || !data || !data.ok || !data.authenticated){
      return null;
    }
    return data.user || {};
  }

  async function guardAuth(){
    // allow pages to opt-out
    if (document.documentElement.hasAttribute('data-auth-off')) return;
    const user = await authMe();
    if (!user) { redirectToAuth(); return null; }
    window.SG_USER = user;
    return user;
  }

  function getAppId(){
    const sp = new URLSearchParams(location.search||'');
    const q = sp.get('app');
    if (q) return q;
    try{ return localStorage.getItem(CURRENT_APP_KEY) || ''; }catch(_){}
    return '';
  }
  function setAppId(id){
    if(!id) return;
    try{ localStorage.setItem(CURRENT_APP_KEY, id); }catch(_){}
  }

  function navigateWithApp(appId){
    if(!appId) return;
    setAppId(appId);
    const u = new URL(location.href);
    u.searchParams.set('app', appId);
    location.href = u.toString();
  }

  async function loadApps(){
    const {res,data} = await api('/api/my/apps', {method:'GET'});
    if (!res || !res.ok || !data || !data.ok) return [];
    // worker: {apps:[...]} or {items:[...]}
    return data.apps || data.items || [];
  }

  function appTitle(app){
    return app.title || app.name || app.bot_name || app.slug || ('App ' + (app.app_id||app.id||''));
  }
  function appIdOf(app){
    return String(app.app_id || app.id || app.slug || '');
  }

  function renderSwitcher(apps){
    const sel = document.getElementById('appSwitchGlobal') || document.getElementById('appSwitch');
    if (!sel) return;

    // fill
    sel.innerHTML = '';
    apps.forEach(app=>{
      const id = appIdOf(app);
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = appTitle(app);
      sel.appendChild(opt);
    });

    const current = getAppId();
    if (current && [...sel.options].some(o=>o.value===current)){
      sel.value = current;
    }else if (sel.options.length){
      sel.value = sel.options[0].value;
      setAppId(sel.value);
      // if page needs app param for correct content, set it but don't loop if already set
      if (!new URLSearchParams(location.search||'').get('app')){
        navigateWithApp(sel.value);
        return;
      }
    }

    // also set visible title if exists
    const titleEl = document.getElementById('projectName') || document.getElementById('botTitle');
    if (titleEl){
      const chosen = apps.find(a=>appIdOf(a)===sel.value);
      if (chosen) titleEl.textContent = appTitle(chosen);
    }

    sel.addEventListener('change', ()=>{
      const id = sel.value;
      navigateWithApp(id);
    });
  }

  // expose helpers
  window.SG_SHELL = { api, guardAuth, loadApps, renderSwitcher, broadcastLogout, redirectToAuth };

  document.addEventListener('DOMContentLoaded', async ()=>{
    const user = await guardAuth();
    if (!user) return;
    const apps = await loadApps();
    window.SG_APPS = apps;
    renderSwitcher(apps);
  });
})();
