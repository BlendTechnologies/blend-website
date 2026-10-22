/* ---- Films: the product screens, played --------------------------------
   Moved here from /how-it-works so any page can play a film (films.css says
   how). Each screen is drawn at 2000px and scaled to its window (--k). While
   its figure is the active one (/how-it-works's stage marks it, or the
   observer at the end of this file for a .film on its own), it walks a list
   of phases and loops; the classes it sets are the states films.css
   draws. Before each loop the window fades out, everything snaps back with
   no transitions, and it fades in again, so the reset never plays backwards.
   Under reduced motion it holds its first phase, or the plan's rest. */
(function(){
  var screens = [].slice.call(document.querySelectorAll('.hw-screen'));
  if(!screens.length) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  function fit(sc){ var w = sc.querySelector('.hw-win'); w.style.setProperty('--k', (w.clientWidth / 2000).toFixed(4)); }
  var PLANS = {
    /* a beat each (ms, or one per beat); the count runs 0 to 51 in beat 4,
       as the confirmations arrive, and is 52 once a product is added */
    catalogue: { ms: [1600, 2000, 2600, 2200, 3000, 3000, 1800, 2400, 2800, 2600, 3000, 2200], n: 12, rest: 5, step: function(sc, p){
      var n = sc.querySelector('.kx-n'), go = sc._kx = (sc._kx || 0) + 1;
      if(p !== 4 || still.matches){ n.textContent = p < 4 ? '0' : p < 9 ? '51' : '52'; return; }
      var t0 = performance.now() + 700;
      requestAnimationFrame(function run(t){
        if(sc._kx !== go) return;
        var f = Math.max(0, Math.min(1, (t - t0) / 1000));
        n.textContent = Math.round(51 * (1 - Math.pow(1 - f, 3)));
        if(f < 1) requestAnimationFrame(run);
      });
    } },
    launch: { ms: [1600, 2000, 2200, 2200, 2800, 2800, 2200, 2600, 2200], n: 9, rest: 7, step: function(){} },
    recommend: { ms: [1600, 2000, 2200, 2400, 2600, 3000, 3000, 3200, 2400, 3000, 2800, 2200], n: 12, rest: 1, step: function(){} },
    design: { ms: [1600, 2000, 1800, 2800, 2400, 2600, 2200, 2600, 2400, 2200, 2800, 3000, 1800, 2400, 2600, 1800, 3000, 2200], n: 18, rest: 7, step: function(){} },
    /* the scan's percentage in beat 4, and Apply's count in beat 7 */
    match: { ms: [1600, 1700, 2000, 2200, 2600, 2200, 2200, 2800, 2200, 3000, 2200, 2600, 2800, 2200], n: 14, rest: 9, step: function(sc, p){
      var pc = sc.querySelector('.mx-pc'), bar = sc.querySelector('.mx-bar'), n = sc.querySelector('.mx-n'), go = sc._mx = (sc._mx || 0) + 1;
      function setPc(v){ pc.textContent = v + '%'; bar.style.setProperty('--pc', v); }
      function setN(v){ n.textContent = v; }
      function run(from, to, delay, dur, set){
        var t0 = performance.now() + delay;
        requestAnimationFrame(function f(t){
          if(sc._mx !== go) return;
          var k = Math.max(0, Math.min(1, (t - t0) / dur));
          set(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2))));
          if(k < 1) requestAnimationFrame(f);
        });
      }
      if(p === 4 && !still.matches) run(0, 100, 300, 1900, setPc); else setPc(p < 4 ? 0 : 100);
      if(p === 7 && !still.matches) run(38, 51, 700, 900, setN); else setN(p < 7 ? 38 : 51);
    } },
    /* the panels' numbers count up from 0 when a tile is picked, as the
       product's do (components/ui/count-up.tsx: 600ms, ease-out) */
    analytics: { ms: [1600, 2200, 3200, 2400, 2200, 3000, 2600, 2400, 3000, 3000, 2200], n: 11, rest: 1, step: function(sc, p){
      var go = sc._vx = (sc._vx || 0) + 1;
      function count(el, to, fmt, delay){
        el.textContent = fmt(0);
        var t0 = performance.now() + delay;
        requestAnimationFrame(function f(t){
          if(sc._vx !== go) return;
          var k = Math.max(0, Math.min(1, (t - t0) / 600));
          el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
          if(k < 1) requestAnimationFrame(f);
        });
      }
      var pc = function(v){ return v + '%'; }, n = function(v){ return v.toLocaleString('en-GB'); };
      var a = sc.querySelector('.vx-n1'), b = sc.querySelector('.vx-n2');
      if(p === 2 && !still.matches) count(a, 71, pc, 650); else a.textContent = '71%';
      if(p === 5 && !still.matches) count(b, 1102, n, 1350); else b.textContent = '1,102';
    } }
  };
  function phase(sc, p){
    for(var i = 1; i < 18; i++) sc.classList.toggle('is-p' + i, i <= p);
    PLANS[sc.dataset.demo].step(sc, p);
  }
  function reset(sc){
    sc.classList.add('no-tr', 'is-pre');
    phase(sc, 0);
    sc.offsetWidth;   /* commit the reset before transitions come back */
    sc.classList.remove('no-tr');
  }
  screens.forEach(function(sc){
    var fig = sc.closest('.hw-shot, .film'), plan = PLANS[sc.dataset.demo], timer = null, p = 0;
    if(!plan) return;
    fit(sc);
    if('ResizeObserver' in window) new ResizeObserver(function(){ fit(sc); }).observe(sc.querySelector('.hw-win'));
    function begin(){
      reset(sc); p = 0;
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ sc.classList.remove('is-pre'); }); });
    }
    /* how long beat i holds; the first after a loop gives 400ms to the fade */
    function hold(i){ return plan.ms.length ? plan.ms[i] : plan.ms; }
    function tick(){
      p += 1;
      if(p < plan.n){ phase(sc, p); timer = setTimeout(tick, hold(p)); return; }
      sc.classList.add('is-out');
      timer = setTimeout(function(){
        begin(); sc.classList.remove('is-out');
        timer = setTimeout(tick, hold(0) - 400);
      }, 400);
    }
    function play(on){
      clearTimeout(timer); timer = null;
      sc.classList.remove('is-out');
      begin();
      if(on && still.matches && plan.rest) phase(sc, plan.rest);
      if(on && !still.matches) timer = setTimeout(tick, hold(0));
    }
    reset(sc); sc.classList.remove('is-pre');
    var was = fig.classList.contains('is-active');
    new MutationObserver(function(){
      var now = fig.classList.contains('is-active');
      if (now === was) return;
      was = now;
      if (now) { play(true); return; }
      /* being wiped over: hold the frame it is on, rewind once it is covered */
      clearTimeout(timer); timer = null;
      timer = setTimeout(function(){ if (!was) play(false); }, 800);
    }).observe(fig, { attributes: true, attributeFilter: ['class'] });
    if(fig.classList.contains('is-active')) play(true);
  });
})();

/* A film standing on its own (a .film, not a frame in /how-it-works's
   pinned stage) plays while half of it is on screen. The loop above
   listens for .is-active, so this only says when. */
(function(){
  var films = [].slice.call(document.querySelectorAll('.film'));
  if(!films.length) return;
  if(!('IntersectionObserver' in window)){ films.forEach(function(f){ f.classList.add('is-active'); }); return; }
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ e.target.classList.toggle('is-active', e.intersectionRatio >= .5); });
  }, { threshold: [0, .5, 1] });
  films.forEach(function(f){ io.observe(f); });
})();
