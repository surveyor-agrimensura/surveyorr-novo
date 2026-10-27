(function(){
  function initHomeShowcase(){
    const host = document.querySelector('[data-home-showcase]');
    if(!host) return;
    const slides = Array.from(host.querySelectorAll('.home-showcase-slide'));
    const dots = Array.from(host.querySelectorAll('.home-showcase-dots button'));
    if(!slides.length) return;
    let index = 0;
    let timer = null;

    function render(nextIndex){
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    function start(){
      stop();
      timer = window.setInterval(() => render(index + 1), 3000);
    }

    function stop(){
      if(timer){ window.clearInterval(timer); timer = null; }
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        render(i);
        start();
      });
    });

    host.addEventListener('mouseenter', stop);
    host.addEventListener('mouseleave', start);
    host.addEventListener('focusin', stop);
    host.addEventListener('focusout', start);

    render(0);
    start();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initHomeShowcase, {once:true});
  } else {
    initHomeShowcase();
  }
})();
