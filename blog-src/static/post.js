(function () {
  const sectionToggles = Array.from(document.querySelectorAll('[data-section-toggle]'));
  const tocToggles = Array.from(document.querySelectorAll('.toc-item__toggle'));
  const mobileTocToggle = document.querySelector('.post__toc-toggle');
  const mobileTocPanel = document.querySelector('#post-toc-mobile');
  const tocLinks = Array.from(document.querySelectorAll('.post__toc-nav a'));
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const setContentHeight = (content, expanded) => {
    if (!content) return;
    if (prefersReducedMotion()) {
      content.style.maxHeight = expanded ? 'none' : '0px';
      content.dataset.open = expanded ? 'true' : 'false';
      return;
    }
    if (expanded) {
      content.dataset.open = 'true';
      content.style.maxHeight = content.scrollHeight + 'px';
    } else {
      content.dataset.open = 'false';
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(() => {
        content.style.maxHeight = '0px';
      });
    }
  };

  const toggleSection = (toggle, force) => {
    const contentId = toggle.getAttribute('aria-controls');
    const content = contentId ? document.getElementById(contentId) : null;
    if (!content) return;
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    const shouldExpand = typeof force === 'boolean' ? force : !isExpanded;
    toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    toggle.classList.toggle('is-open', shouldExpand);
    setContentHeight(content, shouldExpand);
  };

  const updateAllSectionHeights = () => {
    sectionToggles.forEach((toggle) => {
      const contentId = toggle.getAttribute('aria-controls');
      const content = contentId ? document.getElementById(contentId) : null;
      if (!content) return;
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      if (prefersReducedMotion()) {
        content.style.maxHeight = isExpanded ? 'none' : '0px';
      } else if (isExpanded) {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  };

  sectionToggles.forEach((toggle) => {
    const contentId = toggle.getAttribute('aria-controls');
    const content = contentId ? document.getElementById(contentId) : null;
    if (!content) return;
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    content.dataset.open = 'true';
    if (!prefersReducedMotion()) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
    toggle.addEventListener('click', () => toggleSection(toggle));
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateAllSectionHeights, 150);
  });

  tocToggles.forEach((button) => {
    const targetId = button.getAttribute('aria-controls');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      button.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      button.classList.toggle('is-open', nextState);
      if (nextState) {
        target.removeAttribute('hidden');
      } else {
        target.setAttribute('hidden', '');
      }
    });
  });

  const closeMobileToc = () => {
    if (!mobileTocToggle || !mobileTocPanel) return;
    mobileTocToggle.setAttribute('aria-expanded', 'false');
    mobileTocToggle.classList.remove('is-open');
    mobileTocPanel.setAttribute('hidden', '');
  };

  if (mobileTocToggle && mobileTocPanel) {
    mobileTocToggle.addEventListener('click', () => {
      const expanded = mobileTocToggle.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      mobileTocToggle.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      mobileTocToggle.classList.toggle('is-open', nextState);
      if (nextState) {
        mobileTocPanel.removeAttribute('hidden');
      } else {
        mobileTocPanel.setAttribute('hidden', '');
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 900) {
        closeMobileToc();
      }
    });
  }

  tocLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.hash ? link.hash.slice(1) : '';
      if (targetId) {
        const matchingToggle = sectionToggles.find((btn) => btn.dataset.section === targetId);
        if (matchingToggle) {
          const isExpanded = matchingToggle.getAttribute('aria-expanded') === 'true';
          if (!isExpanded) {
            toggleSection(matchingToggle, true);
          }
        }
      }
      closeMobileToc();
    });
  });
})();
