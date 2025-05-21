document.addEventListener('DOMContentLoaded', function() {
  let isForward = true;
  
  const logoAnimation = anime.timeline({ 
    autoplay: true,
    delay: 50,
    loop: false,
    complete: function() {
      setTimeout(function() {
        timeout = isForward ? 3000 : 1000;
        if (isForward) {
          isForward = false;
          logoAnimation.reverse();
          logoAnimation.play();
        } else {
          isForward = true;
          logoAnimation.reverse();
          logoAnimation.play();
        }
      }, timeout);
    }
  });

  const restart = document.querySelector(".button-restart");

  const logo = document.querySelector('#logo');
  const logoText = document.querySelector('#logo-text');
  
  logo.addEventListener("click", () => {
    isForward = true;
    logoAnimation.play();
  });
  logoText.addEventListener("click", () => {
    isForward = true;
    logoAnimation.play();
  });

  logoAnimation.add({
    targets: '#logo',
    translateY: [-100, 0],
    opacity: [0, 1],
    elasticity: 600,
    duration: 1000
  }).add({
    targets: '#logo-hexagon',
    rotate: [-90, 0],
    duration: 800,
    elasticity: 600,
    offset: 100
  }).add({
    targets: '#logo-circle',
    scale: [0, 1],
    duration: 800,
    elasticity: 600,
    offset: 500
  }).add({
    targets: '#logo-mask',
    scale: [0, 1],
    duration: 600,
    elasticity: 600,
    offset: 550
  }).add({
    targets: '#logo-text',
    translateX: ['-100%', 0],
    opacity: [0, 1],
    duration: 600,
    easing: 'easeOutExpo',
    offset: 1000
  });
});