/* ============================================================
   Scroll cards — progressions for the shapes in scroll-cards.css
   ------------------------------------------------------------
   One passive listener, batched into a frame, writing one custom
   property per participating element. The browser only ever
   recomposites: no width, height, margin or anything else that would
   make it lay the page out again.

   Nothing here is a trigger. Every value tracks the scroll position in
   both directions, so scrolling back up reopens a hero and closes a
   reveal again.

   Markup opts in:
     data-sc="hero"    full bleed -> card, over the first half of its height
     data-sc="reveal"  card -> full bleed on entry, back to a card on exit
     data-sc="endcap"  a group of reveals measured as one block, opening
                       across the whole of it and never contracting
   ============================================================ */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var heroes, reveals, endcap, zooms, queued = false;

  function collect() {
    heroes  = [].slice.call(document.querySelectorAll('[data-sc="hero"]'));
    reveals = [].slice.call(document.querySelectorAll('[data-sc="reveal"]'));
    endcap  = [].slice.call(document.querySelectorAll('[data-sc="endcap"]'));
    zooms   = [].slice.call(document.querySelectorAll('[data-sc="zoom"]'));
  }

  function clamp(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }
  function set(el, v) { el.style.setProperty('--sc-p', v.toFixed(4)); }

  function update() {
    queued = false;
    /* The stylesheet holds every end state under reduced motion. Writing
       an inline value here would beat that media query and undo it. */
    if (reduce.matches) return;
    var vh = window.innerHeight || 1;

    heroes.forEach(function (el) {
      /* Closes over the first half of its own height, so the card has
         formed well before the block leaves rather than just as it goes. */
      var r = el.getBoundingClientRect();
      var p = clamp(-r.top / Math.max(1, r.height * 0.5));
      set(el, p);
      /* The cue fades out on this same progression; the class takes it out
         of reach and out of the tab order once it has, so there is never an
         invisible button sitting over the page. */
      el.classList.toggle('is-cue-gone', p > 0.15);
    });

    /* 1 when the element's middle is at the middle of the screen, falling
       away to 0 as it reaches either edge. */
    zooms.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var mid = r.top + r.height / 2;
      set(el, clamp(1 - Math.abs(mid - vh / 2) / (vh * 0.75)));
    });

    reveals.forEach(function (el) {
      var r = el.getBoundingClientRect();
      /* Entry runs the full viewport - card when the top crosses the
         bottom edge, open when it reaches the top. Exit runs a shorter
         span, so it closes late rather than early. */
      set(el, Math.min(clamp((vh - r.top) / vh), clamp(r.bottom / (vh * 0.55))));
    });

    if (endcap.length) {
      /* Measured across the whole group rather than its first member. On
         one member's span it reached full bleed while the rest was still
         below the fold, so the group never appeared as one card at all.
         It opens as the end of the group arrives, and only opens: the
         last thing on a page has nothing underneath to return to. */
      var first = endcap[0].getBoundingClientRect();
      var last = endcap[endcap.length - 1].getBoundingClientRect();
      var reach = Math.max(1, last.bottom - first.top);
      var p = clamp((vh - first.top) / reach);
      endcap.forEach(function (el) { set(el, p); });
    }
  }

  function onScroll() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }

  function clear() {
    heroes.concat(reveals, endcap).forEach(function (el) {
      el.style.removeProperty('--sc-p');
    });
    zooms.forEach(function (el) { el.style.removeProperty('--sc-p'); });
  }

  /* The cue scrolls to whatever it names. A <button> already fires click
     on Enter and Space, so there is no key handling to add. */
  function wireCue() {
    document.addEventListener('click', function (e) {
      var cue = e.target && e.target.closest ? e.target.closest('[data-sc-cue]') : null;
      if (!cue) return;
      var target = document.querySelector(cue.getAttribute('data-sc-cue'));
      if (!target) return;
      target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function start() {
    collect();
    wireCue();
    if (!heroes.length && !reveals.length && !endcap.length && !zooms.length) return;
    if (!window.requestAnimationFrame) return;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    /* Turning reduced motion on mid-session has to hand control back to
       the stylesheet, which means clearing what was written inline. */
    if (reduce.addEventListener) {
      reduce.addEventListener('change', function () {
        if (reduce.matches) { clear(); } else { update(); }
      });
    }
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();
