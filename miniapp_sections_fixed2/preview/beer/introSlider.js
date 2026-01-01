(function introSlider(){
  const TG = window.Telegram && window.Telegram.WebApp;

  // ====== КОНФИГ КНОПОК ПО СЛАЙДАМ ======
  // Индексы соответствуют порядку секций .intro__slide в #intro-slides
  const INTRO_CFG = {
    actions: {
      0: [ // Слайд 1 — две рядом
        { label:'Нет', type:'ghost', do:'navigate', value:'no' },
        { label:'Есть 18',  type:'primary', do:'answer', to:'next' } // перейти в раздел "Запись"
      ],
      1: [ // Слайд 0 — одна кнопка
        { label:'Продолжить', type:'primary', do:'next' }
      ],
      2: [ // Слайд 2 — одна кнопка
        { label:'Продолжить', type:'primary', do:'next' }
      ],
      3: [ // Слайд 3 — одна кнопка
        { label:'Играть', type:'ghost', do:'navigate' }
      ]
      // Примеры для будущих слайдов:
      // 3: [
      //   { label:'Открыть сайт', type:'primary', do:'link', href:'https://example.com' }
      // ],
      // 4: [
      //   { label:'Показать окно', type:'primary', do:'sheet', title:'Демо', tpl:'#tpl-example', from:'bottom' }
      // ]
    },
    onAnswer: (index, value) => {
      // Твой хук на ответы "Да/Нет" и т.п.
      // Например: localStorage.setItem('intro_answer_'+index, value);
      // console.log('Answer on slide', index, '=>', value);
    }
  };

  // ====== DOM ======
  const root = document.getElementById('intro');
  if(!root) return;

  const slidesWrap = root.querySelector('#intro-slides');
  const slides = Array.from(root.querySelectorAll('.intro__slide'));
  const progress = root.querySelector('#intro-progress');
  const actions = root.querySelector('#intro-actions');

  // Прогресс
  progress.innerHTML = slides.map(()=>'<i class="intro__seg"></i>').join('');
  const segs = Array.from(progress.children);

  let idx = 0, touchX0=0, touchX=0, dragging=false, backHandler=null;

  const haptic = (lvl='light') => { try{ TG?.HapticFeedback?.impactOccurred(lvl); }catch(_){ } };

  // Сервис: создать кнопку
  function btnHTML(cfg){
    const cls = ['intro__btn'];
    if (cfg.type === 'primary') cls.push('intro__btn--primary');
    if (cfg.type === 'ghost')   cls.push('intro__btn--ghost');
    const attrs = [];
    if (cfg.do) attrs.push(`data-act="${cfg.do}"`);
    if (cfg.value != null) attrs.push(`data-val="${String(cfg.value)}"`);
    if (cfg.to)    attrs.push(`data-to="${String(cfg.to)}"`);
    if (cfg.href)  attrs.push(`data-href="${String(cfg.href)}"`);
    if (cfg.title) attrs.push(`data-title="${String(cfg.title)}"`);
    if (cfg.tpl)   attrs.push(`data-tpl="${String(cfg.tpl)}"`);
    if (cfg.from)  attrs.push(`data-from="${String(cfg.from)}"`);
    return `<button class="${cls.join(' ')}" ${attrs.join(' ')}>${cfg.label}</button>`;
  }

  // Рендер низа (кнопок)
  function renderActions(){
    const set = INTRO_CFG.actions[idx] || defaultActions();
    // сетка: 1 / 2 / 3+
    actions.className = 'intro__actions';
    if (set.length === 1) actions.classList.add('intro__actions--one');
    else if (set.length === 2) actions.classList.add('intro__actions--two');
    else actions.classList.add('intro__actions--multi'); // см. CSS ниже
    actions.innerHTML = set.map(btnHTML).join('');
  }

  // Дефолт, если не задал для слайда: "Продолжить" или "Готово" на последнем
  function defaultActions(){
    const last = (idx === slides.length - 1);
    return [ { label: last ? 'Готово' : 'Продолжить', type:'primary', do: last ? 'done' : 'next' } ];
    // можно заменить на то, что тебе нужно по умолчанию
  }

  function apply(){
    slides.forEach((s,i)=> s.classList.toggle('active', i===idx));
    segs.forEach((d,i)=> d.classList.toggle('active', i<=idx));
    renderActions();
  }

  // Открыть / закрыть
  function openIntro(startIndex){
    if (Number.isInteger(startIndex)) idx = Math.max(0, Math.min(startIndex, slides.length-1));
    root.classList.add('is-open');
    document.body.classList.add('intro-open');

    try{
      TG?.BackButton?.show?.();
      backHandler = ()=> closeIntro();
      TG?.BackButton?.onClick?.(backHandler);
      TG?.disableVerticalSwipes?.();
    }catch(_){}

    apply();
    window.syncBack?.();
  }
  function closeIntro(){
    root.classList.remove('is-open');
    document.body.classList.remove('intro-open');

    try{ TG?.BackButton?.offClick?.(backHandler); backHandler=null; }catch(_){}
    if (typeof window.syncBack === 'function') window.syncBack(); else try{ TG?.BackButton?.hide?.(); }catch(_){}
  }

  function next(){ if(idx<slides.length-1){ idx++; apply(); haptic(); } }
  function prev(){ if(idx>0){ idx--; apply(); haptic(); } }

  // Жесты перелистывания
  slidesWrap.addEventListener('touchstart', e=>{ dragging=true; touchX0=touchX=e.touches[0].clientX; }, {passive:true});
  slidesWrap.addEventListener('touchmove',  e=>{ if(!dragging) return; touchX=e.touches[0].clientX; }, {passive:true});
  slidesWrap.addEventListener('touchend',   ()=>{ if(!dragging) return; dragging=false;
    const dx = touchX - touchX0; if (Math.abs(dx)>50){ dx<0 ? next() : prev(); }
  });

  // Клики по кнопкам низа
  actions.addEventListener('click', (e)=>{
    const b = e.target.closest('[data-act]'); if(!b) return;
    const act  = b.getAttribute('data-act');
    const val  = b.getAttribute('data-val');
    const to   = b.getAttribute('data-to');
    const href = b.getAttribute('data-href');
    const title= b.getAttribute('data-title');
    const tpl  = b.getAttribute('data-tpl');
    const from = b.getAttribute('data-from') || 'bottom';

    switch(act){
      case 'next': next(); break;
      case 'prev': prev(); break;
      case 'done': haptic('medium'); closeIntro(); break;
      case 'answer':
        try{ INTRO_CFG.onAnswer && INTRO_CFG.onAnswer(idx, val); }catch(_){}
        next(); break;
      case 'navigate':
        closeIntro();
        if (typeof window.navigateTo === 'function') window.navigateTo(to);
        else if (to) location.hash = '#'+to;
        break;
      case 'link':
        try{ TG?.openLink ? TG.openLink(href) : window.open(href, '_blank'); }catch(_){}
        break;
      case 'sheet':
        closeIntro();
        if (typeof window.openSheet === 'function'){
          const tplNode = tpl ? document.querySelector(tpl) : null;
          const html = tplNode ? tplNode.innerHTML : '<div class="card"><b>Нет шаблона</b></div>';
          window.openSheet({ title, html, from });
        }
        break;
    }
  });

  // Открывать по кнопке: data-open-intro или data-open-intro="2" (старт слайд 2)
  document.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-open-intro]');
    if (!t) return;
    e.preventDefault();
    const start = parseInt(t.getAttribute('data-open-intro'), 10);
    openIntro(Number.isFinite(start) ? start : undefined);
  });

  // Экспорт (если захочешь открыть из кода)
  window.openIntro  = openIntro;
  window.closeIntro = closeIntro;
})();