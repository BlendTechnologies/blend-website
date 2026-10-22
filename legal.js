/* The legal pages' contents (legal.css): open beside the text from 1024px,
   folded above it below that, and marking the section being read. A
   section counts as read once its heading has passed a third of the way
   down the window, which is where the eye is, not the window's top edge. */
(function(){
  var toc = document.querySelector('.lg-toc');
  if(!toc) return;
  var wide = window.matchMedia('(min-width:1024px)');
  function fold(){ toc.open = wide.matches; }
  fold();
  if(wide.addEventListener) wide.addEventListener('change', fold); else wide.addListener(fold);
  /* below 1024px, a section picked from the contents folds them again */
  toc.addEventListener('click', function(e){ if(e.target.closest('a') && !wide.matches) toc.open = false; });

  var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
  var heads = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)); });
  var on = -1;
  function mark(){
    var line = window.innerHeight / 3, k = 0;
    heads.forEach(function(h, i){ if(h && h.getBoundingClientRect().top <= line) k = i; });
    if(k === on) return;
    on = k;
    links.forEach(function(a, i){
      a.classList.toggle('is-on', i === k);
      if(i === k) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  var queued = false;
  window.addEventListener('scroll', function(){
    if(queued) return; queued = true;
    requestAnimationFrame(function(){ queued = false; mark(); });
  }, { passive: true });
  window.addEventListener('resize', mark);
  mark();
})();
