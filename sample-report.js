/* /sample-report (sample-report.css). One row of products a persona.
   THE DOTS, as the product draws them (apps/webapp components/report/
   card-carousel.tsx): one a page the row can actually scroll to, measured
   from its travel rather than counted from its cards, each a button that
   scrolls there, the active one found by the same division. Nothing when
   the row does not scroll (a grid, or a wide window). */
(function(){
  var activeDot = function(left, travel, pages){ return (travel <= 0 || pages <= 1) ? 0 : Math.round((left / travel) * (pages - 1)); };
  var dotTarget = function(i, travel, pages){ return (i / Math.max(1, pages - 1)) * Math.max(0, travel); };
  [].slice.call(document.querySelectorAll('.sr-row')).forEach(function(row){
    var next = row.nextElementSibling;
    var box = next && next.classList.contains('sr-dots') ? next : null;
    if(!box) return;
    var pages = 0, dots = [];
    /* Smooth travel when a dot is pressed, set on the row's style so the
       scroll call needs no option. */
    row.style.scrollBehavior = 'smooth';
    var paint = function(){
      var travel = row.scrollWidth - row.clientWidth, k = activeDot(row.scrollLeft, travel, pages);
      dots.forEach(function(d, i){ if (i === k) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    var measure = function(){
      var travel = row.scrollWidth - row.clientWidth;
      var n = (travel > 2 && row.clientWidth > 0) ? Math.min(Math.max(1, Math.ceil(row.scrollWidth / row.clientWidth - 0.02)), Math.max(1, row.children.length)) : 0;
      if (n === pages) { paint(); return; }
      pages = n; box.textContent = ''; dots = [];
      for (var i = 0; i < pages; i++) (function(i){
        var b = document.createElement('button'); b.type = 'button'; b.className = 'sr-dot';
        b.setAttribute('aria-label', 'Products, page ' + (i + 1) + ' of ' + pages);
        b.appendChild(document.createElement('i'));
        b.addEventListener('click', function(){ row.scrollTo(dotTarget(i, row.scrollWidth - row.clientWidth, pages), 0); });
        box.appendChild(b); dots.push(b);
      })(i);
      paint();
    };
    measure();
    row.addEventListener('scroll', paint, { passive: true });
    if (window.ResizeObserver) { var ro = new ResizeObserver(measure); ro.observe(row); [].slice.call(row.children).forEach(function(c){ ro.observe(c); }); }
    else window.addEventListener('resize', measure);
  });
})();

/* THE EXPAND, as the product's (components/report/product-card-expand.tsx):
   the corner button opens a <dialog> holding the larger card. showModal
   gives the top layer, focus trapping, Escape and the backdrop for free;
   a click on the backdrop closes too. */
(function(){
  [].slice.call(document.querySelectorAll('.rp-card')).forEach(function(card){
    var btn = card.querySelector('.rp-ex'), dlg = card.querySelector('dialog.rp-dialog');
    if (!btn || !dlg) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      var x = dlg.querySelector('.rp-x-close'); if (x) x.focus();
    });
    var close = dlg.querySelector('.rp-x-close');
    if (close) close.addEventListener('click', function(){ dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    dlg.addEventListener('click', function(e){ if (e.target === dlg) { dlg.close ? dlg.close() : dlg.removeAttribute('open'); } });
  });
})();
