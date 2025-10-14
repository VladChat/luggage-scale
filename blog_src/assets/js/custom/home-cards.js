document.addEventListener('DOMContentLoaded', () => {
    /* 1) Помечаем посты как прочитанные, когда открыта single-страница */
    const isSingle = document.querySelector('.post-single');
    if (isSingle) {
      try {
        localStorage.setItem('postRead:' + location.pathname, '1');
      } catch (_) {}
    }

    /* 2) На главной/списках добавляем бейджи READ / TO READ слева от заголовка */
    const cards = document.querySelectorAll('article.post-entry, article.first-entry');
    cards.forEach(card => {
      const titleLink = card.querySelector('.entry-header a, .entry-header h2 a');
      const header = card.querySelector('.entry-header');
      if (!titleLink || !header) return;

      let url;
      try { url = new URL(titleLink.getAttribute('href'), location.href).pathname; }
      catch { url = titleLink.getAttribute('href'); }
      const isRead = (localStorage.getItem('postRead:' + url) === '1');

      const pill = document.createElement('span');
      pill.className = 'read-pill' + (isRead ? ' active' : '');
      pill.textContent = isRead ? 'READ' : 'TO READ';
      header.prepend(pill);
    });

    /* 3) Плавное появление карточек при скролле */
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('fade-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    cards.forEach(c => io.observe(c));
  });