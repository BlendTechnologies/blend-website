/* /sample-report (sample-report.css). Each report's row of products scrolls
   sideways; its dots follow the card at the row's start. One row a persona. */
(function(){
  [].slice.call(document.querySelectorAll('.sr-row')).forEach(function(row){
    var next = row.nextElementSibling;
    var dots = next && next.classList.contains('sr-dots') ? [].slice.call(next.children) : [];
    if(!dots.length) return;
    row.addEventListener('scroll', function(){
      var cards = row.children, k = 0, best = Infinity;
      for(var i = 0; i < cards.length; i++){
        var d = Math.abs(cards[i].offsetLeft - row.offsetLeft - row.scrollLeft);
        if(d < best){ best = d; k = i; }
      }
      dots.forEach(function(d, i){ d.classList.toggle('is-on', i === k); });
    }, { passive: true });
  });
})();
