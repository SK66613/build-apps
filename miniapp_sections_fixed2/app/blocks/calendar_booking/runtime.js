export async function mount(root, props, ctx){
  const $ = sel => root.querySelector(sel);
  const dateEl   = $('.cal-date');
  const durEl    = $('.cal-dur');
  const slotsEl  = $('.cal-slots');
  const contactEl= $('.cal-contact');
  const btnHold  = $('.cal-hold');
  const btnBook  = $('.cal-book');

  try{ if (props.duration_min) durEl.value = String(props.duration_min); }catch(_){}
  if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0,10);

  let picked = null;

  async function loadSlots(){
    slotsEl.textContent = 'Загрузка...';
    const payload = {
      date: dateEl.value,
      duration_min: Number(durEl.value||30)
    };
    const r = await (window.api ? window.api('calendar.free_slots', payload) : Promise.resolve({ ok:false }));
    const slots = (r && r.ok && Array.isArray(r.slots)) ? r.slots : [];
    slotsEl.innerHTML = slots.map(h=>`<button type="button" class="slot" data-hh="${h}">${h}</button>`).join('') || '<div class="muted-sm">Нет слотов</div>';
    picked = null;
  }

  slotsEl.addEventListener('click', e=>{
    const b = e.target.closest('.slot'); if(!b) return;
    slotsEl.querySelectorAll('.slot.selected').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    picked = b.getAttribute('data-hh');
  });

  btnHold.addEventListener('click', async ()=>{
    if (!picked) return;
    const payload = {
      date: dateEl.value,
      time: picked,
      duration_min: Number(durEl.value||30)
    };
    const r = await (window.api ? window.api('calendar.hold', payload) : Promise.resolve({ ok:false }));
    if (!r || !r.ok) { alert('Слот занят, выберите другой'); }
    await loadSlots();
  });

  btnBook.addEventListener('click', async ()=>{
    if (!picked) return;
    const payload = {
      date: dateEl.value,
      time: picked,
      duration_min: Number(durEl.value||30),
      contact: (contactEl && contactEl.value) || '',
      format: 'tg_call'
    };
    const r = await (window.api ? window.api('calendar.book', payload) : Promise.resolve({ ok:false }));
    if (r && r.ok){ alert('Бронь подтверждена'); picked = null; await loadSlots(); }
    else { alert('Не удалось подтвердить бронь'); }
  });

  dateEl.addEventListener('change', loadSlots);
  durEl.addEventListener('change', loadSlots);
  await loadSlots();

  return ()=>{};
}
