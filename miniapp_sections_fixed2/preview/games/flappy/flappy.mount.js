/* Flappy (simple) - mounts into provided host element.
   Expects window.api(method, payload) to exist (defined in index.html).
*/
(function(){
  const KEY = 'flappy';

  function loadImg(src){
    return new Promise((res)=>{
      const img = new Image();
      img.onload = ()=>res(img);
      img.onerror = ()=>res(null);
      img.src = src;
    });
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  window.GAMES = window.GAMES || Object.create(null);

  window.GAMES[KEY] = {
    mount: async function(host, opts){
      const ctx = (opts && opts.ctx) || {};
      const props = (opts && opts.props) || {};
      const base = (ctx && ctx.assetsBase) ? ctx.assetsBase.replace(/\/$/,'') : '.';

      host.innerHTML = `
        <div class="flp-wrap" style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <canvas class="flp-c" style="width:100%;height:100%;display:block;border-radius:18px;"></canvas>
          <div class="flp-hud" style="position:absolute;left:12px;top:10px;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#fff;opacity:.92;text-shadow:0 1px 3px rgba(0,0,0,.45)">
            <div>Score: <span class="flp-score">0</span></div>
            <div style="opacity:.8">Best: <span class="flp-best">0</span> • Plays: <span class="flp-plays">0</span></div>
          </div>
          <button class="flp-btn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.24);background:rgba(0,0,0,.45);color:#fff;font:700 13px system-ui;cursor:pointer;">
            Start
          </button>
        </div>
      `;

      const canvas = host.querySelector('.flp-c');
      const btn = host.querySelector('.flp-btn');
      const scoreEl = host.querySelector('.flp-score');
      const bestEl = host.querySelector('.flp-best');
      const playsEl = host.querySelector('.flp-plays');

      // HiDPI resize
      const ctx2d = canvas.getContext('2d');
      function resize(){
        const r = canvas.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
        canvas.width = Math.floor(r.width * dpr);
        canvas.height = Math.floor(r.height * dpr);
        ctx2d.setTransform(dpr,0,0,dpr,0,0);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      // Assets (optional)
      const birdImg = await loadImg(`${base}/games/flappy/assets/bumblebee.png`);
      const pipeTopImg = await loadImg(`${base}/games/flappy/assets/pipe_top.png`);
      const pipeBottomImg = await loadImg(`${base}/games/flappy/assets/pipe_bottom.png`);
      const coinImg = await loadImg(`${base}/games/flappy/assets/coin.png`);

      // Game state
      let running = false;
      let raf = 0;
      let t0 = 0;
      let last = 0;

      let score = 0;
      let best = 0;
      let plays = 0;

      // physics
      let bird = { x: 0, y: 0, vy: 0, r: 14 };
      let pipes = [];
      let coins = [];

      function reset(){
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        bird.x = w * 0.30;
        bird.y = h * 0.45;
        bird.vy = 0;
        pipes = [];
        coins = [];
        score = 0;
        scoreEl.textContent = String(score);
      }

      function spawn(){
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const gap = clamp(h * 0.26, 110, 190);
        const pipeW = 60;
        const margin = 40;
        const topH = Math.floor(margin + Math.random() * (h - gap - margin*2));
        const x = w + 10;
        pipes.push({ x, w: pipeW, topH, gap });
        // coin between pipes sometimes
        if (Math.random() < 0.65){
          coins.push({ x: x + pipeW + 18, y: topH + gap/2, r: 10, taken:false });
        }
      }

      function flap(){
        if (!running){
          start();
          return;
        }
        bird.vy = -320;
      }

      // input
      const onKey = (e)=>{
        if (e.code === 'Space' || e.code === 'ArrowUp'){
          e.preventDefault();
          flap();
        }
      };
      window.addEventListener('keydown', onKey, {passive:false});
      host.addEventListener('pointerdown', flap);

      async function loadStatsFromState(){
        try{
          if (typeof window.api !== 'function') return;
          const r = await window.api('state', {});
          if (r && r.ok){
            const st = r.state || {};
            // support multiple shapes
            const b = Number((st.game_today_best ?? st.game_best_today ?? st.best_score ?? 0) || 0);
            const p = Number((st.game_today_plays ?? st.game_plays_today ?? st.plays ?? 0) || 0);
            best = b; plays = p;
            bestEl.textContent = String(best);
            playsEl.textContent = String(plays);
          }
        }catch(_){}
      }

      async function submit(scoreFinal, durMs){
        try{
          if (typeof window.api !== 'function') return;
          const r = await window.api('game_submit', {
            game_id: 'flappy',
            mode: 'daily',
            score: scoreFinal,
            duration_ms: durMs|0
          });
          if (r && r.ok){
            // refresh stats
            const st = r.fresh_state || r.state || null;
            if (st){
              const b = Number((st.game_today_best ?? st.game_best_today ?? st.best_score ?? r.best_score ?? 0) || 0);
              const p = Number((st.game_today_plays ?? st.game_plays_today ?? r.plays ?? 0) || 0);
              best = b; plays = p;
              bestEl.textContent = String(best);
              playsEl.textContent = String(plays);
            }else{
              if (typeof r.best_score !== 'undefined') best = Number(r.best_score)||best;
              if (typeof r.plays !== 'undefined') plays = Number(r.plays)||plays;
              bestEl.textContent = String(best);
              playsEl.textContent = String(plays);
            }
          }
        }catch(e){
          console.warn('[flappy] submit failed', e);
        }
      }

      function draw(){
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        // bg
        ctx2d.clearRect(0,0,w,h);
        ctx2d.fillStyle = 'rgba(20,24,32,1)';
        ctx2d.fillRect(0,0,w,h);

        // subtle grid
        ctx2d.globalAlpha = 0.08;
        ctx2d.strokeStyle = '#fff';
        for(let x=0;x<w;x+=40){ ctx2d.beginPath(); ctx2d.moveTo(x,0); ctx2d.lineTo(x,h); ctx2d.stroke(); }
        for(let y=0;y<h;y+=40){ ctx2d.beginPath(); ctx2d.moveTo(0,y); ctx2d.lineTo(w,y); ctx2d.stroke(); }
        ctx2d.globalAlpha = 1;

        // pipes
        ctx2d.fillStyle = 'rgba(255,255,255,.16)';
        for(const p of pipes){
          const topH = p.topH;
          const botY = topH + p.gap;
          // draw top
          if (pipeTopImg){
            ctx2d.drawImage(pipeTopImg, p.x, topH - 260, p.w, 260);
          } else {
            ctx2d.fillRect(p.x, 0, p.w, topH);
          }
          // draw bottom
          if (pipeBottomImg){
            ctx2d.drawImage(pipeBottomImg, p.x, botY, p.w, 260);
          } else {
            ctx2d.fillRect(p.x, botY, p.w, h - botY);
          }
        }

        // coins
        for(const c of coins){
          if (c.taken) continue;
          if (coinImg){
            ctx2d.drawImage(coinImg, c.x - 12, c.y - 12, 24, 24);
          } else {
            ctx2d.beginPath(); ctx2d.arc(c.x,c.y,c.r,0,Math.PI*2); ctx2d.fillStyle='rgba(255,215,0,.9)'; ctx2d.fill();
          }
        }

        // bird
        if (birdImg){
          ctx2d.drawImage(birdImg, bird.x - 18, bird.y - 18, 36, 36);
        } else {
          ctx2d.beginPath(); ctx2d.arc(bird.x,bird.y,bird.r,0,Math.PI*2); ctx2d.fillStyle='rgba(120,200,255,.95)'; ctx2d.fill();
        }
      }

      function collide(){
        const h = canvas.clientHeight;
        if (bird.y - bird.r < 0 || bird.y + bird.r > h) return true;
        for(const p of pipes){
          const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + p.w;
          if (!inX) continue;
          const topH = p.topH;
          const botY = topH + p.gap;
          if (bird.y - bird.r < topH || bird.y + bird.r > botY) return true;
        }
        return false;
      }

      function step(ts){
        if (!running) return;
        if (!t0) t0 = ts;
        const dt = Math.min(0.032, (ts - last)/1000 || 0.016);
        last = ts;

        const w = canvas.clientWidth;

        // spawn pipes
        if (!pipes.length || (w - pipes[pipes.length-1].x) > 180){
          spawn();
        }

        // move
        const speed = 170;
        for(const p of pipes) p.x -= speed*dt;
        for(const c of coins) c.x -= speed*dt;
        pipes = pipes.filter(p=> p.x + p.w > -20);
        coins = coins.filter(c=> c.x > -40 && !c.taken);

        // bird
        bird.vy += 860*dt;
        bird.y += bird.vy*dt;

        // scoring (pass pipes)
        for(const p of pipes){
          if (!p._scored && p.x + p.w < bird.x){
            p._scored = true;
            score += 1;
            scoreEl.textContent = String(score);
          }
        }
        // coin pickup
        for(const c of coins){
          if (c.taken) continue;
          const dx = c.x - bird.x, dy = c.y - bird.y;
          if (dx*dx + dy*dy < (c.r + bird.r)*(c.r + bird.r)){
            c.taken = true;
            score += 1;
            scoreEl.textContent = String(score);
          }
        }

        draw();

        if (collide()){
          stop();
          return;
        }

        raf = requestAnimationFrame(step);
      }

      function start(){
        running = true;
        btn.style.display = 'none';
        t0 = 0; last = 0;
        reset();
        raf = requestAnimationFrame(step);
      }

      async function stop(){
        running = false;
        cancelAnimationFrame(raf);
        btn.textContent = 'Restart';
        btn.style.display = 'block';
        // submit best
        const durMs = Math.max(0, (performance.now() - (t0||performance.now()))|0);
        await submit(score, durMs);
      }

      btn.addEventListener('click', ()=>{ if(!running) start(); });

      // initial stats
      loadStatsFromState();

      // cleanup
      return function cleanup(){
        cancelAnimationFrame(raf);
        try{ ro.disconnect(); }catch(_){}
        window.removeEventListener('keydown', onKey);
        host.removeEventListener('pointerdown', flap);
      };
    }
  };
})();
