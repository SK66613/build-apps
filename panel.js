(function(){
  const html = document.documentElement;
  const themeSwitch = document.getElementById('themeSwitch');
  const side = document.getElementById('side');
  // const sideCollapse = document.getElementById('sideCollapse'); // removed: sidebar always expanded
  const sideNav = document.getElementById('sideNav');
  const views = Array.from(document.querySelectorAll('.view[data-view]'));
  const pageTitle = document.getElementById('pageTitle');
  const pageSub = document.getElementById('pageSub');
  const settingsTabs = document.getElementById('settingsTabs');
  const ctorFrame = document.getElementById('ctorFrame');

  

  function sendThemeToCtor(){
    try{
      if (!ctorFrame || !ctorFrame.contentWindow) return;
      const t = html.getAttribute('data-theme') || 'dark';
      ctorFrame.contentWindow.postMessage({type:'theme', theme:t}, '*');
    }catch(_){}
  }

  function setMode(viewId){
    document.body.classList.toggle('mode-constructor', viewId === 'constructor');
    // when entering constructor, push theme into iframe
    if (viewId === 'constructor') setTimeout(sendThemeToCtor, 50);
  }
const META = {
    constructor:{t:'Конструктор',s:'Редактирование страниц, блоков и настроек mini‑app.'},
    entities:{t:'Сущности',s:'Настройка сущностей mini‑app: товары, услуги, игры, страницы.'},
    faq:{t:'Вопрос‑ответ (FAQ)',s:'Частые вопросы и ответы, которые бот отправляет автоматически.'},
    broadcasts:{t:'Рассылки',s:'Кампании, сегменты и расписания отправок.'},
    channels:{t:'Подключения каналов',s:'Интеграции: Telegram, Webhook, CRM, касса, Google Sheets.'},
    stats:{t:'Статистика',s:'KPI, активность пользователей, продажи и вовлечённость.'},
    dialogs:{t:'Диалоги',s:'Обращения пользователей и ответы оператора.'},
    settings:{t:'Настройки бота',s:'Основные параметры, интеграции и безопасность.'},
    support:{t:'Поддержка',s:'Связь с поддержкой и статусы заявок.'},
    help:{t:'Справочный центр',s:'Инструкции и гайды по настройке.'},
    profile:{t:'Профиль',s:'Аккаунт, доступы, уведомления.'},
  };

  function applyTheme(next){
    html.setAttribute('data-theme', next);
    localStorage.setItem('panel_theme', next);
    // если сейчас открыт конструктор — синхронизируем тему в iframe
    if (document.body.classList.contains('mode-constructor')){
      setTimeout(sendThemeToCtor, 30);
    }
  }
  applyTheme(localStorage.getItem('panel_theme') || 'light');
  themeSwitch?.addEventListener('click', ()=>{
    const cur = html.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // sidebar: always expanded (no mini mode)
  const KEY_SIDE_MINI = 'panel_side_mini';
  try{ localStorage.removeItem(KEY_SIDE_MINI); }catch(_){}
  side.classList.remove('is-mini');
  document.documentElement.style.setProperty('--side-w', '96px');

  // (collapse handler removed)

  function showView(id){
    views.forEach(v=>v.classList.toggle('is-show', v.dataset.view===id));
    const m = META[id] || {t:'',s:''};
    pageTitle.textContent = m.t;
    pageSub.textContent = m.s;

    // constructor mode: maximum space
    document.body.classList.toggle('is-ctor', id === 'constructor');

    settingsTabs.hidden = id !== 'settings';
    if (id === 'settings') setSettingsTab('base');

    // update constructor iframe with current app_id
    if (id === 'constructor' && ctorFrame){
      const url = new URL(window.location.href);
      const appId = url.searchParams.get('app_id') || url.searchParams.get('app') || 'my_app';
      const srcBase = 'miniapp_sections_fixed2/app/index.html';
      // embed=1 => seamless mode inside iframe (no outer padding/left panel)
      const hostSideW = getComputedStyle(document.documentElement).getPropertyValue('--side-w').trim() || '96px';
      const src = srcBase + '?preview=draft&embed=1&host_side_w=' + encodeURIComponent(hostSideW) + '&app_id=' + encodeURIComponent(appId);
      if (!ctorFrame.dataset.bound || ctorFrame.src.indexOf(srcBase) === -1){
        // first time
        ctorFrame.src = src;
        ctorFrame.dataset.bound = '1';
      } else {
        // only change app_id if differs
        const cur = new URL(ctorFrame.src, window.location.href);
        if (cur.searchParams.get('app_id') !== appId){
          ctorFrame.src = src;
        }
      }
    }

    // apply page layout mode (hide topbar/paddings for constructor)
    setMode(id);
  }

  sideNav.addEventListener('click', (e)=>{
    const btn = e.target.closest('.side__item[data-view]');
    if (!btn) return;
    const id = btn.dataset.view;
    sideNav.querySelectorAll('.side__item').forEach(x=>x.classList.toggle('is-active', x===btn));
    showView(id);
  });

  const tabBtns = Array.from(document.querySelectorAll('#settingsTabs .tab'));
  function setSettingsTab(tab){
    tabBtns.forEach(b=>b.classList.toggle('is-active', b.dataset.tab===tab));
    const fall = document.getElementById('tab_fallbacks');
    const integ = document.getElementById('tab_integrations');
    if (fall) fall.hidden = tab !== 'fallbacks';
    if (integ) integ.hidden = tab !== 'integrations';
  }
  settingsTabs.addEventListener('click', (e)=>{
    const t = e.target.closest('.tab[data-tab]');
    if (!t) return;
    setSettingsTab(t.dataset.tab);
  });

  const clearTitle = document.getElementById('clearTitle');
  const botTitle = document.getElementById('botTitle');
  const saveBase = document.getElementById('saveBase');
  const saveHint = document.getElementById('saveHint');

  clearTitle?.addEventListener('click', ()=>{ botTitle.value=''; botTitle.focus(); });
  saveBase?.addEventListener('click', ()=>{
    saveBase.disabled = true;
    saveHint.textContent = 'Сохраняем…';
    setTimeout(()=>{
      saveBase.disabled = false;
      saveHint.textContent = 'Сохранено ✓';
      setTimeout(()=>saveHint.textContent='', 1600);
    }, 650);
  });

  // стартовый view: если в URL есть app/app_id (или view=constructor) — открываем конструктор
  const sp0 = new URLSearchParams(location.search||'');
  const urlApp = (sp0.get('app_id') || sp0.get('app') || '').trim();
  const urlView = (sp0.get('tab') || sp0.get('view') || '').trim();

  let startView = 'settings';
  if (urlView) startView = urlView;
  if (urlApp && (!urlView || urlView === 'constructor')) startView = 'constructor';

  showView(startView);
  sideNav.querySelectorAll('.side__item').forEach(x=>x.classList.toggle('is-active', x.dataset.view===startView));
// ====== Bot integration (Telegram) ======
  const botUsernameInput = document.getElementById('botUsername');
  const botTokenInput = document.getElementById('botToken');
  const botStatusBadge = document.getElementById('botStatusBadge');
  const botSaveBtn = document.getElementById('saveBotIntegration');
  const botSaveHint = document.getElementById('botSaveHint');

  // API base для конструктора / мини-аппов (Cloudflare Worker)
  // Можно переопределить window.CTOR_API_BASE сверху в HTML,
  // иначе по умолчанию берём твой воркер.
  const CAB_API_BASE = (window.CTOR_API_BASE || 'https://build-apps.cyberian13.workers.dev').replace(/\/$/, '');
  const currentUrl = new URL(window.location.href);
  const CAB_APP_ID =
    currentUrl.searchParams.get('app_id') ||
    currentUrl.searchParams.get('app')   ||
    'my_app';

  // Подтягиваем текущие настройки бота
  async function loadBotIntegration(){
    if (!botSaveBtn || !CAB_APP_ID) return;
    if (botSaveHint) botSaveHint.textContent = 'Загружаем интеграцию…';
    botSaveBtn.disabled = true;

    try{
      const r = await fetch(
        CAB_API_BASE + '/api/app/' + encodeURIComponent(CAB_APP_ID) + '/bot',
        { method:'GET', credentials:'include' }
      );
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json().catch(()=>null);

      if (data && data.ok){
        // worker may return either bot_username (legacy) or username (current)
        const u = String(data.bot_username || data.username || '').trim();
        if (botUsernameInput){
          botUsernameInput.value = u;
        }
        if (botStatusBadge){
          const linked = !!data.linked;
          botStatusBadge.textContent = linked ? 'Подключён' : 'Не подключён';
          botStatusBadge.classList.toggle('pill--ok', linked);
        }
      }

      if (botSaveHint) botSaveHint.textContent = '';
    }catch(e){
      console.warn('[panel] loadBotIntegration failed', e);
      if (botSaveHint) botSaveHint.textContent = 'Не удалось загрузить интеграцию';
    }finally{
      botSaveBtn.disabled = false;
    }
  }

  // Сохранение токена/имени бота
  async function saveBotIntegration(){
    if (!botSaveBtn || !CAB_APP_ID) return;
    const username = botUsernameInput ? botUsernameInput.value.trim() : '';
    const token    = botTokenInput    ? botTokenInput.value.trim()    : '';

    botSaveBtn.disabled = true;
    if (botSaveHint) botSaveHint.textContent = 'Сохраняем…';

    try{
      const r = await fetch(
        CAB_API_BASE + '/api/app/' + encodeURIComponent(CAB_APP_ID) + '/bot',
        {
          method:'PUT',
          headers:{ 'Content-Type': 'application/json' },
          credentials:'include',
          body: JSON.stringify({
            // worker expects username/token (legacy panel used bot_username/bot_token)
            username: username || null,
            token:    token    || null   // пустая строка = не меняем токен
          })
        }
      );
      const data = await r.json().catch(()=>null);
      if (!r.ok || !data || data.ok === false){
        throw new Error((data && data.error) || ('HTTP ' + r.status));
      }

      // Токен после сохранения чистим из поля (не подсвечиваем пользователю)
      if (botTokenInput) botTokenInput.value = '';

      if (botStatusBadge){
        botStatusBadge.textContent = 'Подключён';
        botStatusBadge.classList.add('pill--ok');
      }
      if (botSaveHint) botSaveHint.textContent = 'Интеграция сохранена ✓';
      setTimeout(()=>{ if (botSaveHint) botSaveHint.textContent = ''; }, 1800);
    }catch(e){
      console.error('[panel] saveBotIntegration failed', e);
      if (botSaveHint) botSaveHint.textContent =
        'Ошибка при сохранении. Проверь токен и попробуй ещё раз.';
    }finally{
      botSaveBtn.disabled = false;
    }
  }

  // Клик по кнопке «Сохранить интеграцию»
  botSaveBtn?.addEventListener('click', (e)=>{
    e.preventDefault();
    saveBotIntegration();
  });

  // Подгружаем интеграцию, когда пользователь заходит на вкладку «Интеграции»
  settingsTabs?.addEventListener('click',(e)=>{
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    if (t.dataset.tab === 'integrations') {
      loadBotIntegration();
    }
  });




  // sync theme into constructor iframe
  try{
    const obs = new MutationObserver(()=>sendThemeToCtor());
    obs.observe(html, {attributes:true, attributeFilter:['data-theme']});
    // also send when iframe loads
    if (ctorFrame){
      ctorFrame.addEventListener('load', ()=>sendThemeToCtor());
    }
  }catch(_){}
})();



// === SaaS: global logout (works on GitHub Pages too) ===
(function(){
  const btn = document.getElementById('logoutGlobalBtn');
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    try{
      const API_BASE = (window.API_BASE || 'https://build-apps.cyberian13.workers.dev').replace(/\/$/,'');
      await fetch(API_BASE + '/api/auth/logout', {method:'POST', credentials:'include'});
    }catch(_){}
    try{ window.SG_SHELL && SG_SHELL.broadcastLogout(); }catch(_){}
    try{ localStorage.removeItem('sg_current_app'); }catch(_){}
    // top-level redirect to auth
    try{
      if (window.top && window.top !== window.self){
        window.top.location.href = '/auth.html';
        return;
      }
    }catch(_){}
    location.href = '/auth.html';
  });
})();
