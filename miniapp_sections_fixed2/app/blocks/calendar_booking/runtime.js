export async function mount(root, props, ctx){
  const $ = sel => root.querySelector(sel);
  const dateEl   = $('.cal-date');
  const durEl    = $('.cal-dur');
  const slotsEl  = $('.cal-slots');
  const contactEl= $('.cal-contact');   // может не быть в "слотах"
  const btnHold  = $('.cal-hold');
  const btnBook  = $('.cal-book');

  try{ if (props.duration_min) durEl.value = String(props.duration_min); }catch(_){}
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);

  // helper: безопасный вызов api c фолбэком для превью
  async function callApi(method, payload){
    if (typeof window.api !== 'function') return { ok:false, preview:true };
    try { return await window.api(method, payload); }
    catch(e){ console.warn('calendar api error', e); return { ok:false }; }
  }

  function demoSlots(){
    // демо-набор для конструктора, чтобы было видно UI
    const arr = ['10:00','10:30','11:00','12:30','13:00','15:00','16:30'];
    return arr.map(h=>`<button type="button" class="slot" data-hh="${h}">${h}</button>`).join('');
  }

  let picked = null;

  async function loadSlots(){
    slotsEl.textContent = 'Загрузка...';
    const payload = { date: dateEl.value, duration_min: Number(durEl.value||30) };
    const r = await callApi('calendar.free_slots', payload);

    if (r.preview === true) {
      // режим конструктора — рисуем демо-слоты
      slotsEl.innerHTML = demoSlots();
      picked = null;
      return;
    }

    const slots = (r && r.ok && Array.isArray(r.slots)) ? r.slots : [];
    slotsEl.innerHTML = slots.length
      ? slots.map(h=>`<button type="button" class="slot" data-hh="${h}">${h}</button>`).join('')
      : '<div class="muted-sm">Нет слотов</div>';
    picked = null;
  }

  // выбор слота
  slotsEl.addEventListener('click', e=>{
    const b = e.target.closest('.slot'); if(!b) return;
    slotsEl.querySelectorAll('.slot.selected').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    picked = b.getAttribute('data-hh');
  });

  // hold/book (в превью просто игнорируем)
  btnHold?.addEventListener('click', async ()=>{
    if (!picked) return;
    const r = await callApi('calendar.hold', {
      date: dateEl.value, time: picked, duration_min: Number(durEl.value||30)
    });
    if (!r || !r.ok){ alert('Слот занят или превью-режим'); }
    await loadSlots();
  });

  btnBook?.addEventListener('click', async ()=>{
    if (!picked) return;
    const r = await callApi('calendar.book', {
      date: dateEl.value,
      time: picked,
      duration_min: Number(durEl.value||30),
      contact: (contactEl && contactEl.value) || '',
      format: 'tg_call'
    });
    if (r && r.ok){ alert('Бронь подтверждена'); picked = null; await loadSlots(); }
    else { alert('Превью-режим или ошибка'); }
  });

  dateEl.addEventListener('change', loadSlots);
  durEl.addEventListener('change', loadSlots);
  await loadSlots();
  return ()=>{};
}
