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

  /* ---- the terminal --------------------------------------------------
     One log that runs for the whole walkthrough, printing about eight lines
     a second, newest at the bottom, oldest falling off the top. The heading
     and its sentence change at stage boundaries; the terminal does not stop.

     ILLUSTRATIVE. Every line is assembled here from small pools of sample
     text. A product line carries an identifier and a status and never the
     number behind the decision, because the number is the part worth
     copying.

     Nothing runs under reduced motion: the markup's resting state is already
     the end of the run, so a reader who asked for less motion is looking at
     the finished plan rather than an empty box. */
  (function terminal() {
    var card = $('[data-term]');
    if (!card) return;

    var logEl = $('[data-tm-log]', card);
    var planEl = $('[data-tm-plan]', card);
    var mxEl = $('[data-tm-mx]', card);
    var sweep = $('[data-tm-sweep]', card);
    var stateEl = $('[data-tm-state]', card);
    var personaEl = $('[data-tm-persona]', card);
    var heads = $$('.tm-head', card);
    var ticks = $$('.tm-tick', card);
    var toggle = $('[data-tm-toggle]', card);
    var cells = $$('i', mxEl);

    var LAST = 6, VISIBLE = 16, TICK = 88;       /* ~11 lines a second */
    /* The same cells the markup already marks, so the finished state the
       page ships and the state this handler builds cannot drift apart. */
    var CUT = [7, 19, 26, 41, 53, 68, 74, 88, 97, 111, 123, 134, 141, 150, 157];
    var PICK = [34, 60, 92, 118, 129, 146];
    var HOLD = [3200, 3100, 3000, 3400, 4400, 4400, 2400];

    /* The pools are sized against a stage, not against the screen: a stage
       runs about 36 lines at this rate, so a pool shorter than that repeats
       inside one pass however it is shuffled. That is what made the log read
       as noise rather than as a profile being worked through. */
    var SIG = [['goal', 'energy'], ['goal', 'sleep'], ['goal', 'immunity'], ['diet', 'vegetarian'],
      ['fish', 'none'], ['dairy', 'twice daily'], ['red-meat', 'weekly'], ['eggs', 'most days'],
      ['legumes', 'most days'], ['wholegrains', 'daily'], ['leafy-greens', 'daily'],
      ['fruit', 'twice daily'], ['nuts', 'rarely'], ['oily-fish', 'rarely'],
      ['breakfast', 'skipped'], ['portions', 'moderate'], ['water', '1.2 l/day'],
      ['caffeine', '3/day'], ['alcohol', '4/week'], ['smoking', 'never'],
      ['sun', 'low'], ['activity', 'sedentary'], ['training', 'none'], ['sleep', '6 h'],
      ['stress', 'reported'], ['age-band', '31-50'], ['sex', 'female'], ['market', 'GB'],
      ['pregnancy', 'no'], ['breastfeeding', 'no'], ['medication', 'declared'],
      ['conditions', 'none declared'], ['allergies', 'none declared'], ['supplements', 'none'],
      ['height', 'recorded'], ['weight', 'recorded']];
    var FOOD = [['wholegrains', '220 g/day'], ['dairy', '180 g/day'], ['leafy-greens', '95 g/day'],
      ['fruit', '150 g/day'], ['legumes', '60 g/day'], ['oils', '25 g/day'], ['red-meat', '70 g/day'],
      ['oily-fish', '10 g/day'], ['nuts', '15 g/day'], ['eggs', '35 g/day'], ['potatoes', '90 g/day'],
      ['rice-pasta', '110 g/day'], ['cheese', '30 g/day'], ['yoghurt', '80 g/day'],
      ['root-veg', '70 g/day'], ['brassica', '45 g/day'], ['berries', '40 g/day'],
      ['seeds', '8 g/day'], ['soy', '25 g/day'], ['bread', '95 g/day'], ['cereal', '40 g/day'],
      ['sauces', '20 g/day'], ['sweets', '18 g/day'], ['juice', '60 g/day']];
    var NUT = ['vitamin-a', 'vitamin-b1', 'vitamin-b2', 'vitamin-b3', 'vitamin-b5', 'vitamin-b6',
      'vitamin-b7', 'vitamin-b9', 'vitamin-b12', 'vitamin-c', 'vitamin-d', 'vitamin-e', 'vitamin-k',
      'calcium', 'copper', 'iodine', 'iron', 'magnesium', 'manganese', 'phosphorus', 'potassium',
      'selenium', 'zinc', 'omega-3', 'protein', 'fibre', 'chloride', 'chromium', 'molybdenum',
      'sodium', 'boron', 'sulfur', 'cholesterol', 'free-sugars', 'saturated-fat', 'water'];
    var SHORT = ['vitamin-d', 'iron', 'magnesium', 'vitamin-b12', 'omega-3', 'iodine'];
    var PROD = ['vitamin-d3', 'magnesium-glycinate', 'omega-3-algae', 'omega-3-fish',
      'iron-bisglycinate', 'zinc-picolinate', 'calcium-citrate', 'collagen-peptides',
      'ashwagandha-ksm66', 'creatine-mono', 'probiotic-10b', 'whey-isolate', 'vitamin-c-1000',
      'b-complex', 'multivitamin-w', 'marine-collagen', 'coq10-ubiquinol', 'lions-mane',
      'rhodiola-rosea', 'l-theanine', 'psyllium-husk', 'inulin-prebiotic', 'vitamin-k2-mk7',
      'selenium-yeast', 'biotin-5000', 'folate-5mthf', 'potassium-citrate', 'electrolyte-blend',
      'turmeric-complex', 'milk-thistle', 'saw-palmetto', 'lutein-zeaxanthin', 'glucosamine',
      'beta-alanine', 'bcaa-211', 'pea-protein'];

    var PERSONA = 1500;
    var at = LAST, timer = null, lineTimer = null, personaTimer = null, playing = false, n = 0, cut = 0;

    /* Sampling at random repeated itself — "breakfast skipped" twice inside
       ten lines reads as noise rather than as a profile being read. Each pool
       is walked instead, in an order shuffled once per pass, so nothing
       recurs until everything else has had its turn. */
    var cursors = {};
    function cycle(key, a) {
      var c = cursors[key];
      if (!c || c.i >= c.order.length) {
        var order = a.slice();
        for (var k = order.length - 1; k > 0; k--) {
          var r = Math.floor(Math.random() * (k + 1));
          var tmp = order[k]; order[k] = order[r]; order[r] = tmp;
        }
        c = cursors[key] = { order: order, i: 0 };
      }
      return c.order[c.i++];
    }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function pad(v, w) { v = String(v); while (v.length < w) { v += ' '; } return v; }

    function emit(parts, tone) {
      var row = document.createElement('div');
      row.className = 'tm-line' + (tone ? ' is-' + tone : '');
      for (var i = 0; i < parts.length; i++) {
        var sp = document.createElement('span');
        sp.className = parts[i][0];
        sp.textContent = parts[i][1];
        row.appendChild(sp);
      }
      logEl.appendChild(row);
      while (logEl.children.length > VISIBLE + 6) { logEl.removeChild(logEl.firstChild); }
      var kids = logEl.children, len = kids.length;
      for (var k = 0; k < len; k++) {
        var d = len - 1 - k;                       /* 0 is the newest */
        kids[k].style.opacity = d < 2 ? 1 : Math.max(0.16, 1 - d * 0.1);
      }
    }

    function id(p, w) { n += 1; return p + '-' + pad(String(1000 + (n % 8999)), w || 4); }

    var WORK = ['computing', 'resolving', 'normalising', 'cross-checking', 'indexing'];

    function line(stage) {
      var x;
      /* A working line now and then. The machine should look like it is
         thinking between the things it prints, not only listing. */
      if (stage !== LAST && Math.random() < 0.07) {
        emit([['tm-k', 'SYS'], ['tm-i', '      '], ['tm-f', cycle('work', WORK) + '\u2026'], ['tm-v', ''], ['tm-s', '']], 'work');
        return;
      }
      if (stage === 0) {
        x = cycle('SIG', SIG);
        emit([['tm-k', 'SIG'], ['tm-i', id('s')], ['tm-f', pad(x[0], 14)], ['tm-v', pad(x[1], 14)], ['tm-s', 'READ']]);
      } else if (stage === 1) {
        x = cycle('FOOD', FOOD);
        emit([['tm-k', 'DIET'], ['tm-i', id('f')], ['tm-f', pad(x[0], 14)], ['tm-v', pad(x[1], 14)], ['tm-s', 'EST']]);
      } else if (stage === 2) {
        emit([['tm-k', 'TGT'], ['tm-i', id('t')], ['tm-f', pad(cycle('nut', NUT), 14)], ['tm-v', pad('reference', 14)], ['tm-s', 'SET']]);
      } else if (stage === 3) {
        var nut = cycle('gap', NUT.concat(SHORT));
        var isShort = SHORT.indexOf(nut) > -1;
        emit([['tm-k', 'GAP'], ['tm-i', id('g')], ['tm-f', pad(nut, 14)],
          ['tm-v', pad(isShort ? 'below target' : 'covered', 14)],
          ['tm-s', isShort ? 'SHORTFALL' : 'OK']], isShort ? 'short' : '');
      } else if (stage === 4) {
        emit([['tm-k', 'PRD'], ['tm-i', id('p')], ['tm-f', pad(cycle('prd', PROD), 20)], ['tm-v', pad('', 8)], ['tm-s', 'ASSESSED']]);
      } else if (stage === 5) {
        var bad = Math.random() < 0.34;
        emit([['tm-k', 'CHK'], ['tm-i', id('c')], ['tm-f', pad(cycle('chk', PROD), 20)], ['tm-v', pad('', 8)],
          ['tm-s', bad ? 'EXCLUDED' : 'PASSED']], bad ? 'cut' : 'ok');
        if (bad && cut < CUT.length) { cells[CUT[cut]].className = 'is-cut'; cut += 1; }
      } else {
        emit([['tm-k', 'PLAN'], ['tm-i', id('r')], ['tm-f', pad(cycle('sel', PROD), 20)], ['tm-v', pad('', 8)], ['tm-s', 'SELECTED']], 'pick');
      }
    }

    function matrixFor(stage) {
      sweep.classList.toggle('is-on', stage === 4);
      mxEl.classList.toggle('is-dim', stage === 6);
      if (stage < 4) {
        cells.forEach(function (c) { c.className = ''; });
        cut = 0;
      }
      if (stage < 4) {
        /* Not dead, just not scored yet: a few cells carry a faint light so
           the matrix reads as a surface the engine is about to work on. */
        for (var q = 0; q < 14; q++) {
          cells[Math.floor(Math.random() * cells.length)].className = 'is-idle';
        }
      }
      if (stage === 4) {
        cells.forEach(function (c, i) {
          setTimeout(function () { if (Math.random() < 0.62) { c.className = 'is-on'; } },
            (i % 16) * 230 + Math.random() * 180);
        });
      }
      if (stage === 6) {
        /* The end of the walkthrough is one fixed picture, whether a reader
           watched every stage or pressed skip on arrival. Without that the
           final frame carried however far the scoring had got, which is a
           different image every time — and the screenshot harness freezes
           CSS but not JavaScript, so it would capture whichever one it
           happened to catch. */
        cells.forEach(function (c, i) {
          c.className = CUT.indexOf(i) > -1 ? 'is-cut'
            : PICK.indexOf(i) > -1 ? ''
            : (i * 7 + 3) % 10 < 6 ? 'is-on' : '';
        });
        cut = CUT.length;
        PICK.forEach(function (i, k) {
          setTimeout(function () { cells[i].className = 'is-pick'; }, k * 150);
        });
      }
    }

    function show(stage, live) {
      at = stage;
      heads.forEach(function (el, k) { el.hidden = k !== stage; });
      ticks.forEach(function (t, k) {
        if (k === stage) { t.setAttribute('aria-current', 'step'); } else { t.removeAttribute('aria-current'); }
        t.classList.toggle('is-done', k < stage);
      });
      planEl.hidden = stage !== LAST;
      /* Stage one opens on the profile the answers are being read into, so
         the first thing a reader sees is who this is rather than a wall of
         identifiers. The log takes the same space a moment later. */
      clearTimeout(personaTimer);
      personaEl.hidden = stage !== 0;
      logEl.hidden = stage === LAST || stage === 0;
      if (stage === 0) {
        personaTimer = setTimeout(function () {
          personaEl.hidden = true;
          logEl.hidden = false;
        }, PERSONA);
      }
      stateEl.textContent = live ? 'running' : (stage === LAST ? 'complete' : 'paused');
      stateEl.classList.toggle('is-on', !!live);
      matrixFor(stage);
    }

    function stream(delay) {
      clearInterval(lineTimer);
      if (at === LAST) return;
      setTimeout(function () {
        if (!playing || at === LAST) return;
        clearInterval(lineTimer);
        lineTimer = setInterval(function () { line(at); }, TICK);
      }, delay || 0);
    }

    function stop() {
      clearTimeout(timer); clearInterval(lineTimer); clearTimeout(personaTimer);
      timer = lineTimer = null; playing = false;
      toggle.textContent = 'Run';
      toggle.setAttribute('aria-label', 'Start the walkthrough');
      stateEl.textContent = at === LAST ? 'complete' : 'paused';
      stateEl.classList.remove('is-on');
    }

    function advance() {
      if (at >= LAST) { stop(); return; }
      show(at + 1, true);
      stream();
      if (at < LAST) { timer = setTimeout(advance, HOLD[at]); } else { stop(); }
    }

    function play() {
      if (reduce) { show(LAST, false); return; }
      if (at >= LAST) { logEl.textContent = ''; show(0, true); } else { show(at, true); }
      playing = true;
      toggle.textContent = 'Pause';
      toggle.setAttribute('aria-label', 'Pause the walkthrough');
      stream(at === 0 ? PERSONA : 0);
      clearTimeout(timer);
      timer = setTimeout(advance, HOLD[at]);
    }

    toggle.addEventListener('click', function () { if (playing) { stop(); } else { play(); } });
    $('[data-tm-replay]', card).addEventListener('click', function () {
      stop(); logEl.textContent = ''; show(0, false); play();
    });
    ticks.forEach(function (t, k) {
      t.addEventListener('click', function () {
        stop(); logEl.textContent = ''; show(k, false);
        if (!reduce && k !== LAST) { for (var i = 0; i < 10; i++) { line(k); } }
      });
    });

    if (reduce || !window.IntersectionObserver) { show(LAST, false); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        logEl.textContent = '';
        show(0, false);
        play();
      });
    }, { threshold: 0.4 });
    io.observe(card);
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
