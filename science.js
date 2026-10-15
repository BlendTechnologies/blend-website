/* ============================================================
   /science — the behaviour for the generated page
   ------------------------------------------------------------
   Nothing here knows a figure: every number, name and line is in
   the markup the generator wrote, or in the JSON it embedded for
   the market switcher to repaint from.
   ============================================================ */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* The start state belongs to the script. Hidden by default, a section
     the observer never reaches stays invisible — and a full-page capture,
     which resizes rather than scrolls, reaches none of them. */
  document.documentElement.classList.add('sci-js');

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
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    secs.forEach(function (s) { io.observe(s); });
    setTimeout(function () {
      secs.forEach(function (s) { s.classList.add('is-in'); });
      io.disconnect();
    }, 2000);
  })();

  /* ---- the run ------------------------------------------------------
     The reader drives: tabs and arrow keys, nothing on a timer. */
  (function run() {
    var stage = $('[data-run]');
    if (!stage) return;
    var tabs = $$('.sci-tab', stage);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var funnel = $$('.sci-fstep', stage);

    /* `moved` guards the one that cost a bug: scrolling the strip on the
       first paint scrolled the page with it, so arriving at /science from
       the nav landed 1,600px down, on the run. Nothing scrolls until the
       reader has chosen something. */
    function show(i, moved, focus) {
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
      if (moved && tabs[i] && tabs[i].scrollIntoView) {
        tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i, true); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        show(n, true, true);
      });
    });
    show(0, false);
  })();

  /* ---- signals: the line under a group follows the chip you are on --- */
  (function signals() {
    $$('.sci-siggroup').forEach(function (group) {
      var why = $('[data-why]', group);
      var chips = $$('.sci-fact.is-tap', group);
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

  /* ---- safety: one group open at a time, listed under the grid ------- */
  (function safety() {
    var boxes = $$('.sci-gbox');
    if (!boxes.length) return;
    boxes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        boxes.forEach(function (o) {
          o.setAttribute('aria-expanded', 'false');
          var body = document.getElementById(o.getAttribute('aria-controls'));
          if (body) body.hidden = true;
        });
        if (open) return;
        btn.setAttribute('aria-expanded', 'true');
        var mine = document.getElementById(btn.getAttribute('aria-controls'));
        if (mine) mine.hidden = false;
      });
    });
    var plan = $('.sci-plan-btn');
    if (plan) {
      plan.addEventListener('click', function () {
        var open = plan.getAttribute('aria-expanded') === 'true';
        plan.setAttribute('aria-expanded', String(!open));
        var body = document.getElementById(plan.getAttribute('aria-controls'));
        if (body) body.hidden = open;
      });
    }
  })();

  /* ---- the market switcher ------------------------------------------
     Only the reference targets move: the upper limits are one set
     worldwide, so their markers and the zone beyond them do not. */
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
        $('b', auth).textContent = s.authority.name;
        $('span', auth).textContent = s.authority.reference;
      }
      s.nutrients.forEach(function (n) {
        if (!ladders) return;
        var card = null;
        $$('[data-dose]', ladders).forEach(function (el) {
          if (el.getAttribute('data-dose') === n.nutrient) card = el;
        });
        if (!card) return;
        var t = n.target_reference_adult, ul = n.upper_limit;
        if (t == null) return;
        var span = ul ? ul * 1.18 : t * 2;
        var mark = $('.sci-mark', card);
        if (!mark) return;
        var pct = Math.max(0, Math.min(100, (t / span) * 100));
        mark.style.left = pct + '%';
        mark.classList.toggle('is-left', pct < 12);
        mark.classList.toggle('is-right', pct > 88);
        var val = $('i', mark);
        if (val) val.textContent = Number(t).toLocaleString('en-GB') + ' ' + (n.target_unit || '');
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
