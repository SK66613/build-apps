/* Lightweight game registry used by blocks in templates.js */
(function(){
  if (window.GAMES) return;
  window.GAMES = Object.create(null);

  // mountGame(key, host, {ctx, props})
  window.mountGame = function(key, host, opts){
    try{
      const g = window.GAMES && window.GAMES[key];
      if (!g || typeof g.mount !== 'function'){
        console.warn('[games] missing game:', key);
        return null;
      }
      return g.mount(host, opts||{}) || null;
    }catch(e){
      console.error('[games] mount error', key, e);
      return null;
    }
  };
})();
