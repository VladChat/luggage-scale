(function () {
  const root = document.documentElement;
  const wrap = document.getElementById('mascot-guide');
  if (!wrap) return;
  const bubble = document.getElementById('mascot-bubble');
  const nextSpan = document.getElementById('mascot-next');
  const cta = document.getElementById('mascot-cta');

  // Конфиг CTA из data-атрибутов
  const ctaText = wrap.getAttribute('data-cta-text') || 'See more →';
  const ctaLink = wrap.getAttribute('data-cta-link') || '/';
  cta.textContent = ctaText;
  cta.href = ctaLink;

  // Собираем разделы поста: H2 в .post-content
  const container = document.querySelector('.post-content');
  if (!container) return;
  const sections = Array.from(container.querySelectorAll('h2'))
    .filter(h => h.textContent.trim().length > 0);

  if (!sections.length) return;

  // Обновление текста «Next: …»
  function updateBubbleText(index) {
    const lastIdx = sections.length - 1;
    if (index < lastIdx) {
      const nextTitle = sections[index + 1].textContent.trim();
      nextSpan.textContent = nextTitle;
      bubble.style.display = 'block';
      cta.style.display = 'none';
    } else {
      // у последнего раздела — показываем CTA
      bubble.style.display = 'none';
      cta.style.display = 'block';
    }
  }

  // Находим активную секцию по центру viewport
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const vpMid = window.innerHeight * 0.4;
        let current = 0;
        for (let i = 0; i < sections.length; i++) {
          const rect = sections[i].getBoundingClientRect();
          if (rect.top - vpMid <= 0) current = i;
        }
        updateBubbleText(current);
        ticking = false;
      });
      ticking = true;
    }
    // лёгкая «походка» при скролле
    wrap.classList.add('scrolling');
    clearTimeout(onScroll._t);
    onScroll._t = setTimeout(() => wrap.classList.remove('scrolling'), 180);
  }

  // Подсказка при первом появлении
  updateBubbleText(0);

  // IntersectionObserver — когда пользователь внизу, сразу CTA
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        bubble.style.display = 'none';
        cta.style.display = 'block';
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });

  const lastSection = sections[sections.length - 1];
  io.observe(lastSection);

  window.addEventListener('scroll', onScroll, { passive: true });
})();