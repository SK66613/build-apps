/* TEMPLATES_BUILD: step20 */
console.log("[templates] build step20");

// === SG Blocks base (через /blocks/* прокси воркера) ===

// repo root через воркер-прокси
const BLOCKS_ROOT = (window.SG_BLOCKS_ROOT || (location.origin + '/blocks/'))
  .replace(/\/+$/,'/');          // <-- ВАЖНО: больше НЕ добавляем +'/'
window.SG_BLOCKS_ROOT = BLOCKS_ROOT;

// где реально лежат папки блоков в репо
const LIB_BASE = (window.SG_BLOCKS_BASE || (BLOCKS_ROOT + 'blocks/'))
  .replace(/\/+$/,'/');          // <-- ВАЖНО: больше НЕ добавляем +'/'
window.SG_BLOCKS_BASE = LIB_BASE;

// индекс лежит в dist
const INDEX_URL = BLOCKS_ROOT + 'dist/blocks/index.json';
window.SG_BLOCKS_INDEX_URL = INDEX_URL;






window.PagePresets = {
  home: [],
  play: [],
  tournament: [],
  bonuses: [],
  profile: [],
  custom: [],
};

window.DefaultTheme = `
  :root{--tg-bg:#0f1219;--tg-fg:#e8f0ff;--tg-sub:#97aac4;--line:rgba(255,255,255,.1);--acc:#7C5CFF}
  html,body{height:100%} body{margin:0;background:var(--tg-bg);color:var(--tg-fg);font:14px/1.5 Inter,system-ui}
  .hero{padding:16px 16px 8px}.hero h1{margin:0 0 6px}.hero p{margin:0;color:var(--tg-sub)}
  .section-block{margin:10px 16px 4px;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.02);}
  .section-title{font-weight:600;font-size:13px;letter-spacing:.02em;text-transform:uppercase;opacity:.8;}
  .section-note{margin-top:2px;font-size:12px;color:var(--tg-sub);}

  /* prevent tall / non-square images from "spreading" the layout */
  .hero-img,.promo-img{display:block;width:100%;height:180px;object-fit:cover;border-radius:16px;margin:6px 0;border:1px solid var(--line)}
  .features{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 16px}
  .features .card{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:16px;min-height:72px;display:grid;place-items:center}
  .promo{padding:12px 16px}.promo .banner{background:linear-gradient(135deg,#121826, rgba(124,92,255,.2));border:1px solid var(--line);border-radius:18px;padding:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 8px}
  .grid .tile{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:16px;min-height:72px;display:grid;place-items:center}
  .cta{padding:16px;display:grid;place-items:center}
  .btn.primary{background:var(--acc);border:0;color:#fff;height:40px;padding:0 16px;border-radius:12px}


/* ===== BONUS WHEEL (widget) ===== */
.bonus-card{ padding:14px; overflow:hidden; }
.bonus-card .h2{ margin:0 0 8px; font-weight:800; font-size:18px; }
.bonus-head{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:0 0 10px; }
.picked-pill{ display:flex; align-items:center; gap:10px; min-height:40px; padding:8px 12px; border-radius:999px;
  border:1px solid var(--line, rgba(255,255,255,.12)); background:rgba(255,255,255,.04); font-weight:700; }
.picked-pill img{ width:28px; height:28px; border-radius:8px; object-fit:cover; display:block; }
.picked-pill.muted{ opacity:.7; font-weight:600;
  background: linear-gradient(135deg, rgba(61,224,197,.12), rgba(123,91,255,.16)); }

.bonus-wheel{ position:relative; height:180px; overflow:hidden; border-radius:14px;
  background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0) 60%); margin-top:6px; }
.bonus-wheel .wheel-track{ position:relative; width:100%; height:100%; touch-action:pan-x; user-select:none; cursor:grab; }
.bonus-card.dragging .wheel-track{ cursor:grabbing; }

.bonus-wheel .bonus{ all:unset; position:absolute; left:50%; top:50%; width:96px; height:96px; border-radius:16px;
  overflow:hidden; transform:translate(-50%,-50%); will-change:transform;
  transition:transform .25s ease, filter .25s ease, opacity .25s ease, box-shadow .25s ease; }
.bonus-wheel .bonus img{ width:100%; height:100%; object-fit:cover; display:block; }
.bonus-wheel .bonus span{ position:absolute; left:50%; bottom:-22px; transform:translateX(-50%); font-size:12px; opacity:.85;
  white-space:nowrap; pointer-events:none; }
.bonus-wheel .bonus:not(.active){ filter:grayscale(.18) brightness(.95); opacity:.9; }
.bonus-wheel .bonus.active{
  box-shadow: 0 0 0 2px rgba(123,91,255,.55) inset, 0 10px 28px rgba(123,91,255,.35), 0 0 22px rgba(61,224,197,.25);
}
.bonus-wheel .wheel-center{ pointer-events:none; position:absolute; inset:0;
  background: radial-gradient(ellipse at center, rgba(123,91,255,.10), transparent 55%);
  mask: linear-gradient(#000 30%, transparent 80%); }

.bonus-card .actions{ margin-top:10px; display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:center; }
.bonus-card .actions .btn{ min-height:40px; }
.bonus-card [data-claim][disabled]{ opacity:.6; pointer-events:none; }
.bonus-card [data-picked]{ opacity:.8; }

/* toasts + confetti */
.toasts{ position:fixed; right:16px; bottom:calc(env(safe-area-inset-bottom,0px) + 16px);
  z-index:100000; display:grid; gap:8px; width:min(92vw,320px); pointer-events:none; }
.toast{ pointer-events:auto; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:14px; color:#fff;
  background:rgba(18,20,24,.96); border:1px solid rgba(255,255,255,.12);
  box-shadow:0 10px 24px rgba(0,0,0,.35); transform:translateX(120%); opacity:0; animation:toast-in .25s ease forwards; }
.toast--error{ border-color:rgba(255,107,107,.45); box-shadow:0 10px 24px rgba(255,107,107,.15); }
.toast--ok{ border-color:rgba(55,214,122,.45); box-shadow:0 10px 24px rgba(55,214,122,.15); }
.toast__close{ margin-left:auto; opacity:.7; background:transparent; border:0; color:inherit; cursor:pointer; }
@keyframes toast-in { to { transform:translateX(0); opacity:1; } }
@keyframes toast-out{ to { transform:translateX(120%); opacity:0; } }
#confetti { position: fixed; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:10000; }
.confetti-piece{ position: fixed; left: var(--x); top: var(--y); width:8px; height:8px; border-radius:2px;
  transform: translate(-50%,-50%); animation: confetti-fall .95s ease-out forwards; }
@keyframes confetti-fall { to { transform: translate(calc(var(--dx)), calc(var(--dy))) rotate(260deg); opacity:0; } }

`;

function presetBlocks(keys){
  return keys.map(k=>({id:'b_'+Math.random().toString(36).slice(2,9), key:k}));
}

window.IconSet = [
  {k:'home', label:'Дом', g:'●'},
  {k:'gamepad', label:'Игра', g:'▲'},
  {k:'cup', label:'Кубок', g:'★'},
  {k:'gift', label:'Подарок', g:'❖'},
  {k:'user', label:'Профиль', g:'☺'},
  {k:'heart', label:'Сердце', g:'♥'},
  {k:'star', label:'Звезда', g:'★'},
  {k:'cart', label:'Корзина', g:'🛒'},
  {k:'custom', label:'Свой…', g:'◌'}
];

window.Templates = {
  'Demo Main': {
    theme: window.DefaultTheme,
    blueprint: {
      app:{ name:'Demo', theme:{ css: window.DefaultTheme } },
      nav:{ type:'tabs', position:'bottom', routes:[
        {path:'/',title:'Главная',icon:'home', icon_g:'●', icon_img:'', kind:'home'},
        {path:'/play',title:'Играть',icon:'gamepad', icon_g:'▲', icon_img:'', kind:'play'},
        {path:'/tournament',title:'Турнир',icon:'cup', icon_g:'★', icon_img:'', kind:'tournament'},
        {path:'/bonuses',title:'Бонусы',icon:'gift', icon_g:'❖', icon_img:'', kind:'bonuses'},
        {path:'/profile',title:'Профиль',icon:'user', icon_g:'☺', icon_img:'', kind:'profile'},
      ]},
      routes:[
        {path:'/', blocks:presetBlocks(window.PagePresets.home)},
        {path:'/play', blocks:presetBlocks(window.PagePresets.play)},
        {path:'/tournament', blocks:presetBlocks(window.PagePresets.tournament)},
        {path:'/bonuses', blocks:presetBlocks(window.PagePresets.bonuses)},
        {path:'/profile', blocks:presetBlocks(window.PagePresets.profile)},
      ],
      blocks:{},   // id -> props
      dicts:{},
      games:{}
    }
  }
};


/* =====================================================================
   Blocks Library Loader (manifest-based)
   - loads /app/blocks/index.json
   - registers blocks into window.BlockRegistry
   ===================================================================== */
(function(){
  // БАЗА ДЛЯ БИБЛИОТЕКИ БЛОКОВ — через прокси воркера
  // БАЗА ДЛЯ БИБЛИОТЕКИ БЛОКОВ — через прокси воркера
// где реально лежат папки блоков в репо
const LIB_BASE = (window.SG_BLOCKS_BASE || (BLOCKS_ROOT + 'blocks/'))
  .replace(/\/+$/,'/');          // <-- ВАЖНО: больше НЕ добавляем +'/'
window.SG_BLOCKS_BASE = LIB_BASE;

// индекс лежит в dist
const INDEX_URL = BLOCKS_ROOT + 'dist/blocks/index.json';
window.SG_BLOCKS_INDEX_URL = INDEX_URL;


  const STYLE_ID = 'lib-blocks-style';

  function esc(s){ return String(s??''); }

  function applyTpl(tpl, props){
    // special placeholder for action attrs
    let actionAttrs = '';
    const act = props?.action || 'none';
    if (act === 'sheet' && props?.sheet_id){
      actionAttrs = `data-open-sheet="${esc(props.sheet_id).replace(/"/g,'&quot;')}"`;
    } else if (act === 'sheet_page' && props?.sheet_path){
      actionAttrs = `data-open-sheet-page="${esc(props.sheet_path).replace(/"/g,'&quot;')}"`;
    }
    return tpl
      .replace(/\{\{__action_attrs__\}\}/g, actionAttrs)
      .replace(/\{\{(\w+)\}\}/g, (_,k)=> esc(props?.[k] ?? ''));
  }

  function addStyle(cssText){
    if (!cssText) return;
    window.__BLOCK_LIB_CSS__ = (window.__BLOCK_LIB_CSS__||'') + '\n' + cssText;

    // main document
    try{
      let st = document.getElementById(STYLE_ID);
      if (!st){ st = document.createElement('style'); st.id = STYLE_ID; document.head.appendChild(st); }
      st.textContent = window.__BLOCK_LIB_CSS__;
    }catch(_){}

    // preview iframe (same-origin)
    try{
      const fr = document.getElementById('frame');
      const doc = fr && fr.contentDocument;
      if (!doc) return;
      let st2 = doc.getElementById(STYLE_ID);
      if (!st2){ st2 = doc.createElement('style'); st2.id = STYLE_ID; doc.head.appendChild(st2); }
      st2.textContent = window.__BLOCK_LIB_CSS__;
    }catch(_){}
  }

  async function fetchText(url){
    const r = await fetch(url, {cache:'no-store'});
    if (!r.ok) throw new Error('Fetch failed: '+url);
    return await r.text();
  }
  async function fetchJSON(url){
    const r = await fetch(url, {cache:'no-store'});
    if (!r.ok) throw new Error('Fetch failed: '+url);
    return await r.json();
  }

  async function loadBlock(id){
    const base = LIB_BASE + id + '/';
    const mf = await fetchJSON(base + 'block.json');
    if(!mf || !mf.id) throw new Error('Bad manifest: '+id);
    mf.__base = base;
    mf.__thumb = mf.thumb ? (base + mf.thumb) : '';

    // template
    const tplPath = mf.template || 'view.html';
    const tpl = await fetchText(base + tplPath);
    mf.__tpl = tpl;

    // css (concat)
    let css = '';
    try{
      const cssFiles = (mf.assets && mf.assets.css) || [];
      for(const f of cssFiles){
        try{ css += '\n' + await fetchText(base + f); }catch(_){ }
      }
    }catch(_){}
    if (css) addStyle(css);

    // runtime js modules (optional)
    mf.__runtime = null;
    try{
      const jsFiles = (mf.assets && mf.assets.js) || [];
      for(const f of jsFiles){
        try{
          const url = base + f + '?v=' + encodeURIComponent(mf.version||'1');
          const mod = await import(url);
          mf.__runtime = mf.__runtime || mod;
        }catch(e){ console.warn('Block runtime load failed', mf.id, f, e); }
      }
    }catch(_){}

    // register
    window.BlockRegistry = window.BlockRegistry || {};
    window.BlockRegistry[mf.id] = window.BlockRegistry[mf.id] || {};
    const reg = window.BlockRegistry[mf.id];
    reg.type = mf.type || reg.type || 'htmlEmbed';
    reg.title = mf.title || reg.title || mf.id;
    reg.category = mf.category || reg.category || 'Другое';
    reg.meta = mf.meta || reg.meta || {};
    // merge top-level tags into meta.tags for convenience
    if (mf.tags){ reg.meta.tags = Array.isArray(mf.tags)? mf.tags : [mf.tags]; }
    reg.thumb = mf.__thumb || reg.thumb || '';
    reg.defaults = mf.defaults || reg.defaults || {};
    reg.__mf = mf;

// Всегда подставляем шаблон в превью, независимо от типа блока
reg.html = tpl;
// Превью: возвращаем разметку блока с подстановкой пропсов
reg.preview = reg.preview || ((p)=> applyTpl(tpl, p || {}));



   
// init hook from runtime mount/unmount
if (mf.__runtime && (mf.__runtime.mount || mf.__runtime.unmount)){
  reg.init = function(el, props, ctx){
    // формируем финальный контекст: гарантируем base_url/public_id/tg
    const ctxFinal = Object.assign({}, ctx || {}, {
      base_url: (ctx && ctx.base_url) || mf.__base,                                   // /.../blocks/game_flappy/
      public_id: (ctx && ctx.public_id) || (window.currentPublicId || ''),            // превью может быть пустым — ок
      tg: (ctx && ctx.tg) || (window.Telegram && window.Telegram.WebApp) || null      // для хаптик/сабмита в проде
    });

    try{
      if (mf.__runtime.mount){
        const ret = mf.__runtime.mount(el, props || {}, ctxFinal);
        if (typeof ret === 'function') return ret;
      }
    }catch(e){ console.warn('Block mount failed', mf.id, e); }

    // безопасный unmount (даже если mount упал)
    return function(){
      try{ mf.__runtime && mf.__runtime.unmount && mf.__runtime.unmount(el, ctxFinal); }catch(_){}
    };
  };
}


    return mf;
  }

  window.BlockLibrary = {
    loaded:false,
    loading:null,
    async ensureLoaded(){
      if (this.loaded) return true;
      if (this.loading) return this.loading;
      this.loading = (async ()=>{
        try{
const index = await fetchJSON(INDEX_URL);


// поддерживаем 2 формата индекса:
// 1) ["calendar_booking", ...]
// 2) { blocks: [{key:"calendar_booking", ...}, ...] }
let ids = [];
if (Array.isArray(index)) {
  ids = index;
} else if (index && Array.isArray(index.blocks)) {
  ids = index.blocks.map(b => b.key || b.id).filter(Boolean);
}
for (const id of ids) {
  try{ await loadBlock(id); }catch(e){ console.warn('Block load failed', id, e); }


          }
          this.loaded = true;
          return true;
        }catch(e){
          console.warn('Blocks index load failed', e);
          this.loaded = true; // fail-open
          return false;
        }
      })();
      return this.loading;
    },
    // allow manual style re-apply after iframe reload
    applyStyles(){ addStyle(''); }
  };

  // try to load ASAP, but Studio will also await this before rendering list
  try{ window.BlockLibrary.ensureLoaded(); }catch(_){}
})();
