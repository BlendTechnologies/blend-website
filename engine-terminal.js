/* ============================================================
   The engine terminal
   ------------------------------------------------------------
   One dark walkthrough, shared by /science and the homepage. It
   drives whatever of its parts a page gives it: a log, a matrix,
   a caption, and optionally a profile card, a plan, stage ticks
   and transport controls. Everything except the log and the
   caption may be absent, which is how the homepage runs the same
   seven stages with no controls at all.

   ILLUSTRATIVE. Every line is assembled from sample pools. A
   product line carries an identifier and a status and never the
   number behind the decision.

   Nothing runs under reduced motion: the markup's resting state
   is already the end of the run.
   ============================================================ */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

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
  /* Optional: the homepage runs the same walkthrough with no controls at
     all, so every one of these may be absent. */
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
    if (planEl) planEl.hidden = stage !== LAST;
    /* Stage one opens on the profile the answers are being read into, so
       the first thing a reader sees is who this is rather than a wall of
       identifiers. The log takes the same space a moment later. */
    clearTimeout(personaTimer);
    if (personaEl) personaEl.hidden = stage !== 0;
    logEl.hidden = (planEl && stage === LAST) || (personaEl && stage === 0);
    if (stage === 0) {
      personaTimer = setTimeout(function () {
        if (personaEl) personaEl.hidden = true;
        logEl.hidden = false;
      }, PERSONA);
    }
    if (stateEl) stateEl.textContent = live ? 'running' : (stage === LAST ? 'complete' : 'paused');
    if (stateEl) stateEl.classList.toggle('is-on', !!live);
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
    if (toggle) {
      toggle.textContent = 'Run';
      toggle.setAttribute('aria-label', 'Start the walkthrough');
    }
    if (stateEl) stateEl.textContent = at === LAST ? 'complete' : 'paused';
    if (stateEl) stateEl.classList.remove('is-on');
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
    if (toggle) {
      toggle.textContent = 'Pause';
      toggle.setAttribute('aria-label', 'Pause the walkthrough');
    }
    stream(at === 0 ? PERSONA : 0);
    clearTimeout(timer);
    timer = setTimeout(advance, HOLD[at]);
  }

  if (toggle) {
    toggle.addEventListener('click', function () { if (playing) { stop(); } else { play(); } });
  }
  var replayBtn = $('[data-tm-replay]', card);
  if (replayBtn) {
    replayBtn.addEventListener('click', function () {
      stop(); logEl.textContent = ''; show(0, false); play();
    });
  }
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
})();
