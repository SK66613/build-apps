
// Demo calendar/slots for constructor preview (no backend)
(function(){
  const prevInit = window.initBlocks;
  window.initBlocks = function(root, blocks, route){
    if (typeof prevInit === 'function') prevInit(root, blocks, route);

    const calWrap = root.querySelector('#cal');
    const slotsBox = root.querySelector('#slots');
    const confirmBtn = root.querySelector('#confirmConsult');
    const contactEl = root.querySelector('#contact');
    if(!calWrap) return;

    let selDay = null;
    let selTime = null;

    function buildCalendar(){
      // если сетка уже есть (например, от блока bookingCalendar.init) — не трогаем
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

    function initSlots(){
      if (!slotsBox) return;
      slotsBox.querySelectorAll('.booking-slot').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          selTime = btn.textContent.trim();
          slotsBox.querySelectorAll('.booking-slot').forEach(b=>b.classList.remove('booking-slot--active'));
          btn.classList.add('booking-slot--active');
        });
      });
    }

    if (confirmBtn) confirmBtn.addEventListener('click', ()=>{
      const contact = contactEl ? contactEl.value.trim() : '';
      if(!selDay || !selTime){
        alert('Выберите дату и время');
        return;
      }
      if(!contact){
        alert('Укажите контакт для связи');
        return;
      }
      alert('Заявка: ' + selDay + ' число, ' + selTime + ', контакт: ' + contact);
    });

    buildCalendar();
    initSlots();
  };
})();
