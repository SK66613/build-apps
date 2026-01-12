export async function mount(root, props, ctx){
  const $ = s => root.querySelector(s);

  const dateEl   = $('.cal-date');
  const durEl    = $('.cal-dur');
  const slotsEl  = $('.cal-slots');
  const monthEl  = $('.cal-month');
  const contactEl= $('.cal-contact');
  const btnHold  = $('.cal-hold');
  const btnBook  = $('.cal-book');

  const isPreview = (typeof window.api !== 'function');

  // --- durations (из props.allowedDurations) ---
  const allowed = Array.isArray(props.allowedDurations) && props.allowedDurations.length
    ? props.allowedDurations.map(n=>Number(n)).filter(Boolean)
    : [60];

  const defDur = Number(props.defaultDuration || allowed[0] || 60);
  durEl.innerHTML = allowed.map(v => `<option value="${v}"${v===defDur?' selected':''}>${v} мин</option>`).join('');
  if (allowed.length === 1) durEl.parentElement.style.display = 'none';

  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);

  function slotBtn(h){ return `<button type="button" class="slot" data-hh="${h}">${h}</button>`; }

  async function loadSlots(){
    const dur = Number(durEl.value || defDur);

    // превью — демо без сетевых вызовов
    if (isPreview){
      const demo = ['10:00','10:30','11:00','12:30','13:00','15:00','16:30'];
      slotsEl.innerHTML = demo.map(slotBtn).join('');
      monthEl.hidden = props.view !== 'month';
      if (props.view === 'month') renderMonth();
      return;
    }

    const r = await window.api('calendar.free_slots', { date: dateEl.value, duration_min: dur });
    const arr = r?.ok && Array.isArray(r.slots) ? r.slots : [];
    slotsEl.innerHTML = arr.length ? arr.map(slotBtn).join('') : '<div class="muted-sm">Нет слотов</div>';
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
    const b = e.target.closest('.slot');
    if (b){
      root.querySelectorAll('.slot.selected').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
    }

    const day = e.target.closest('.day');
    if (day && !day.classList.contains('disabled')){
      dateEl.value = day.dataset.date;
      if (props.view !== 'month') await loadSlots();
    }

    if (e.target.closest('.cal-hold') && !isPreview){
      const hh = root.querySelector('.slot.selected')?.dataset.hh; if (!hh) return;
      await window.api('calendar.hold', { date: dateEl.value, time: hh, duration_min: Number(durEl.value||defDur) });
      await loadSlots();
    }

    if (e.target.closest('.cal-book') && !isPreview){
      const hh = root.querySelector('.slot.selected')?.dataset.hh; if (!hh) return;
      const r = await window.api('calendar.book', {
        date: dateEl.value,
        time: hh,
        duration_min: Number(durEl.value||defDur),
        contact: (contactEl && contactEl.value) || '',
        format: 'tg_call'
      });
      if (r?.ok) await loadSlots();
      else alert(r?.error === 'slot_full' ? 'Слот занят' : 'Ошибка');
    }
  });

  dateEl.addEventListener('change', () => props.view === 'month' ? renderMonth() : loadSlots());
  durEl.addEventListener('change', loadSlots);

  // стартовый рендер
  if (props.view === 'month') renderMonth(); else await loadSlots();
}
