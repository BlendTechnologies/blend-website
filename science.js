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

  /* ---- figures count up as their section arrives --------------------- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count'));
    var text = el.textContent;
    if (!isFinite(to) || reduce) return;
    var start = null, dur = 900;
    function frame(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-GB');
      if (p < 1) requestAnimationFrame(frame); else el.textContent = text;
    }
    el.textContent = '0';
    requestAnimationFrame(frame);
  }

  /* An index on everything that arrives in order, so one rule can stagger
     a list of any length without a nth-child for each position. */
  (function order() {
    $$('.sci-goalgrid').forEach(function (grid) {
      $$('.sci-goalname', grid).forEach(function (el, i) { el.style.setProperty('--i', i); });
    });
  })();

  (function counters() {
    var targets = $$('[data-count]');
    if (!targets.length) return;
    if (reduce || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        countUp(e.target);
      });
    }, { threshold: 0.6 });
    targets.forEach(function (t) { io.observe(t); });
  })();

  /* ---- a goal shows its signals -------------------------------------- */
  (function goals() {
    var grid = $('[data-goals]'), panel = $('[data-subs]');
    if (!grid || !panel) return;
    var data = null;
    try { data = JSON.parse($('#sci-data').textContent); } catch (e) { return; }
    var live = Object.keys(data.verticals).filter(function (k) { return data.verticals[k].status === 'live'; })[0];
    var map = {};
    (data.verticals[live].goals || []).forEach(function (g) {
      map[g.goal] = g.subgoals.filter(function (x) { return x.trim().toLowerCase() !== 'none of the above.'; });
    });
    var btns = $$('.sci-goalname', grid);
    /* the fold: ten goals open, the rest behind "+N more" */
    var more = $('.sci-goalmore', grid);
    if (more) {
      var closed = more.textContent;
      more.addEventListener('click', function () {
        var open = grid.classList.toggle('is-open');
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Show fewer' : closed;
      });
    }
    function show(btn) {
      var subs = map[btn.getAttribute('data-goal')];
      if (!subs) return;
      btns.forEach(function (b) { b.setAttribute('aria-expanded', String(b === btn)); });
      $('.sci-subs-t', panel).textContent = btn.getAttribute('data-goal');
      var list = $('.sci-subs-list', panel);
      list.textContent = '';
      subs.forEach(function (x) {
        var el = document.createElement('span');
        el.textContent = x;
        list.appendChild(el);
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('mouseenter', function () { show(b); });
      b.addEventListener('focus', function () { show(b); });
      b.addEventListener('click', function () { show(b); });
    });
  })();

  /* ---- a product shows what is recorded about it ---------------------
     The goal explorer's behaviour, on the goal explorer's markup: pointer,
     keyboard focus and click all select, so the panel follows the reader
     however they are moving through the row. */
  (function products() {
    var grid = $('[data-products]'), panel = $('[data-prod-detail]');
    if (!grid || !panel) return;
    var data = null;
    try { data = JSON.parse($('#sci-data').textContent); } catch (e) { return; }
    var live = Object.keys(data.verticals).filter(function (k) { return data.verticals[k].status === 'live'; })[0];
    var items = ((data.verticals[live].products || {}).items) || [];
    var map = {};
    items.forEach(function (p) { map[p.name] = p.attributes; });

    var btns = $$('.sci-goalname', grid);
    var rows = $('.sci-prows', panel);
    function show(btn) {
      var attrs = map[btn.getAttribute('data-prod')];
      if (!attrs) return;
      btns.forEach(function (b) { b.setAttribute('aria-expanded', String(b === btn)); });
      $('.sci-subs-t', panel).textContent = btn.getAttribute('data-prod');
      rows.textContent = '';
      attrs.forEach(function (a) {
        var row = document.createElement('div');
        row.className = 'sci-prow';
        var dt = document.createElement('dt');
        dt.textContent = a.label;
        var dd = document.createElement('dd');
        if (a.value) {
          dd.textContent = a.value;
        } else {
          var none = document.createElement('span');
          none.className = 'sci-prow-none';
          none.textContent = 'None recorded';
          dd.appendChild(none);
        }
        row.appendChild(dt);
        row.appendChild(dd);
        rows.appendChild(row);
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('mouseenter', function () { show(b); });
      b.addEventListener('focus', function () { show(b); });
      b.addEventListener('click', function () { show(b); });
    });
  })();

  /* The terminal lives in engine-terminal.js now: the homepage runs the same
     component, so it cannot stay inside this page's script. */

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
        auth.querySelector('span:not(.sci-legal)').textContent = s.authority.reference;
        var legal = $('.sci-legal', auth);
        if (legal) {
          var rules = (s.ingredient_legality || {}).rules_in_force || {};
          var names = Object.keys(rules);
          legal.textContent = names.length
            ? 'Blocked here: ' + names.map(function (n) { return n + ' (' + (rules[n] || []).join(', ') + ')'; }).join('; ') + '.'
            : 'No national ingredient ban recorded for this market.';
        }
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
