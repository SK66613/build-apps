export async function mount(root, props, ctx){
  const $ = s => root.querySelector(s);

  const titleEl   = $('[data-title]');
  const monthEl   = $('.cal-month');
  const monthTitle= $('[data-month-title]');
  const btnPrev   = $('.cal-monthbar .prev');
  const btnNext   = $('.cal-monthbar .next');
  const durWrap   = $('.cal-durations');
  const slotsEl   = $('.cal-slots');
  const contactEl = $('.cal-contact');
  const btnHold   = $('.cal-hold');
  const btnBook   = $('.cal-book');

  const view        = props.view || 'month';
  const showHold    = props.show_hold !== false;
  const showBook    = props.show_book !== false;
  const showContact = props.show_contact !== false;
  const allowed = (Array.isArray(props.allowed_minutes) ? props.allowed_minutes
                  : Array.isArray(props.allowedDurations) ? props.allowedDurations
                  : [60]).map(n=>Number(n)).filter(Boolean);
  const defaultDuration = Number(props.defaultDuration || (allowed[0] || 60));

  root.style.setProperty('--acc', props.accent || 'var(--accent)');
  root.style.setProperty('--accActiveBg', props.accentActiveBg || props.accent || 'var(--accent)');
  root.style.setProperty('--accActiveText', props.accentActiveText || '#fff');
  root.style.setProperty('--chipBg', props.chipBg || 'var(--surface2)');
  root.style.setProperty('--chipText', props.chipText || 'var(--text)');
  root.style.setProperty('--radius', (props.radius ?? 10) + 'px');
  root.style.setProperty('--gap', (props.gap ?? 8) + 'px');

  titleEl.textContent = props.title || 'Записаться на консультацию';
  contactEl.style.display = showContact ? '' : 'none';
  btnHold.style.display   = showHold ? '' : 'none';
  btnBook.style.display   = showBook ? '' : 'none';

  const isPreview = (typeof window.api !== 'function');
  let current = new Date(); current.setDate(1);
  let selectedISO = null;
  let activeDuration = defaultDuration;

  const toISO = (y,m,d)=> `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const monthName = (d)=> d.toLocaleDateString('ru-RU', {month:'long', year:'numeric'});
  const clearActive = (sel)=> root.querySelectorAll(sel).forEach(x=>x.classList.remove('is-active'));

  function renderDurations(){
    const arr = allowed.length ? allowed : [60];
    durWrap.innerHTML = arr.map(v => `<button type="button" class="chip${v===activeDuration?' is-active':''}" data-min="${v}">${v} мин</button>`).join('');
  }

  function renderMonth(){
    monthTitle.textContent = monthName(current);
    const y = current.getFullYear(), m = current.getMonth();
    const days = new Date(y, m+1, 0).getDate();
    const start = (new Date(y, m, 1).getDay() + 6) % 7;

    monthEl.innerHTML = '';
    for (let i=0;i<start;i++) monthEl.insertAdjacentHTML('beforeend','<div class="day disabled"></div>');
    for (let d=1; d<=days; d++){
      const iso = toISO(y,m,d);
      const today = (()=>{ const t=new Date(); return t.getFullYear()===y && t.getMonth()===m && t.getDate()===d; })();
      monthEl.insertAdjacentHTML('beforeend', `<div class="day${today?' today':''}${iso===selectedISO?' is-active':''}" data-date="${iso}">${d}</div>`);
    }
    slotsEl.style.display = (view==='slots' && selectedISO) ? '' : (view==='slots' ? 'none' : '');
  }

  async function loadSlots(){
    if (view !== 'slots' || !selectedISO){ slotsEl.innerHTML=''; return; }
    const dur = activeDuration;
    if (isPreview){
      const demo = ['10:00','10:30','11:00','12:30','13:00','15:00','16:30'];
      slotsEl.innerHTML = demo.map(h=>`<button class="slot" data-hh="${h}">${h}</button>`).join('');
      return;
    }
    try{
      const r = await window.api('calendar.free_slots', { date: selectedISO, duration_min: dur });
      const arr = r?.ok && Array.isArray(r.slots) ? r.slots : [];
      slotsEl.innerHTML = arr.length ? arr.map(h=>`<button class="slot" data-hh="${h}">${h}</button>`).join('')
                                     : '<div class="muted-sm">Нет слотов</div>';
    }catch(e){
      console.warn('calendar.free_slots error', e);
      slotsEl.innerHTML = '<div class="muted-sm">Ошибка загрузки</div>';
    }
  }

  btnPrev.addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); renderMonth(); loadSlots(); });
  btnNext.addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); renderMonth(); loadSlots(); });

  root.addEventListener('click', async (e)=>{
    const day = e.target.closest('.day');
    if (day && !day.classList.contains('disabled')){
      selectedISO = day.dataset.date;
      clearActive('.day.is-active'); day.classList.add('is-active');
      if (view==='slots') await loadSlots();
      return;
    }
    const chip = e.target.closest('.chip');
    if (chip){
      activeDuration = Number(chip.dataset.min);
      clearActive('.chip.is-active'); chip.classList.add('is-active');
      if (view==='slots' && selectedISO) await loadSlots();
      return;
    }
    const slot = e.target.closest('.slot');
    if (slot){ clearActive('.slot.is-active'); slot.classList.add('is-active'); return; }
    if (e.target.closest('.cal-hold')){
      const hh = root.querySelector('.slot.is-active')?.dataset.hh; if (!hh) return;
      if (isPreview){ console.info('[preview] hold', selectedISO, hh, activeDuration); return; }
      await window.api('calendar.hold', { date: selectedISO, time: hh, duration_min: activeDuration });
      await loadSlots(); return;
    }
    if (e.target.closest('.cal-book')){
      const hh = root.querySelector('.slot.is-active')?.dataset.hh; if (!hh) return;
      if (isPreview){ console.info('[preview] book', selectedISO, hh, activeDuration); return; }
      const r = await window.api('calendar.book', { date: selectedISO, time: hh, duration_min: activeDuration, contact: (contactEl.value||''), format: 'tg_call' });
      if (r?.ok) await loadSlots(); else alert(r?.error==='slot_full'?'Слот занят':'Ошибка');
      return;
    }
  });

  renderDurations();
  renderMonth();
  if (view==='slots'){
    const t = new Date(); selectedISO = toISO(t.getFullYear(), t.getMonth(), t.getDate());
    const el = root.querySelector(`.day[data-date="${selectedISO}"]`);
    if (el){ clearActive('.day.is-active'); el.classList.add('is-active'); }
    await loadSlots();
  }
}
