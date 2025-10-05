// === uPatch Blog | Section Icons Reading Progress ===
document.addEventListener('DOMContentLoaded', () => {
  // Берём h2/h3 внутри основного контента
  const sections = document.querySelectorAll('main h2[id], main h3[id]');
  if (!sections.length) return;

  // Если у заголовка нет иконки — вставим нейтральную точку
  sections.forEach(sec => {
    let icon = sec.querySelector('.icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = '•'; // нейтральный маркер (можно заменить на эмодзи/вставку SVG)
      icon.style.marginRight = '0.5em';
      sec.insertBefore(icon, sec.firstChild);
    }
  });

  // Восстановим состояние из localStorage
  const readIds = new Set(JSON.parse(localStorage.getItem('readSections') || '[]'));
  readIds.forEach(id => {
    const icon = document.querySelector(`#${CSS.escape(id)} .icon`);
    if (icon) icon.classList.add('read');
  });

  // Подсветка текущей секции + пометка как прочитанной
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const icon = entry.target.querySelector('.icon');
      if (!icon) return;

      if (entry.isIntersecting) {
        icon.classList.add('active', 'read');
        readIds.add(id);
        localStorage.setItem('readSections', JSON.stringify([...readIds]));
      } else {
        icon.classList.remove('active');
      }
    });
  }, { threshold: 0.6 });

  sections.forEach(sec => io.observe(sec));
});
