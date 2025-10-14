document.addEventListener("DOMContentLoaded", function () {
  const root = document.querySelector(".post-content");
  if (!root) return;

  const icons = {
    unread: "<svg viewBox='0 0 24 24'><rect x='4' y='4' width='16' height='16' rx='2'/></svg>",
    active: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='8'/></svg>",
    read:   "<svg viewBox='0 0 24 24'><path d='M4 12l5 5 11-11'/></svg>"
  };

  function buildTitleSpan(header) {
    let titleSpan = header.querySelector('.acc-title');
    if (titleSpan) {
      header.setAttribute('title', titleSpan.textContent || '');
      return;
    }

    const badge = header.querySelector('.read-badge');
    const parts = [];
    header.childNodes.forEach(n => {
      if (badge && n === badge) return;
      if (n.nodeType === Node.TEXT_NODE) parts.push(n.nodeValue);
      else if (n.nodeType === Node.ELEMENT_NODE && !n.classList.contains('anchor'))
        parts.push(n.textContent || '');
    });

    let title = parts.join(' ').replace(/\\s+/g, ' ').trim();
    title = title.replace(/\\s*#\\s*$/, '');

    const hadBadge = !!badge;
    header.textContent = '';
    if (hadBadge) header.appendChild(badge);

    titleSpan = document.createElement('span');
    titleSpan.className = 'acc-title';
    titleSpan.textContent = title;
    header.appendChild(document.createTextNode(' '));
    header.appendChild(titleSpan);
    header.setAttribute('title', title);
  }

  const sections = root.querySelectorAll('.accordion-section');
  sections.forEach(sec => {
    const header = sec.querySelector('.accordion-header');
    if (!header) return;

    if (!header.querySelector('.read-badge')) {
      const badge = document.createElement('span');
      badge.className = 'read-badge';
      badge.innerHTML = icons.unread + 'NEXT';
      header.insertBefore(badge, header.firstChild);
    }

    buildTitleSpan(header);
  });

  root.addEventListener('click', e => {
    const header = e.target.closest('.accordion-header');
    if (!header) return;
    const badge = header.querySelector('.read-badge');
    if (!badge) return;

    root.querySelectorAll('.read-badge.active').forEach(b => {
      b.classList.remove('active');
      b.classList.add('read');
      b.innerHTML = icons.read + 'READ';
    });

    badge.classList.remove('read');
    badge.classList.add('active');
    badge.innerHTML = icons.active + 'READING';
    buildTitleSpan(header);
  });

  sections.forEach(sec => {
    if (sec.classList.contains('open')) {
      const header = sec.querySelector('.accordion-header');
      const badge = sec.querySelector('.read-badge');
      if (badge) {
        badge.classList.add('active');
        badge.innerHTML = icons.active + 'READING';
      }
      if (header) buildTitleSpan(header);
    }
  });
});
