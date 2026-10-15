/* ============================================================
   /science — the behaviour for the generated page
   ------------------------------------------------------------
   Nothing here knows a figure: every number, name and line is
   in the markup the generator wrote, or in the JSON it embedded
   for the category selector to rebuild from.

   One orchestrated motion per section, started once when the
   section arrives. Every end state is the resting state, so a
   reader with reduced motion, or a capture with animation off,
   gets the finished page rather than an empty one.
   ============================================================ */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---- one motion per section ------------------------------------- */
  (function sections() {
    var secs = $$('.sci-sec');
    if (!secs.length) return;
    if (reduce || !window.IntersectionObserver) {
      secs.forEach(function (s) { s.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  })();

  /* ---- the figures count up, once, and again on a category change --- */
  function countUp(el) {
    var text = el.getAttribute('data-count-text') || el.getAttribute('data-count-to') || '';
    /* Count to the number on the page, not the one behind it: where the
       figure is published as a floor, "200+" counts to 200 and stops,
       rather than running to 223 and snapping back. */
    var to = parseFloat(String(text).replace(/[^0-9.]/g, ''));
    if (!isFinite(to) || reduce) { el.textContent = text; return; }
    var suffix = /\+$/.test(text) ? '+' : '';
    var start = null, dur = 900;
    function frame(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString('en-GB') + suffix;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = text;
    }
    el.textContent = '0' + suffix;
    requestAnimationFrame(frame);
  }
  (function figures() {
    var strip = $('[data-figs]');
    if (!strip) return;
    var run = function () { $$('[data-count-to]', strip).forEach(countUp); };
    if (reduce || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      run();
    }, { threshold: 0.4 });
    io.observe(strip);
    window.sciRecount = run;
  })();

  /* ---- the category selector ---------------------------------------
     Only one vertical is live, so this guards rather than switches. The
     data for every vertical is in the page, so turning one on in the
     export is all it takes. */
  (function categories() {
    var btns = $$('.sci-seg-btn');
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled || b.getAttribute('aria-selected') === 'true') return;
        btns.forEach(function (o) { o.setAttribute('aria-selected', String(o === b)); });
        if (window.sciRecount) window.sciRecount();
      });
    });
  })();

  /* ---- the goal grid ------------------------------------------------ */
  (function goals() {
    var wrap = $('[data-goals]'), panel = $('[data-subs]');
    if (!wrap || !panel) return;
    var data = null;
    try { data = JSON.parse($('#sci-data').textContent); } catch (e) { return; }
    var live = Object.keys(data.verticals).filter(function (k) { return data.verticals[k].status === 'live'; })[0];
    var goals = (data.verticals[live].goals || []).map(function (g) {
      return { goal: g.goal, subgoals: g.subgoals.filter(function (s) { return s.trim().toLowerCase() !== 'none of the above.'; }) };
    });
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.sci-goal');
      if (!btn) return;
      var g = goals.filter(function (x) { return x.goal === btn.getAttribute('data-goal'); })[0];
      if (!g) return;
      $$('.sci-goal', wrap).forEach(function (o) { o.setAttribute('aria-expanded', String(o === btn)); });
      panel.innerHTML = '<div class="sci-subs-t"></div><div class="sci-subs-list"></div>';
      $('.sci-subs-t', panel).textContent = g.goal;
      var list = $('.sci-subs-list', panel);
      g.subgoals.forEach(function (s) {
        var el = document.createElement('span');
        el.textContent = s;
        list.appendChild(el);
      });
    });
  })();

  /* ---- the run ------------------------------------------------------
     Auto-advances once it is in view, pauses on hover, tap or focus, and
     stops for good the moment a tab is chosen: past that point the
     reader is driving. */
  (function run() {
    var stage = $('[data-run]');
    if (!stage) return;
    var tabs = $$('.sci-tab', stage);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var funnel = $$('.sci-fstep', stage);
    var timer = null, driving = false, at = 0;
    var narrow = window.matchMedia('(max-width:760px)');

    function show(i, focus) {
      at = i;
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j].hidden = !on;
      });
      funnel.forEach(function (f) {
        f.classList.toggle('is-on', parseInt(f.getAttribute('data-at'), 10) <= i);
      });
      if (focus && tabs[i]) tabs[i].focus();
      if (tabs[i]) tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      if (timer || driving || reduce || narrow.matches) return;
      timer = setInterval(function () { show((at + 1) % tabs.length); }, 4000);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { driving = true; stop(); show(i); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault(); driving = true; stop(); show(n, true);
      });
    });
    stage.addEventListener('mouseenter', stop);
    stage.addEventListener('mouseleave', play);
    stage.addEventListener('focusin', stop);
    stage.addEventListener('touchstart', function () { driving = true; stop(); }, { passive: true });
    show(0);
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) play(); else stop(); });
      }, { threshold: 0.3 });
      io.observe(stage);
    }
  })();

  /* ---- signals: the line under a group follows the chip you are on --- */
  (function signals() {
    $$('.sci-siggroup').forEach(function (group) {
      var why = $('[data-why]', group);
      var chips = $$('.sci-sig', group);
      if (!why || !chips.length) return;
      var base = why.textContent;
      function set(chip) {
        chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        why.textContent = chip ? chip.getAttribute('data-changes') : base;
      }
      chips.forEach(function (c) {
        c.addEventListener('mouseenter', function () { set(c); });
        c.addEventListener('focus', function () { set(c); });
        c.addEventListener('click', function () { set(c); });
      });
      group.addEventListener('mouseleave', function () { set(null); });
    });
  })();

  /* ---- the safety layers -------------------------------------------- */
  (function layers() {
    $$('.sci-layer-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        var body = document.getElementById(btn.getAttribute('aria-controls'));
        if (body) body.hidden = open;
      });
    });
  })();

  /* ---- the market switcher ------------------------------------------
     Only the reference targets move. The upper limits and the band a
     nutrient has to fall below are one set worldwide, and the page says
     so rather than animating a difference that is not there. */
  (function markets() {
    var sel = $('.sci-csel');
    if (!sel) return;
    var data = null;
    try { data = JSON.parse($('#sci-data').textContent); } catch (e) { return; }
    var live = Object.keys(data.verticals).filter(function (k) { return data.verticals[k].status === 'live'; })[0];
    var sets = data.verticals[live].countries.reference_sets;
    var auth = $('[data-auth]'), ladders = $('[data-ladders]');

    function paint(i) {
      var s = sets[i];
      if (auth) {
        $('.sci-auth-n', auth).textContent = s.authority.name;
        $('.sci-auth-r', auth).textContent = s.authority.reference;
        $('.sci-auth-x', auth).textContent = s.food_composition + (s.fortification_overlay ? ' ' + s.fortification_overlay : '');
      }
      s.nutrients.forEach(function (n) {
        var card = ladders && ladders.querySelector('[data-dose="' + (window.CSS && CSS.escape ? CSS.escape(n.nutrient) : n.nutrient) + '"]');
        if (!card) return;
        var ul = n.upper_limit, t = n.target_reference_adult;
        var span = ul || (t ? t * 2 : 1);
        var pos = function (v) { return Math.max(0, Math.min(100, (v / span) * 100)); };
        var target = card.querySelector('.sci-mark.is-target');
        var below = card.querySelector('.sci-mark.is-below');
        if (target && t != null) {
          target.style.left = pos(t) + '%';
          var val = target.querySelector('i');
          if (val) val.textContent = Number(t).toLocaleString('en-GB') + ' ' + (n.target_unit || '');
        }
        if (below && t != null) below.style.left = pos(t * (1 - (n.shortfall_before_recommend || 0))) + '%';
        var foot = card.querySelector('.sci-dose-f');
        if (foot && ul) foot.textContent = 'Upper limit ' + Number(ul).toLocaleString('en-GB') + ' ' +
          (n.upper_limit_unit || n.target_unit || '') + '. Recommended below ' +
          Math.round((1 - (n.shortfall_before_recommend || 0)) * 100) + '% of target.';
      });
    }
    $$('.sci-cbtn', sel).forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        $$('.sci-cbtn', sel).forEach(function (o) { o.setAttribute('aria-pressed', String(o === btn)); });
        paint(i);
      });
    });
  })();
})();
