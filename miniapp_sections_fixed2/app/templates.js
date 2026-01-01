/* TEMPLATES_BUILD: step20 */
console.log("[templates] build step20");



/* ===============================
   Styles Passport CSS (embedded)
   =============================== */
const STYLES_PASSPORT_CSS = `
:root{ --card-pad:14px; }

/* ===== Карточка «Паспорт» (рамка) ===== */
.card.passport{
  padding: var(--card-pad);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  background: rgba(255,255,255,.04);
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  align-items: stretch;
}

/* Левая картинка */
.passport__media{
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255,255,255,.04);
  display: grid; place-items: center;
}
.passport__media img{
  width:100%; height:100%; object-fit:cover; display:block;
}

/* Правая колонка */
.passport__body{ display:grid; gap:10px; }

/* ===== Сетка мини-карточек ===== */
.passport-grid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap:10px;
}


/* ЕДИНАЯ карточка стиля (название + бейдж внутри обводки) */
.pslot{
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);
  border-radius:12px;
  padding:10px;
  display:grid; gap:8px;
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}
.pslot__title{ font-weight:800; line-height:1.2; }

/* бейдж статуса */
.pslot__badge{
  display:grid; place-items:center;
  padding:8px 10px; border-radius:999px;
  font-weight:800; font-size:13px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06); color:#fff; opacity:.95;
}

/* Подсветка при получении штампа — ВЕСЬ блок */
.pslot.is-done{
  border-color: rgba(55,214,122,.55);
  background: rgba(55,214,122,.12);
  box-shadow: 0 0 0 1px rgba(55,214,122,.25) inset;
}
.pslot.is-done .pslot__title{ color:#37d67a; }
.pslot.is-done .pslot__badge{
  border-color: rgba(55,214,122,.55);
  background: linear-gradient(180deg, rgba(55,214,122,.9), rgba(55,214,122,.75));
  color:#0b1a12;
}

/* ===== Мобилка: картинка full-bleed, 2 колонки сетки ===== */
@media (max-width:520px){
  .card.passport{ grid-template-columns: 1fr; }
  .passport__media{
    margin: calc(-1*var(--card-pad)) calc(-1*var(--card-pad)) 10px;
    border-radius: 16px 16px 0 0;
    aspect-ratio: 16/9;
  }
  .passport-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
}







(function(){
  'use strict';
  if (window.__PASSPORT_PIN_GUARD__) return; window.__PASSPORT_PIN_GUARD__ = true;

  const API = (typeof window.api === 'function') ? window.api : null;
  const PIN_CODE = String(window.DEMO_PIN || window.PIN_CODE || '1111');

  function toast(msg, ok){
    try{
      if (window.showToast) return window.showToast(msg, ok);
      // fallback
      if (!ok) console.warn(msg); else console.log(msg);
    }catch(_){}
  }

  function updatePassportCaches(styleCode){
    try{
      const code = String(styleCode||'').trim();
      if (!code) return;
      // beer_passport map
      let map = {}; try{ map = JSON.parse(localStorage.getItem('beer_passport')||'{}')||{}; }catch(_){}
      map[code] = 1;
      localStorage.setItem('beer_passport', JSON.stringify(map));

      // beer_passport_v1 {stamps:[]}
      let v1 = {}; try{ v1 = JSON.parse(localStorage.getItem('beer_passport_v1')||'{}')||{}; }catch(_){}
      const arr = Array.isArray(v1.stamps) ? v1.stamps.slice() : [];
      const codeL = code.toLowerCase();
      if (!arr.some(s => String(s).toLowerCase()===codeL)) arr.push(code);
      localStorage.setItem('beer_passport_v1', JSON.stringify({ stamps: arr }));
    }catch(_){}
  }

  // Prevent double prompts & double sends
  let inFlight = false;

  document.addEventListener('click', async function onClickCapture(e){
    // We handle in capture phase to stop other listeners from firing duplicate prompts
  }, true);

  document.addEventListener('click', async function onClick(e){
    const tgt = e.target;
    const card = tgt && tgt.closest ? tgt.closest('.pslot') : null;
    if (!card) return; // not a passport card
    const grid = card.closest('#passport-grid');
    if (!grid) return; // only process inside passport grid
    // Prevent other handlers to avoid double prompts
    e.stopImmediatePropagation();
    e.preventDefault();

    // If already collected — do nothing (button inactive)
    if (card.classList.contains('is-done') || card.getAttribute('aria-disabled')==='true'){
      const badge = card.querySelector('.pslot__badge');
      if (badge){
        badge.setAttribute('aria-disabled','true');
      }
      return;
    }

    if (inFlight) return; // guard

    const code = String(card.getAttribute('data-code') || card.getAttribute('data-style-id') || '').trim();
    if (!code) return;

    // Ask for PIN exactly once
    inFlight = true;
    card.classList.add('is-busy');
    try{
      const badge = card.querySelector('.pslot__badge');
      if (badge) badge.setAttribute('aria-busy','true');

      const pin = window.prompt('PIN сотрудника (одноразовый)');
      if (pin == null){ // cancel
        toast('Отменено', false);
        return;
      }
      if (String(pin).trim() === ''){
        toast('Введите PIN', false);
        return;
      }

      // Отправляем одноразовый PIN на бэкенд, проверка только на сервере
      if (API){
        const r = await API('style.collect', {
          style_id: String(code),
          pin: String(pin).trim()
        });
        if (r && r.ok){
          // Update local caches and repaint
          updatePassportCaches(code);
          // Mark UI as collected
          card.classList.add('is-done');
          card.setAttribute('aria-disabled','true');
          if (badge){
            badge.textContent = 'Получен';
            badge.setAttribute('aria-disabled','true');
            badge.removeAttribute('aria-busy');
          }
          try{
            const st = (window.SWR && window.SWR.get && window.SWR.get()) || window.MiniState || {};
            if (r.fresh_state && window.applyServerState){
              window.applyServerState(r.fresh_state);
            }else if (window.paintBadgesFromState){
              window.paintBadgesFromState(st);
            }
          }catch(_){}
          toast('Штамп получен', true);
        }else{
          if (r && r.error === 'pin_invalid'){
            toast('ПИН неверный или уже использован', false);
          }else if (r && r.error === 'pin_used'){
            toast('Этот ПИН уже был использован', false);
          }else if (r && r.error === 'pin_required'){
            toast('Нужно ввести ПИН у сотрудника', false);
          }else if (r && r.error){
            toast(r.error, false);
          }else{
            toast('Ошибка сети', false);
          }
        }
      }else{
        // No API available — do not send, do not mark collected
        toast('API недоступен', false);
      }

    }finally{
      card.classList.remove('is-busy');
      const badge = card.querySelector('.pslot__badge');
      if (badge) badge.removeAttribute('aria-busy');
      inFlight = false;
    }
  }, true); // use capture to outrun other listeners

})();
`;

window.BlockRegistry = {
 
promo:{
  type:'htmlEmbed',
  title:'Промо слайдер',
  defaults:{
    interval:4000,
    slides:[
      { img:'', action:'link',      link:'#play',       sheet_id:'', sheet_path:'' },
      { img:'', action:'link',      link:'#bonuses',    sheet_id:'', sheet_path:'' },
      { img:'', action:'link',      link:'#tournament', sheet_id:'', sheet_path:'' }
    ]
  },
  preview:(p={})=>{
    const interval = Number(p.interval) || 4000;
    const slides = Array.isArray(p.slides) && p.slides.length ? p.slides : [
      { img:'', action:'link', link:'#play',       sheet_id:'', sheet_path:'' },
      { img:'', action:'link', link:'#bonuses',    sheet_id:'', sheet_path:'' },
      { img:'', action:'link', link:'#tournament', sheet_id:'', sheet_path:'' }
    ];

    return `
      <section class="promo promo--slider" data-interval="${interval}">
        <div class="promo-slides">
          ${slides.map((s, i)=>{
            const img        = s.img || '';
            const action     = s.action || 'none';
            const link       = s.link || '';
            const sheet_id   = s.sheet_id || '';
            const sheet_path = s.sheet_path || '';

            let attr = '';
            if (action === 'sheet' && sheet_id){
              attr = ` data-open-sheet="${sheet_id}"`;
            } else if (action === 'sheet_page' && sheet_path){
              attr = ` data-open-sheet-page="${sheet_path}"`;
            } else if (action === 'link' && link){
              attr = ` data-link="${link}"`;
            }

            return `
              <div class="promo-slide${i===0 ? ' is-active' : ''}">
                <button class="promo-slide__btn" type="button"${attr}>
                  ${img
                    ? `<img class="promo-img" src="${img}" alt="">`
                    : `<div class="promo-img promo-img--placeholder"></div>`
                  }
                </button>
              </div>
            `;
          }).join('')}
        </div>
        <div class="promo-dots">
          ${slides.map((_,i)=>`<span class="promo-dot${i===0 ? ' is-active' : ''}"></span>`).join('')}
        </div>
      </section>
    `;
  },
  init:(el, props={})=>{
    const slides = el.querySelectorAll('.promo-slide');
    const dots   = el.querySelectorAll('.promo-dot');
    if (!slides.length || slides.length === 1) return;

    let idx = 0;
    let timer = null;
    const interval = Number(props.interval) || 4000;

    const go = (next)=>{
      slides[idx].classList.remove('is-active');
      if (dots[idx]) dots[idx].classList.remove('is-active');
      idx = next;
      slides[idx].classList.add('is-active');
      if (dots[idx]) dots[idx].classList.add('is-active');
    };

    const tick = ()=>{
      const next = (idx + 1) % slides.length;
      go(next);
    };

    timer = setInterval(tick, interval);

    // клик по точкам
    dots.forEach((d, i)=>{
      d.addEventListener('click', ()=>{
        go(i);
      });
    });
  }
},






  infoCardPlain:{
    type:'htmlEmbed',
    title:'Инфо карточка (кликабельное изображение)',
    defaults:{
      icon:'beer/img/beer_hero.jpg',
      title:'Craft Beer',
      sub:'Кто мы, где мы',
      imgSide:'left',   // left | right
      action:'none',    // none | link | sheet | sheet_page
      link:'',
      sheet_id:'',
      sheet_path:''
    },
    preview:(p={})=>{
      const icon    = p.icon  || '';
      const t       = p.title || 'Craft Beer';
      const sub     = p.sub   || 'Кто мы, где мы';
      const imgSide = (p.imgSide === 'right' ? 'right' : 'left');

      const action     = p.action     || 'none';
      const link       = p.link       || '';
      const sheet_id   = p.sheet_id   || '';
      const sheet_path = p.sheet_path || '';

      let attr = '';
      if (action === 'sheet' && sheet_id){
        attr = ` data-open-sheet="${sheet_id}"`;
      } else if (action === 'sheet_page' && sheet_path){
        attr = ` data-open-sheet-page="${sheet_path}"`;
      } else if (action === 'link' && link){
        attr = ` data-link="${link}"`;
      }

      const sideClass = imgSide === 'right' ? ' info-card--plain-right' : '';

      return `
        <section class="card info-card info-card--plain${sideClass}">
          <div class="info-card__inner">
            <button class="info-card__icon-btn" type="button"${attr}>
              ${icon ? `<img src="${icon}" alt="">` : ''}
            </button>
            <div class="info-card__text">
              <div class="info-card__title">${t}</div>
              <div class="info-card__sub">${sub}</div>
            </div>
          </div>
        </section>
      `;
    }
  },




  gamesList:{
    type:'htmlEmbed',
    title:'Игры: список с кнопками',
    defaults:{
      title:'Игры',
      cards:[
        {
          icon:'beer/img/game1.png',
          title:'Bumblebee',
          sub:'Долети до нас и получи приз',
          btn:'Играть',
          action:'link',
          link:'#play_bumble',
          sheet_id:'',
          sheet_path:''
        },
        {
          icon:'beer/img/game2.png',
          title:'Night Racing',
          sub:'Катайся и прокачивай тачку',
          btn:'Скоро',
          action:'none',
          link:'',
          sheet_id:'',
          sheet_path:''
        },
        {
          icon:'beer/img/game3.png',
          title:'Memory cards',
          sub:'Найди все спрятанные карточки быстрее',
          btn:'Скоро',
          action:'none',
          link:'',
          sheet_id:'',
          sheet_path:''
        }
      ]
    },
    preview:(p={})=>{
      const title = p.title || 'Игры';
      const def   = (window.BlockRegistry.gamesList && window.BlockRegistry.gamesList.defaults) || {};
      const cards = Array.isArray(p.cards) && p.cards.length ? p.cards : (def.cards || []);

      return `
        <section class="card list-card games tight">
          <div class="list-head">${title}</div>
          <div class="list">
            ${cards.map((c)=>{
              const icon       = c.icon || '';
              const ct         = c.title || '';
              const sub        = c.sub   || '';
              const btn        = c.btn   || 'Играть';
              const action     = c.action || 'none';
              const link       = c.link || '';
              const sheet_id   = c.sheet_id || '';
              const sheet_path = c.sheet_path || '';

              let attr = '';
              if (action === 'sheet' && sheet_id){
                attr = ` data-open-sheet="${sheet_id}"`;
              } else if (action === 'sheet_page' && sheet_path){
                attr = ` data-open-sheet-page="${sheet_path}"`;
              } else if (action === 'link' && link){
                attr = ` data-link="${link}"`;
              }

              return `
                <div class="list__item">
                  <div class="list__icon">
                    ${icon ? `<img src="${icon}" alt="">` : ''}
                  </div>
                  <div class="list__text">
                    <div class="list__title">${ct}</div>
                    <div class="list__sub">${sub}</div>
                  </div>
                  <button class="btn game-list-btn" type="button"${attr}>${btn}</button>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }
  },




    infoCardChevron:{
    type:'htmlEmbed',
    title:'Инфо карточка со стрелкой',
    defaults:{
      icon:'beer/img/beer_hero.jpg',
      title:'Craft Beer',
      sub:'Кто мы, где мы',
      action:'link',     // none | link | sheet | sheet_page
      link:'#about',     // для link
      sheet_id:'',       // для sheet
      sheet_path:''      // для sheet_page
    },
    preview:(p={})=>{
      const icon       = p.icon || '';
      const t          = p.title || 'Craft Beer';
      const sub        = p.sub   || 'Кто мы, где мы';
      const action     = p.action || 'none';
      const link       = p.link || '';
      const sheet_id   = p.sheet_id || '';
      const sheet_path = p.sheet_path || '';

      let attr = '';
      if (action === 'sheet' && sheet_id){
        attr = ` data-open-sheet="${sheet_id}"`;
      } else if (action === 'sheet_page' && sheet_path){
        attr = ` data-open-sheet-page="${sheet_path}"`;
      } else if (action === 'link' && link){
        attr = ` data-link="${link}"`;
      }

      return `
        <section class="card info-card info-card--chevron">
          <div class="info-card__inner">
            <div class="info-card__icon">
              ${icon ? `<img src="${icon}" alt="">` : ''}
            </div>
            <div class="info-card__text">
              <div class="info-card__title">${t}</div>
              <div class="info-card__sub">${sub}</div>
            </div>
            <button class="list__chev-btn" type="button"${attr}>›</button>
          </div>
        </section>
      `;
    }
  },



  

    infoCard:{
    type:'htmlEmbed',
    title:'Инфо карточка с кнопкой',
    defaults:{
      icon:'beer/img/beer_hero.jpg',
      title:'Craft Beer',
      sub:'Кто мы, где мы',
      btn:'О нас',
      action:'link',     // none | link | sheet | sheet_page
      link:'#about',     // для link
      sheet_id:'',       // для sheet
      sheet_path:''      // для sheet_page
    },
    preview:(p={})=>{
      const icon       = p.icon || '';
      const t          = p.title || 'Craft Beer';
      const sub        = p.sub   || 'Кто мы, где мы';
      const btn        = p.btn   || 'О нас';
      const action     = p.action || 'none';
      const link       = p.link || '';
      const sheet_id   = p.sheet_id || '';
      const sheet_path = p.sheet_path || '';

      let attr = '';
      if (action === 'sheet' && sheet_id){
        attr = ` data-open-sheet="${sheet_id}"`;
      } else if (action === 'sheet_page' && sheet_path){
        attr = ` data-open-sheet-page="${sheet_path}"`;
      } else if (action === 'link' && link){
        attr = ` data-link="${link}"`;
      }

      return `
        <section class="card info-card">
          <div class="info-card__inner">
            <div class="info-card__icon">
              ${icon ? `<img src="${icon}" alt="">` : ''}
            </div>
            <div class="info-card__text">
              <div class="info-card__title">${t}</div>
              <div class="info-card__sub">${sub}</div>
            </div>
            <div class="info-card__btn-wrap">
              <button class="btn info-card__btn" type="button"${attr}>${btn}</button>
            </div>
          </div>
        </section>
      `;
    }
  },




  spacer:{
    type:'htmlEmbed',
    title:'Отступ',
    defaults:{ size:16 }, // высота в пикселях
    preview:(p={})=>{
      const h = Number(p.size) || 16;
      return `
        <div class="blk-spacer" style="height:${h}px;"></div>
      `;
    }
  },




  // ==== Beer blocks (from beer-main) ====
  beerHero:{
    type:'htmlEmbed',
    title:'Beer: Hero',
    defaults:{ title:'Craft Beer Club', text:'Собирай штампы, крути колесо, получай призы', img:'beer/img/beer_hero.jpg' },
    preview:(pp={})=>{
      const t=pp.title||'Craft Beer Club';
      const tx=pp.text||'Собирай штампы, крути колесо, получай призы';
      const img=pp.img||'beer/img/beer_hero.jpg';
      return `
        <section class="b-hero">
          <div class="b-hero__img" style="background-image:url('${img}')"></div>
          <div class="b-hero__body">
            <div class="b-hero__title">${t}</div>
            <div class="b-hero__text">${tx}</div>
          </div>
        </section>
      `;
    }
  },


  
  beerIntroSlider:{
    type:'htmlEmbed',
    title:'Beer: Слайдер приветствия',
    defaults:{
      slides:[
        {
          title:'Как это работает',
          text:'Копите монеты, играя и делая покупки. Обменивайте их на призы в разделе «Бонусы».',
          primary:'Продолжить',
          ghost:''
        },
        {
          title:'Отлично! Погнали',
          text:'Первый спин — в подарок. В профиле видны баланс, призы и рефералы. Играй честно, бонусы забирай в магазине.',
          primary:'Играть',
          ghost:''
        }
      ]
    },
    preview:(p={})=>{
      const defaults = [
        {
          title:'Как это работает',
          text:'Копите монеты, играя и делая покупки. Обменивайте их на призы в разделе «Бонусы».',
          primary:'Продолжить',
          ghost:''
        },
        {
          title:'Отлично! Погнали',
          text:'Первый спин — в подарок. В профиле видны баланс, призы и рефералы. Играй честно, бонусы забирай в магазине.',
          primary:'Играть',
          ghost:''
        }
      ];
      const slides = Array.isArray(p.slides) && p.slides.length ? p.slides : defaults;
      const segs = slides.map((_,i)=>`<div class="intro__seg${i===0?' active':''}"></div>`).join('');
      const slidesHTML = slides.map((s,i)=>`
        <section class="intro__slide${i===0?' active':''}" style="${s.bg ? `background-image:url('${s.bg}');background-size:cover;background-position:center;` : ''}">
          <h1 class="intro__h1">${s.title||''}</h1>
          <p class="intro__p">${s.text||''}</p>
        </section>
      `).join('');
      const first = slides[0] || {};
      const btns = [];
      if (first.ghost) btns.push(`<button class="intro__btn intro__btn--ghost" type="button">${first.ghost}</button>`);
      if (first.primary) btns.push(`<button class="intro__btn intro__btn--primary" type="button" >${first.primary}</button>`);
      const cls = btns.length === 1
        ? 'intro__actions intro__actions--one'
        : (btns.length === 2 ? 'intro__actions intro__actions--two' : 'intro__actions');
      return `
        <section class="intro intro--static" style="display:block;position:relative;inset:auto;background:transparent;min-height:0;height:auto;">
          <div class="intro__wrap" style="position:relative;inset:auto;padding:16px 0 0;">
            <div class="intro__progress">${segs}</div>
            <div class="intro__stage">
              <div class="intro__slides">
                ${slidesHTML}
              </div>
            </div>
            <div class="${cls}">
              ${btns.join('')}
            </div>
          </div>
        </section>
      `;
    },
    init:(el, props, ctx)=>{
      try{
        const slidesWrap = el.querySelector('.intro__slides');
        const slides = slidesWrap ? Array.from(slidesWrap.querySelectorAll('.intro__slide')) : [];
        const segs   = Array.from(el.querySelectorAll('.intro__seg'));
        const btnPrimary = el.querySelector('.intro__btn--primary');
        if (!slides.length || !btnPrimary) return null;

        let idx = 0;
        function apply(){
          slides.forEach((s,i)=> s.classList.toggle('active', i===idx));
          segs.forEach((seg,i)=> seg.classList.toggle('active', i<=idx));
          if (idx === slides.length-1){
            btnPrimary.textContent = 'Готово';
          } else {
            btnPrimary.textContent = 'Продолжить';
          }
        }

        btnPrimary.addEventListener('click', ()=>{
          if (idx < slides.length-1){
            idx++;
            apply();
          } else {
            // здесь можно добавить переход на другую страницу
          }
        });

        apply();
      }catch(_){}
      return null;
    }
  },

  beerStartList:{
    type:'htmlEmbed',
    title:'Beer: Стартовые карточки',
    defaults:{
      title:'С чего начать',
      cards:[
        { icon:'beer/img/pasport.png',       title:'Паспорт стил...й',   sub:'Собери 6 штампов — подарок',      link:'#passport', action:'link', sheet_id:'', sheet_path:'' },
        { icon:'beer/img/casino-chips.png',  title:'Викторина',          sub:'Проверь свои пивные знания',      link:'#quiz',     action:'link', sheet_id:'', sheet_path:'' },
        { icon:'beer/img/fren.png',          title:'Пригласи друзей',    sub:'Дарим +100 монет за друга',       link:'#invite',   action:'link', sheet_id:'', sheet_path:'' }
      ]
    },
    preview:(p={})=>{
      const title = p.title || 'С чего начать';
      const cards = Array.isArray(p.cards) && p.cards.length ? p.cards : [
        { icon:'beer/img/pasport.png',       title:'Паспорт стил...й',   sub:'Собери 6 штампов — подарок',      link:'#passport', action:'link', sheet_id:'', sheet_path:'' },
        { icon:'beer/img/casino-chips.png',  title:'Викторина',          sub:'Проверь свои пивные знания',      link:'#quiz',     action:'link', sheet_id:'', sheet_path:'' },
        { icon:'beer/img/fren.png',          title:'Пригласи друзей',    sub:'Дарим +100 монет за друга',       link:'#invite',   action:'link', sheet_id:'', sheet_path:'' }
      ];
      return `
        <section class="card list-card games tight">
          <div class="list-head">${title}</div>
          <div class="list">
            ${cards.map((c)=>{
              const action = c.action || 'link';
              let attr = '';
if (action === 'sheet' && c.sheet_id){
  attr = ` data-open-sheet="${c.sheet_id}"`;
} else if (action === 'sheet_page' && c.sheet_path){
  attr = ` data-open-sheet-page="${c.sheet_path}"`;
} else if (c.link){
  attr = ` data-link="${c.link}"`;
}
              return `
              <div class="list__item">
                <div class="list__icon">
                  <img src="${c.icon||'beer/img/pasport.png'}" alt="">
                </div>
                <div class="list__text">
                  <div class="list__title">${c.title||''}</div>
                  <div class="list__sub">${c.sub||''}</div>
                </div>
                <button class="list__chev-btn" type="button"${attr}>›</button>
              </div>`;
            }).join('')}
          </div>
        </section>
      `;
    }
  },


  beerInviteFriends:{
    type:'htmlEmbed',
    title:'Beer: Пригласи друзей',
    defaults:{
      title:'Пригласи друзей',
      text:'За друга — +100 монет. За 3 друзей — мини-дегустация.',
      link:'https://t.me/your_bot?start=invite',
      primary:'Скопировать',
      secondary:'Поделиться'
    },
    preview:(p={})=>{
      const title = p.title || 'Пригласи друзей';
      const text  = p.text  || 'За друга — +100 монет. За 3 друзей — мини-дегустация.';
      const link  = p.link  || 'https://t.me/your_bot?start=invite';
      const primary   = p.primary   || 'Скопировать';
      const secondary = p.secondary || 'Поделиться';
      return `
        <section class="card invite-card">
          <div class="invite-card__title">${title}</div>
          <div class="invite-card__text">${text}</div>
          <div class="invite-card__link">${link}</div>
          <div class="invite-card__btns">
            <button type="button" class="invite-card__btn invite-card__btn--primary">${primary}</button>
            <button type="button" class="invite-card__btn">${secondary}</button>
          </div>
        </section>
      `;
    }
  },

  


bookingCalendar:{
    type:'htmlEmbed',
    title:'Booking: Календарь',
    defaults:{ title:'Календарь', text:'Декабрь 2025 г.' },
    preview:(p={})=>{
      const title = p.title || 'Календарь';
      const month = p.text  || 'Декабрь 2025 г.';
      return `
        <section class="booking-card">
          <div class="booking-card__title">${title}</div>
          <div id="cal" class="booking-calendar" data-month="${month}"></div>
        </section>
      `;
    },
    // Локальный демо-календарь для превью (и страницы, и шторки)
    init:(el, props, ctx)=>{
      try{
        const calWrap = el.querySelector('.booking-calendar') || el.querySelector('#cal');
        if (!calWrap) return null;

        let selDay = null;

        function buildCalendar(){
          // если сетка уже есть (например, от глобального скрипта) — не трогаем
          if (calWrap.querySelector('.booking-calendar__grid')) return;

          calWrap.innerHTML = '';

          const now = new Date();
          const y = now.getFullYear();
          const m = now.getMonth(); // 0-11
          const first = new Date(y, m, 1);
          const startDow = (first.getDay() + 6) % 7; // Пн=0
          const daysInMonth = new Date(y, m+1, 0).getDate();

          const grid = document.createElement('div');
          grid.className = 'booking-calendar__grid';

          const dow = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

          dow.forEach(d=>{
            const elDow = document.createElement('div');
            elDow.className = 'booking-calendar__dow';
            elDow.textContent = d;
            grid.appendChild(elDow);
          });

          for(let i=0;i<startDow;i++){
            const empty = document.createElement('div');
            empty.className = 'booking-calendar__day booking-calendar__day--muted';
            grid.appendChild(empty);
          }

          for(let d=1; d<=daysInMonth; d++){
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'booking-calendar__day';
            btn.textContent = String(d);
            btn.addEventListener('click', ()=>{
              selDay = d;
              grid.querySelectorAll('.booking-calendar__day').forEach(b=>b.classList.remove('booking-calendar__day--active'));
              btn.classList.add('booking-calendar__day--active');
            });
            grid.appendChild(btn);
          }

          calWrap.appendChild(grid);
        }

        buildCalendar();
      }catch(e){
        console.error('bookingCalendar init error', e);
      }
      return null;
    }
  },
bookingSlots:{
    type:'htmlEmbed',
    title:'Booking: Время',
    defaults:{ title:'Доступное время', items:['10:30','11:30','12:30','13:30','14:30'] },
    preview:(p={})=>{
      const title = p.title || 'Доступное время';
      const items = Array.isArray(p.items) ? p.items : String(p.items||'').split(',').map(s=>s.trim()).filter(Boolean);
      const times = items.length ? items : ['10:30','11:30','12:30','13:30','14:30'];
      return `
        <section class="booking-card">
          <div class="booking-card__title">${title}</div>
          <div id="slots" class="booking-slots">
            ${times.map(t=>`<button type="button" class="booking-slot">${t}</button>`).join('')}
          </div>
        </section>
      `;
    }
  },



bookingContact:{
    type:'htmlEmbed',
    title:'Booking: Контакты',
    defaults:{ title:'Контакты', text:'', placeholder:'+79991234567', label:'Подтвердить' },
    preview:(p={})=>{
      const title = p.title || 'Контакты';
      const placeholder = p.placeholder || '+79991234567';
      const btn = p.label || 'Подтвердить';
      return `
        <section class="booking-card">
          <div class="booking-card__title">${title}</div>
          <input id="contact" class="booking-contact-input" type="tel" placeholder="${placeholder}">
          <button id="confirmConsult" type="button" class="booking-contact-btn">${btn}</button>
        </section>
      `;
    }
  },


  flappyGame:{
    type:'game',
    title:'Flappy',
    // настройки по умолчанию
    defaults:{
      key:'flappy',
      autostart:true,
      min_h:520,
      difficulty:'normal',   // easy | normal | hard
      bird_mode:'default',   // default | custom
      bird_img:'',
      shield_img:''
    },
    preview:(p)=>{
      const key  = (p&&p.key)||'flappy';
      const mh   = (p&&p.min_h)||520;
      const diff = (p&&p.difficulty)||'normal';
      const diffLabel = diff==='easy' ? 'Легко' : (diff==='hard' ? 'Жёстко' : 'Норма');
      return `
        <div class="card game-card" data-game-block data-game-key="${key}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div><b>Flappy</b><div class="mut" style="opacity:.7;font-size:12px">Тапай / Space</div></div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="mut" style="opacity:.7;font-size:12px">Авто</span>
              <span class="pill pill-xs" style="font-size:11px;opacity:.85">${diffLabel}</span>
            </div>
          </div>
          <div class="game-host" data-game-host style="margin-top:10px;min-height:${mh}px"></div>
        </div>`;
    },
    // init превью: монтируем игру и пробрасываем props
    init:(el, props, ctx)=>{
      try{
        const key = (props && props.key) ? String(props.key) : 'flappy';
        const host = el.querySelector('[data-game-host]') || el.querySelector('.game-host');
        if(!host) return null;
        if(window.mountGame){
          const cleanup = window.mountGame(key, host, {ctx, props}) || null;
          host.__cleanup = (typeof cleanup==='function') ? cleanup : null;
          return host.__cleanup;
        }
        if(window.GAMES && window.GAMES[key] && typeof window.GAMES[key].mount==='function'){
          const cleanup = window.GAMES[key].mount(host, {ctx, props}) || null;
          host.__cleanup = (typeof cleanup==='function') ? cleanup : null;
          return host.__cleanup;
        }
        host.innerHTML = '<div class="card">Игра не подключена: '+key+'</div>';
        return null;
      }catch(_){ return null; }
    }
  },

leaderboard:{
  type:'leaderboard',
  title:'Турнир',
  defaults:{
    title:'Bumblebee',
    text:'Турнирная таблица'
  },
  preview:(p={})=>`
    <section class="blk blk-beer">
      <div id="leaderboard" class="lb-card">
        <div class="lb-head">
          <div>
            <div class="lb-title">${p.title || 'Bumblebee'}</div>
            <div class="lb-sub">${p.text || 'Турнирная таблица'}</div>
          </div>
          <div class="lb-seg">
            <button type="button" data-lb-tab="today" aria-pressed="true">День</button>
            <button type="button" data-lb-tab="all" aria-pressed="false">Все</button>
          </div>
        </div>

        <div class="lb-you">
          <div class="lb-you__avatar">S</div>
          <div>
            <div class="lb-you__name">Serge Kamesky</div>
            <div class="lb-you__sub" data-bind="lb-me-label">best score all</div>
          </div>
          <div class="lb-you__score js-lb-me-best" id="lb-you-score">94</div>
        </div>

        <div class="lb-lists">
          <div class="lb-list" data-lb-list="today" style="display:block;">
            <div class="lb-row">
              <div class="lb-rank">1</div>
              <div class="lb-you__avatar">S</div>
              <div class="lb-name">Serge Kamesky</div>
              <div class="lb-score">94</div>
            </div>
            <div class="lb-row">
              <div class="lb-rank">2</div>
              <div class="lb-you__avatar">O</div>
              <div class="lb-name">Ob Server</div>
              <div class="lb-score">93</div>
            </div>
          </div>
          <div class="lb-list" data-lb-list="all" style="display:none;">
            <div class="lb-row">
              <div class="lb-rank">1</div>
              <div class="lb-you__avatar">A</div>
              <div class="lb-name">All Time Ace</div>
              <div class="lb-score">999</div>
            </div>
            <div class="lb-row">
              <div class="lb-rank">2</div>
              <div class="lb-you__avatar">B</div>
              <div class="lb-name">Best Player</div>
              <div class="lb-score">800</div>
            </div>
          </div>
        </div>
        <div class="lb-actions">
          <button type="button" class="lb-btn" data-action="lb-refresh">Обновить</button>
          <button type="button" class="lb-btn lb-btn--primary js-lb-play">Играть</button>
        </div>
      </div>
    </section>
  `,
  init:(el, props, ctx)=>{
    try{
      const tabs = el.querySelectorAll('[data-lb-tab]');
      const lists = el.querySelectorAll('[data-lb-list]');
      if (!tabs.length || !lists.length) return null;

      function setMode(mode){
        tabs.forEach(btn=>{
          const isActive = btn.getAttribute('data-lb-tab') === mode;
          btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        lists.forEach(list=>{
          const on = list.getAttribute('data-lb-list') === mode;
          list.style.display = on ? 'block' : 'none';
        });
      }

      tabs.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const mode = btn.getAttribute('data-lb-tab') || 'today';
          setMode(mode);
        });
      });

      setMode('today');
    }catch(e){
      console.error('leaderboard init error', e);
    }
    return null;
  }
},
  bonusWheel:{
    type:'bonusWheel',
    title:'Колесо',
    defaults:{
      title:'Колесо бонусов',
      spin_cost: 10,
      prizes:[
      {code:"coins_5", name:"5 \ud83e\ude99", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%237b5bff%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E5%3C/text%3E%0A%3C/svg%3E"},
      {code:"coins_20", name:"20 \ud83e\ude99", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%233de0c5%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E20%3C/text%3E%0A%3C/svg%3E"},
      {code:"beer", name:"\ud83c\udf7a", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ef476f%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E%F0%9F%8D%BA%3C/text%3E%0A%3C/svg%3E"},
      {code:"snack", name:"\ud83e\udd68", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23118ab2%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E%F0%9F%A5%A8%3C/text%3E%0A%3C/svg%3E"},
      {code:"shot", name:"\ud83e\udd43", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ffd166%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E%F0%9F%A5%83%3C/text%3E%0A%3C/svg%3E"},
      {code:"gift", name:"\ud83c\udf81", img:"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22256%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%3Cstop%20offset%3D%220%22%20stop-color%3D%22%2306d6a0%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23111827%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22256%22%20height%3D%22256%22%20rx%3D%2236%22%20fill%3D%22url%28%23g%29%22/%3E%0A%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2Csystem-ui%22%20font-size%3D%2292%22%20fill%3D%22white%22%3E%F0%9F%8E%81%3C/text%3E%0A%3C/svg%3E"}
      ]
    },
    preview:(p={})=>{
      const title = (p && p.title) ? p.title : 'Колесо бонусов';
      const prizes = Array.isArray(p.prizes) ? p.prizes : [];
      const items = prizes.map(pr=>`
        <button class="bonus" type="button" data-code="${pr.code||''}" data-name="${pr.name||''}">
          <img src="${pr.img||''}" alt="">
          <span>${pr.name||''}</span>
        </button>`).join('');
      return `
      <div class="card bonus-card">
        <div class="h2">${title}</div>
        <div class="bonus-head">
          <div class="picked-pill muted" data-picked-pill>Нажми «Крутануть»</div>
          <div class="mut" style="margin-left:auto">Монеты: <b data-coins>0</b></div>
        </div>
        <div class="bonus-wheel" data-bonus-wheel>
          <div class="wheel-track" data-wheel-track>
            ${items}
          </div>
          <div class="wheel-center"></div>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" data-spin>Крутануть</button>
          <button class="btn" type="button" data-claim disabled>Нет приза к выдаче</button>
          <div data-picked class="mut"></div>
        </div>
      </div>`;
    },
    init:(el, props, ctx)=>{
      // ---- scoped wheel runtime (based on bonus_demo_fixed) ----
      const wheel = el.querySelector('[data-bonus-wheel]');
      const track = el.querySelector('[data-wheel-track]');
      if(!wheel || !track) return;

      const pill  = el.querySelector('[data-picked-pill]');
      const claim = el.querySelector('[data-claim]');
      const spin  = el.querySelector('[data-spin]');
      const coinsEl = el.querySelector('[data-coins]');
      const pickedEl= el.querySelector('[data-picked]');

      // Provide demo state/api if app doesn't have them yet
      if(!window.MiniState) {
        window.MiniState = {
          coins: 50,
          config: { WHEEL_SPIN_COST: (Number(props?.spin_cost)||10) },
          wheel: { has_unclaimed:false, claim_cooldown_left_ms:0, last_prize_title:'' }
        };
      }
      if(typeof window.applyServerState!=='function') {
        window.applyServerState = function(fresh){
          if(!fresh) return;
          window.MiniState = window.MiniState || {};
          for(const k in fresh) window.MiniState[k] = fresh[k];
        };
      }
      if(typeof window.api!=='function') {
        // light mock for preview
        window.api = async function(method, payload){
          await new Promise(r=>setTimeout(r, 250));
          const st = window.MiniState||{};
          st.wheel = st.wheel || {};
          if(method==='wheel.spin') {
            const cost = Number((st.config||{}).WHEEL_SPIN_COST || (Number(props?.spin_cost)||0) || 0);
            if(Number(st.coins||0) < cost) return {ok:false, error:'no_coins'};
            st.coins = Number(st.coins||0) - cost;
            const list = (Array.isArray(props?.prizes) ? props.prizes : []);
            const pick = list[Math.floor(Math.random()*Math.max(1,list.length))] || {};
            st.wheel.has_unclaimed = true;
            st.wheel.claim_cooldown_left_ms = 0;
            st.wheel.last_prize_title = pick.name || pick.code || '';
            return {ok:true, prize:{code: pick.code}, fresh_state:{coins:st.coins, wheel:st.wheel}};
          }
          if(method==='wheel.claim') {
            if(!st.wheel.has_unclaimed) return {ok:false, error:'no_unclaimed_prize'};
            st.wheel.has_unclaimed=false;
            st.wheel.claim_cooldown_left_ms = 15000;
            return {ok:true, fresh_state:{coins:st.coins, wheel:st.wheel}};
          }
          return {ok:false, error:'unknown_method'};
        };
      }

      const items = Array.from(track.children);
      const N = items.length || 1;

      // animation settings
      const CONFETTI_CODES = ['coins_20','coins_5'];
      const FINAL_LAPS = 1;
      const FINAL_DUR  = 1200;
      const MIN_SPIN_MS = 1600;
      const FREE_SPIN_RPS = 1;

      let STEP = 114;
      requestAnimationFrame(()=>{
        const a = items[0]?.getBoundingClientRect();
        const b = items[1]?.getBoundingClientRect();
        if(a && b){
          const dx = Math.round(b.left - a.left);
          if(dx>40 && dx<300) STEP = dx;
        }
      });

      let curr=0, interacted=false, spinning=false;
      const mod = (a,n)=>((a%n)+n)%n;
      function nearest(curr, idx, n){
        let t = idx;
        while (t - curr > n/2) t -= n;
        while (curr - t > n/2) t += n;
        return t;
      }

      const TG = window.Telegram && window.Telegram.WebApp;
      function hapticPulse(level='light'){
        try{ if(TG?.HapticFeedback){ if(level==='selection') return TG.HapticFeedback.selectionChanged(); TG.HapticFeedback.impactOccurred(level); return; } }catch(_ ){}
        try{ navigator.vibrate && navigator.vibrate(level==='heavy'?30:level==='medium'?20:12); }catch(_ ){}
      }

      // toast + confetti helpers (shared CSS already in theme)
      function ensureToastHost(){
        let host = document.getElementById('toasts');
        if(!host){ host=document.createElement('div'); host.id='toasts'; host.className='toasts'; document.body.appendChild(host); }
        return host;
      }
      function showToast(msg, type='error', ms=2800){
        const host=ensureToastHost();
        const el=document.createElement('div');
        el.className='toast'+(type==='ok'?' toast--ok':' toast--error');
        el.innerHTML = `<span>${msg}</span><button class="toast__close" aria-label="Закрыть">✕</button>`;
        host.appendChild(el);
        const close=()=>{ el.style.animation='toast-out .22s ease forwards'; setTimeout(()=>el.remove(),240); };
        el.querySelector('.toast__close')?.addEventListener('click', close);
        setTimeout(close, ms);
      }
      function confettiBurst(x,y){
        let layer=document.getElementById('confetti');
        if(!layer){ layer=document.createElement('div'); layer.id='confetti'; document.body.appendChild(layer); }
        const colors=['#7b5bff','#3de0c5','#ffd166','#ef476f','#06d6a0','#118ab2'];
        const rect=document.body.getBoundingClientRect();
        const ox=(x ?? rect.width/2), oy=(y ?? rect.height/3);
        for(let i=0;i<36;i++){ 
          const c=document.createElement('div');
          c.className='confetti-piece';
          c.style.background=colors[i%colors.length];
          const ang=(i/36)*Math.PI*2;
          const speed=140+Math.random()*120;
          const dx=Math.cos(ang)*speed;
          const dy=Math.sin(ang)*speed+220;
          c.style.setProperty('--x', ox+'px');
          c.style.setProperty('--y', oy+'px');
          c.style.setProperty('--dx', dx+'px');
          c.style.setProperty('--dy', dy+'px');
          layer.appendChild(c);
          setTimeout(()=>c.remove(),950);
        }
      }

      // claim cooldown
      let claimTimerId=null, claimLeftMsLocal=0;
      function getMiniState(){ return window.MiniState||{}; }
      function getWheelState(){ const st=getMiniState(); return st.wheel||{}; }
      function getCoins(){ return Number(getMiniState().coins||0); }
      function getSpinCost(){ const cfg=(getMiniState().config||{}); return Number(cfg.WHEEL_SPIN_COST||cfg.SPIN_COST||0); }

      function syncCoinsUI(){
        const coins=getCoins();
        if(coinsEl) coinsEl.textContent=String(coins);
        if(spin) spin.classList.toggle('is-locked', (coins<getSpinCost())||spinning);
      }

      function refreshClaimState(){
        if(!claim) return;
        const ws=getWheelState();
        const rem=Number(ws.claim_cooldown_left_ms||0);
        const hasPrize=!!ws.has_unclaimed;

        if(claimTimerId){ clearInterval(claimTimerId); claimTimerId=null; }

        if(!hasPrize){ claim.disabled=true; claim.textContent='Нет приза к выдаче'; return; }

        claimLeftMsLocal = rem;
        if(claimLeftMsLocal<=0){ claim.disabled=false; claim.textContent='Забрать бонус'; return; }

        claim.disabled=true;
        const tick=()=>{
          if(claimLeftMsLocal<=0){ clearInterval(claimTimerId); claimTimerId=null; claim.disabled=false; claim.textContent='Забрать бонус'; return; }
          const totalSec=Math.floor(claimLeftMsLocal/1000);
          const m=Math.floor((totalSec%3600)/60), s=totalSec%60;
          claim.textContent='Доступно через '+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
          claimLeftMsLocal -= 1000;
        };
        tick();
        claimTimerId=setInterval(tick,1000);
      }

      function updatePillByIndex(idx){
        const it=items[idx];
        const name=it?.dataset?.name||'—';
        const img=it?.querySelector('img')?.src||'';
        if(!pill) return;
        pill.classList.remove('muted');
        pill.innerHTML = img ? `<img src="${img}" alt=""><span>${name}</span>` : name;
      }

      function updateUI(){
        items.forEach((node,i)=>{
          let dx=i-curr; dx = mod(dx + N/2, N) - N/2;
          const x=dx*STEP;
          const s=1 - Math.min(Math.abs(dx)*0.16, 0.48);
          node.style.transform=`translate(-50%,-50%) translateX(${x}px) scale(${s})`;
          node.style.zIndex=String(1000 - Math.abs(dx)*10);
          node.classList.toggle('active', Math.round(Math.abs(dx))===0);
        });
        if(interacted) updatePillByIndex(mod(Math.round(curr), N));
        else if(pill){ pill.classList.add('muted'); pill.textContent='Нажми «Крутануть»'; }
        refreshClaimState();
        syncCoinsUI();
      }

      function spinTo(targetIdx, laps=1, dur=1600){
        return new Promise(resolve=>{
          const base=nearest(curr,targetIdx,N);
          const dir=(base>=curr?1:-1)||1;
          const to=base + dir*(laps*N);
          const from=curr;
          const t0=performance.now();
          let lastPulse=0;
          function tick(t){
            const k=Math.min((t-t0)/dur,1);
            curr = from + (to-from)*(1-Math.pow(1-k,3));
            updateUI();
            const period = 80 + 180*k;
            if(t-lastPulse>=period){ hapticPulse('light'); lastPulse=t; }
            if(k<1) requestAnimationFrame(tick);
            else { curr=to; interacted=true; updateUI(); resolve(); }
          }
          requestAnimationFrame(tick);
        });
      }

      // free spin
      const FREE_SPIN_SPEED = (FREE_SPIN_RPS * N) / 1000;
      let freeSpinRunning=false;
      function startFreeSpin(){
        if(freeSpinRunning) return;
        freeSpinRunning=true;
        let last=performance.now();
        function loop(now){
          if(!freeSpinRunning) return;
          const dt=now-last; last=now;
          curr = mod(curr + FREE_SPIN_SPEED*dt, N);
          updateUI();
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
      }
      function stopFreeSpin(){ freeSpinRunning=false; }

      spin?.addEventListener('click', async ()=>{
        if(spinning) return;
        const coins=getCoins(), cost=getSpinCost();
        if(coins < cost){ hapticPulse('medium'); showToast(`Недостаточно монет. Нужно ${cost} 🪙`, 'error'); return; }
        if(typeof window.api!=='function'){ showToast('API не инициализировалось', 'error', 3200); return; }
        spinning=true; spin.classList.add('is-locked');
        const startTs=performance.now();
        startFreeSpin();
        try{
          let r;
          try{ r = await window.api('wheel.spin', {}); }catch(e){ r={ok:false,error:'network'}; }
          const elapsed = performance.now()-startTs;
          if(elapsed<MIN_SPIN_MS) await new Promise(res=>setTimeout(res, MIN_SPIN_MS-elapsed));
          stopFreeSpin();

          if(!r || !r.ok){ showToast('Ошибка при крутке: '+(r?.error||'unknown'), 'error', 3200); return; }

          if(r.fresh_state && window.applyServerState) window.applyServerState(r.fresh_state);

          const code = r.prize?.code || '';
          let idx = items.findIndex(n=>String(n.dataset.code||'')===String(code));
          if(idx<0) idx = Math.floor(Math.random()*N);

          if(CONFETTI_CODES.includes(code)) {
            const rect = spin.getBoundingClientRect();
            confettiBurst(rect.left + rect.width/2, rect.top + rect.height/2);
          }

          await spinTo(idx, FINAL_LAPS, FINAL_DUR);

          const ws=getWheelState();
          if(pickedEl) pickedEl.textContent = ws.last_prize_title ? `Выпало: ${ws.last_prize_title}` : '';
        } finally {
          spinning=false; spin.classList.remove('is-locked');
          syncCoinsUI(); refreshClaimState();
        }
      });

      claim?.addEventListener('click', async ()=>{
        if(claim.disabled) return;
        try{
          const r = await window.api('wheel.claim', {});
          if(!r || !r.ok){ showToast('Ошибка при подтверждении: '+(r?.error||'unknown'), 'error', 3200); refreshClaimState(); return; }
          if(r.fresh_state && window.applyServerState) window.applyServerState(r.fresh_state);
          showToast('Приз подтверждён, подойди к бармену', 'ok', 2200);
          refreshClaimState();
        }catch(e){ showToast('Ошибка сети', 'error', 2800); }
      });

      // initial
      updateUI();

      // cleanup
      return ()=>{
        try{ claimTimerId && clearInterval(claimTimerId); }catch(_ ){}
      };
    }
  },
  

  stylesPassport:{
    type:'stylesPassport',
    title:'Паспорт стилей',
    defaults:{
      title:'Паспорт стилей',
      subtitle:'Собери 6 штампов — приз.',
      cover_url:'',
      grid_cols: 3,
      require_pin: true,
      styles:[
        {code:'lager', name:'Lager'},
        {code:'ipa', name:'IPA'},
        {code:'stout', name:'Stout'},
        {code:'weizen', name:'Weizen'},
        {code:'sour', name:'Sour'},
        {code:'cider', name:'Cider'}
      ]
    },
    preview:(p)=>{
      const cols = Number(p.grid_cols||3);
      const styles = Array.isArray(p.styles)?p.styles:[];
      const safe = (s)=>String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const cover = p.cover_url ? `<img src="${p.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;display:grid;place-items:center;opacity:.6">IMG</div>`;
      return `
<style>${STYLES_PASSPORT_CSS}</style>
<div class="card passport stylesPassport" data-styles-passport>
  <div class="passport__media">${cover}</div>
  <div class="passport__content">
    <div class="passport__title">${safe(p.title||'')}</div>
    <div class="passport__sub">${safe(p.subtitle||'')}</div>
    <div class="passport-grid" style="grid-template-columns: repeat(${isFinite(cols)&&cols>0?cols:3}, minmax(0,1fr));">
      ${styles.map(st=>`
        <div class="pslot" data-style-code="${safe(st.code||'')}">
          <div class="pslot__title">${safe(st.name||st.code||'')}</div>
          <div class="pslot__badge">Получить</div>
        </div>
      `).join('')}
    </div>
  </div>
</div>`;
    },
    init:(el, props, ctx)=>{
      const root = el.querySelector('[data-styles-passport]') || el;
      const grid = root.querySelector('.passport-grid');
      if(!grid) return;

      // demo state/api if missing
      if(!window.MiniState) window.MiniState = {};
      if(!window.MiniState.passport) window.MiniState.passport = {stamps:[]};

      if(typeof window.applyServerState!=='function'){
        window.applyServerState = function(fresh){
          if(!fresh) return;
          window.MiniState = window.MiniState || {};
          for(const k in fresh) window.MiniState[k] = fresh[k];
        };
      }

      if(typeof window.api!=='function'){
        window.api = async function(method, payload){
          await new Promise(r=>setTimeout(r, 250));
          const st = window.MiniState||{};
          if(method==='style.collect'){
            const pin = String(payload?.pin||'');
            const style_id = String(payload?.style_id||'').trim();
            if(!style_id) return {ok:false, error:'NO_STYLE'};
            if(pin && pin!=='1111') return {ok:false, error:'BAD_PIN'};
            st.passport = st.passport || {stamps:[]};
            const arr = Array.isArray(st.passport.stamps)?st.passport.stamps.slice():[];
            const low = style_id.toLowerCase();
            if(!arr.some(x=>String(x).toLowerCase()===low)) arr.push(style_id);
            st.passport.stamps = arr;
            return {ok:true, fresh_state:{ passport: st.passport }};
          }
          return {ok:false, error:'NO_METHOD'};
        };
      }

      const toast = (msg, ok)=>{
        try{
          if(window.showToast) return window.showToast(msg, ok);
          if(!ok) console.warn(msg); else console.log(msg);
        }catch(_){}
      };

      function readLocalStamps(){
        try{
          const v1 = JSON.parse(localStorage.getItem('beer_passport_v1')||'{}')||{};
          const arr = Array.isArray(v1.stamps)?v1.stamps:[];
          return arr.map(x=>String(x));
        }catch(_){ return []; }
      }

      function updateLocalCaches(code){
        try{
          const c = String(code||'').trim(); if(!c) return;
          // map
          let map={}; try{ map=JSON.parse(localStorage.getItem('beer_passport')||'{}')||{}; }catch(_){}
          map[c]=true;
          localStorage.setItem('beer_passport', JSON.stringify(map));
          // v1
          let v1={}; try{ v1=JSON.parse(localStorage.getItem('beer_passport_v1')||'{}')||{}; }catch(_){}
          const arr = Array.isArray(v1.stamps)?v1.stamps.slice():[];
          const low = c.toLowerCase();
          if(!arr.some(x=>String(x).toLowerCase()===low)) arr.push(c);
          localStorage.setItem('beer_passport_v1', JSON.stringify({stamps:arr}));
        }catch(_){}
      }

      function getDoneSet(){
        const st = window.MiniState||{};
        const s1 = (st.passport && Array.isArray(st.passport.stamps)) ? st.passport.stamps : [];
        const s2 = readLocalStamps();
        const set = new Set([...s1,...s2].map(x=>String(x).toLowerCase()));
        return set;
      }

      function paint(){
        const done = getDoneSet();
        grid.querySelectorAll('.pslot[data-style-code]').forEach(card=>{
          const code = String(card.getAttribute('data-style-code')||'').toLowerCase();
          const isDone = done.has(code);
          card.classList.toggle('is-done', isDone);
          const badge = card.querySelector('.pslot__badge');
          if(badge) badge.textContent = isDone ? 'Получен' : 'Получить';
        });
      }

      // click handler (scoped)
      let inFlight = false;
      root.addEventListener('click', async (e)=>{
        const card = e.target.closest('.pslot[data-style-code]');
        if(!card || !root.contains(card)) return;
        if(inFlight) return;
        const style_id = String(card.getAttribute('data-style-code')||'').trim();
        if(!style_id) return;

        paint();
        if(card.classList.contains('is-done')){
          toast('Этот стиль уже получен.', true);
          return;
        }

        let pin = '';
        if(props && props.require_pin){
          pin = prompt('Введите PIN для получения штампа', '') || '';
          if(!pin){ toast('Отменено', false); return; }
        }

        try{
          inFlight = true;
          const r = await window.api('style.collect', {style_id, pin});
          if(!r || r.ok===false){
            const err = (r && r.error) ? String(r.error) : 'ERR';
            toast(err==='BAD_PIN'?'Неверный PIN':'Ошибка получения', false);
            return;
          }
          if(r.fresh_state) window.applyServerState(r.fresh_state);
          updateLocalCaches(style_id);
          paint();
          toast('Штамп получен!', true);
        }catch(ex){
          toast('Ошибка сети', false);
        }finally{
          inFlight = false;
        }
      });

      // initial
      paint();
    }
  },



  profile_header:{
    type:'htmlEmbed',
    title:'Профиль — шапка',
    defaults:{ title:'Serge Kamesky', text:'@Serge_Kamensky' },
    preview:(p={})=>`
      <section class="profile-block">
        <div class="pf-hero">
          <div class="pf-ava">
            <img src="https://via.placeholder.com/56x56" alt="avatar">
          </div>
          <div class="pf-about">
            <div class="pf-name">${p.title||'Serge Kamesky'}</div>
            <div class="pf-username">${p.text||'@Serge_Kamensky'}</div>
          </div>
          <div class="metric metric--balance">
            <div class="metric__val">
              <span id="pf-coins">4667</span><span class="coin-ico"></span>
            </div>
            <div class="metric__lbl">Монеты</div>
          </div>
        </div>
      </section>`
  },

  profile_achievements:{
    type:'htmlEmbed',
    title:'Профиль — достижения',
    defaults:{
      title:'🎯 Мои достижения',
      best_label:'Шмель — лучший счёт',
      pass_label:'Паспорт — штампы',
      last_label:'Последний штамп',
      refs_label:'Мои рефералы'
    },
    preview:(p={})=>`
      <section class="profile-block">
        <div class="section-title">${p.title || '🎯 Мои достижения'}</div>
        <div class="metrics">
          <div class="metric">
            <div class="metric__val" id="pf-best-score">94</div>
            <div class="metric__lbl">${p.best_label || 'Шмель — лучший счёт'}</div>
          </div>
          <div class="metric">
            <div class="metric__val" id="pf-pass-count">2/6</div>
            <div class="metric__lbl">${p.pass_label || 'Паспорт — штампы'}</div>
          </div>
          <div class="metric">
            <div class="metric__val" id="pf-last-stamp">Weizen</div>
            <div class="metric__lbl">${p.last_label || 'Последний штамп'}</div>
          </div>
          <div class="metric">
            <div class="metric__val" id="pf-referrals-count">1</div>
            <div class="metric__lbl">${p.refs_label || 'Мои рефералы'}</div>
          </div>
        </div>
      </section>`
  },





  profile_tournament:{
    type:'htmlEmbed',
    title:'Профиль — турнир',
    defaults:{ title:'🏆 Турнир', text:'' },
    preview:(p={})=>`
      <section class="profile-block">
        <div class="section-title">${p.title||'🏆 Турнир'}</div>
        <div class="metrics">
          <div class="metric">
            <div class="metric__val" id="pf-rank-today">—</div>
            <div class="metric__lbl">Место сегодня</div>
          </div>
          <div class="metric">
            <div class="metric__val" id="pf-rank-alltime">1</div>
            <div class="metric__lbl">All-time</div>
          </div>
        </div>
      </section>`
  },

  profile_recent_prizes:{
    type:'htmlEmbed',
    title:'Профиль — последние призы',
    defaults:{ title:'🎁 Последние призы', text:'' },
    preview:(p={})=>`
      <section class="profile-block">
        <div class="section-title">${p.title||'🎁 Последние призы'}</div>
        <div class="chips">
          <div class="chip">
            <span>🍺 Бесплатный бокал</span>
          </div>
          <div class="chip">
            <span>🎟 Билет в турнир</span>
          </div>
          <div class="chip chip--muted">
            <span>Новые призы будут здесь</span>
          </div>
        </div>
      </section>`
  },
};

window.PagePresets = {
  home: ['beerHero','infoCardPlain','spacer','promo','gamesList'],
  play: ['gamesPicker'],
  tournament: ['leaderboard'],
  bonuses: ['bonusWheel','beerStartList'],
  profile: ['profile_header','spacer','profile_achievements','spacer','profile_tournament','spacer','profile_recent_prizes'],
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
  const LIB_BASE = (function(){
    try{ return new URL('blocks/', (document.currentScript && document.currentScript.src) || location.href).toString(); }
    catch(_){ return 'blocks/'; }
  })();
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

    if (reg.type === 'htmlEmbed'){
      reg.html = tpl;
      reg.preview = reg.preview || function(p){
        try{
          const src = (p && p.img) ? String(p.img) : '';
          const r = Number((p && p.radius) ?? 16);
          if (src) return `<div class="card" style="padding:0;overflow:hidden;border-radius:${r}px"><img src="${esc(src)}" style="display:block;width:100%;height:120px;object-fit:cover"/></div>`;
        }catch(_){}
        return `<div class="card">${esc(reg.title||mf.id)}</div>`;
      };
    }

    // init hook from runtime mount/unmount
    if (mf.__runtime && (mf.__runtime.mount || mf.__runtime.unmount)){
      reg.init = function(el, props, ctx){
        try{
          if (mf.__runtime.mount){
            const ret = mf.__runtime.mount(el, props||{}, ctx||{});
            if (typeof ret === 'function') return ret;
          }
        }catch(e){ console.warn('Block mount failed', mf.id, e); }
        return function(){
          try{ mf.__runtime && mf.__runtime.unmount && mf.__runtime.unmount(el, ctx||{}); }catch(_){}
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
          const index = await fetchJSON(LIB_BASE + 'index.json');
          if (Array.isArray(index)){
            for (const id of index){
              try{ await loadBlock(id); }catch(e){ console.warn('Block load failed', id, e); }
            }
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