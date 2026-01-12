export async function mount(root, props, ctx){
  const $ = s => root.querySelector(s);

  // элементы
  const titleEl   = $('[data-title]');
  const dateEl    = $('.cal-date');
  const durEl     = $('.cal-dur');
  const slotsEl   = $('.cal-slots');
  const monthEl   = $('.cal-month');
  const contactEl = $('.cal-contact');
  const btnHold   = $('.cal-hold');
  const btnBook   = $('.cal-book');

  // читаем пропсы, подстраховываем имена
  const view            = (props.view || 'slots');
  const accent          = props.accent || props.accent_color || 'var(--accent)';
  const chipBg          = props.chipBg || 'var(--surface2)';
  const chipText        = props.chipText || 'var(--text)';
  const radius          = Number(props.radius ?? 10);
  const gap             = Number(props.gap ?? 8);
  const showHold        = props.show_hold !== false; // по умолчанию показывать
  const showContact     = props.show_contact !== false;
  const allowed         = (Array.isArray(props.allowed_minutes) ? props.allowed_minutes
                           : Array.isArray(props.allowedDurations) ? props.allowedDurations
                           : [30,60,90])
                          .map(n=>Number(n)).filter(Boolean);
  const defaultDuration = Number(props.defaultDuration || (allowed[0] || 60));

  // заголовок
  titleEl.textContent = props.title || 'Записаться на консультацию';

  // применяем стили через CSS-переменные (без шаблонов)
  root.style.setProperty('--acc', accent);
  root.style.setProperty('--chipBg', chipBg);
  root.style.setProperty('--chipText', chipText);
  root.style.setProperty('--radius', `${radius}px`);
  root.style.setProperty('--gap', `${gap}px`);

  // видимость элементов
  contactEl.style.display = showContact ? '' : 'none';
  btnHold.style.display   = showHold ? '' : 'none';

  // длительности -> селект
  durEl.innerHTML = allowed.map(v => `<option value="${v}" ${v===defaultDuration?'selected':''}>${v} мин</option>`).join('');
  if (allowed.length === 1) durEl.closest('.cal-toolbar')?.style.setProperty('visibility','hidden');

  // дата по умолчанию
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);

  const isPreview = (typeof window.api !== 'function');

  function slotBtn(hhmm){
    return `<button type="button" class="slot" data-hh="${hhmm}">${hhmm}</button>`;
  }

  async function loadSlots(){
    const dur = Number(durEl.value || defaultDuration);

    if (isPreview){
      const demo = ['10:00','10:30','11:00','12:30','13:00','15:00','16:30'];
      slotsEl.innerHTML = demo.map(slotBtn).join('');
      monthEl.hidden = (view !== 'month');
      if (view === 'month') renderMonth();
      return;
    }

    try{
      const r = await window.api('calendar.free_slots',{ date: dateEl.value, duration_min: dur });
      const arr = r?.ok && Array.isArray(r.slots) ? r.slots : [];
      slotsEl.innerHTML = arr.length ? arr.map(slotBtn).join('') : '<div class="muted-sm">Нет слотов</div>';
    }catch(e){
      console.warn('calendar.free_slots error', e);
      slotsEl.innerHTML = '<div class="muted-sm">Ошибка загрузки</div>';
    }
  }

  function renderMonth(){
    const d = new Date(dateEl.value + 'T00:00:00'); d.setDate(1);
    const y = d.getFullYear(), m = d.getMonth();
    const days = new Date(y, m+1, 0).getDate();
    const start = (d.getDay()+6)%7; // Mon=0
    monthEl.innerHTML=''; monthEl.hidden=false; slotsEl.hidden=true;
    for (let i=0;i<start;i++) monthEl.insertAdjacentHTML('beforeend','<div class="day disabled"></div>');
    for (let day=1; day<=days; day++){
      const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      monthEl.insertAdjacentHTML('beforeend', `<div class="day" data-date="${iso}">${day}</div>`);
    }
  }

  // события
  root.addEventListener('click', async (e)=>{
    const slot = e.target.closest('.slot');
    if (slot){
      root.querySelectorAll('.slot.selected').forEach(x=>x.classList.remove('selected'));
      slot.classList.add('selected');
    }
    const day = e.target.closest('.day');
    if (day && !day.classList.contains('disabled')){
      dateEl.value = day.dataset.date;
      if (view !== 'month') await loadSlots();
    }
    if (e.target.closest('.cal-hold')){
      if (isPreview) { console.info('[preview] hold'); return; }
      const hh = root.querySelector('.slot.selected')?.dataset.hh; if (!hh) return;
      await window.api('calendar.hold',{ date: dateEl.value, time: hh, duration_min: Number(durEl.value || defaultDuration) });
      await loadSlots();
    }
    if (e.target.closest('.cal-book')){
      if (isPreview) { console.info('[preview] book'); return; }
      const hh = root.querySelector('.slot.selected')?.dataset.hh; if (!hh) return;
      const r = await window.api('calendar.book',{
        date: dateEl.value,
        time: hh,
        duration_min: Number(durEl.value || defaultDuration),
        contact: contactEl.value || '',
        format: 'tg_call'
      });
      if (r?.ok) await loadSlots(); else alert(r?.error==='slot_full'?'Слот занят':'Ошибка');
    }
  });

  dateEl.addEventListener('change', () => view==='month' ? renderMonth() : loadSlots());
  durEl.addEventListener('change', loadSlots);

  // первый рендер
  if (view === 'month') renderMonth(); else await loadSlots();
}
