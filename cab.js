(async function(){
  // 1) проверка сессии
  const me = await fetch('/api/auth/me', {credentials:'include'}).then(r=>r.json()).catch(()=>null);
  if (!me || !me.ok) {
    location.replace('/auth');
    return;
  }

  // 2) загрузка проектов
  const apps = await fetch('/api/my/apps', {credentials:'include'}).then(r=>r.json()).catch(()=>({apps:[]}));

  // 3) рендер кабинета (твоя функция)
  renderCabinet(apps);
})();
