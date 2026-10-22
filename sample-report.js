/* /sample-report (sample-report.css). The guide beside the report opens the
   part in view, and the hero's index marks it too; each part rises in as it
   arrives, its bars filling; the products' row keeps its dots in step. A
   part counts as in view once its top has passed 40% of the window, which is
   where a reader's eye is, not the window's edge. */
(function(){
  var root = document.documentElement;
  var parts = [].slice.call(document.querySelectorAll('[data-sr]'));
  if(!parts.length) return;
  root.classList.add('sr-js');
  var steps = [].slice.call(document.querySelectorAll('.sr-step'));
  var ix = [].slice.call(document.querySelectorAll('.sr-ix .ph-ix-item'));

  /* arrival */
  var all = [].slice.call(document.querySelectorAll('.sr-part'));
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    all.forEach(function(p){ io.observe(p); });
  } else all.forEach(function(p){ p.classList.add('is-in'); });

  /* the part in view */
  var on = -1;
  function mark(){
    var line = window.innerHeight * 0.4, k = 0;
    parts.forEach(function(p, i){ if(p.getBoundingClientRect().top <= line) k = i; });
    if(k === on) return;
    on = k;
    var id = parts[k].getAttribute('data-sr');
    steps.forEach(function(s){ s.classList.toggle('is-on', s.getAttribute('data-for') === id); });
    ix.forEach(function(a){ a.classList.toggle('is-on', a.getAttribute('href') === '#' + id); });
  }
  var queued = false;
  window.addEventListener('scroll', function(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; mark(); });
  }, { passive: true });
  window.addEventListener('resize', mark);
  mark();

  /* the products' row and its dots */
  var row = document.querySelector('.sr-row'), dots = [].slice.call(document.querySelectorAll('.sr-dots i'));
  if(row && dots.length){
    row.addEventListener('scroll', function(){
      var cards = row.children, k = 0, best = Infinity;
      for(var i = 0; i < cards.length; i++){
        var d = Math.abs(cards[i].offsetLeft - row.offsetLeft - row.scrollLeft);
        if(d < best){ best = d; k = i; }
      }
      dots.forEach(function(d, i){ d.classList.toggle('is-on', i === k); });
    }, { passive: true });
  }
})();
