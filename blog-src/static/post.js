(function () {
  const accordion = document.querySelector('[data-accordion]');
  if (!accordion) return;

  const triggers = Array.from(
    accordion.querySelectorAll('[data-accordion-trigger]')
  );
  if (!triggers.length) return;

  const reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  const prefersReducedMotion = () =>
    Boolean(reduceMotionQuery && reduceMotionQuery.matches);

  const getSectionElement = (trigger) =>
    trigger ? trigger.closest('[data-post-section]') : null;

  const isElementTopInViewport = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.top >= 0 && rect.top <= viewportHeight;
  };

  const scrollSectionIntoView = (sectionEl, { behavior } = {}) => {
    if (!sectionEl || typeof sectionEl.scrollIntoView !== 'function') {
      return;
    }
    if (isElementTopInViewport(sectionEl)) {
      return;
    }
    const scrollBehavior =
      behavior || (prefersReducedMotion() ? 'auto' : 'smooth');
    sectionEl.scrollIntoView({ block: 'start', behavior: scrollBehavior });
  };

  const getPanel = (trigger) => {
    const controls = trigger.getAttribute('aria-controls');
    return controls ? document.getElementById(controls) : null;
  };

  const setExpanded = (trigger, expand, options = {}) => {
    const panel = getPanel(trigger);
    if (!panel) return;

    const { immediate = false, force = false } = options;
    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
    if (!force && wasExpanded === expand) {
      return;
    }

    trigger.setAttribute('aria-expanded', expand ? 'true' : 'false');
    trigger.classList.toggle('is-open', expand);

    panel.dataset.open = expand ? 'true' : 'false';
    panel.setAttribute('aria-hidden', expand ? 'false' : 'true');

    const skipAnimation = immediate || prefersReducedMotion();

    if (skipAnimation) {
      panel.style.transitionDuration = '0ms';
      panel.style.maxHeight = expand ? 'none' : '0px';
      panel.style.opacity = expand ? '1' : '0';
      requestAnimationFrame(() => {
        panel.style.transitionDuration = '';
      });
      return;
    }

    if (expand) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      panel.style.opacity = '1';
      const finalize = (event) => {
        if (event.propertyName !== 'max-height') return;
        if (panel.dataset.open === 'true') {
          panel.style.maxHeight = 'none';
        }
        panel.removeEventListener('transitionend', finalize);
      };
      panel.addEventListener('transitionend', finalize);
    } else {
      if (panel.style.maxHeight === 'none' || !panel.style.maxHeight) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
      panel.style.opacity = '0';
      requestAnimationFrame(() => {
        panel.style.maxHeight = '0px';
      });
    }
  };

  const collapseAll = (exceptTrigger, options = {}) => {
    triggers.forEach((trigger) => {
      if (trigger === exceptTrigger) return;
      setExpanded(trigger, false, { ...options, force: true });
    });
  };

  const focusTriggerAt = (index) => {
    if (!triggers.length) return;
    const total = triggers.length;
    const nextIndex = (index + total) % total;
    const target = triggers[nextIndex];
    if (target) {
      target.focus();
    }
  };

  const openFromHash = (hash, { scroll = false, immediate = false } = {}) => {
    if (!hash) return false;
    const targetId = hash.replace('#', '');
    if (!targetId) return false;
    const trigger = triggers.find((btn) => btn.dataset.section === targetId);
    if (!trigger) return false;

    const sectionElement = getSectionElement(trigger);
    collapseAll(trigger, { immediate });
    setExpanded(trigger, true, { immediate, force: true });

    if (scroll) {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      if (sectionElement) {
        scrollSectionIntoView(sectionElement, { behavior });
      } else {
        const heading = document.getElementById(targetId);
        if (heading && typeof heading.scrollIntoView === 'function') {
          heading.scrollIntoView({ behavior, block: 'start' });
        }
      }
    }

    return true;
  };

  const handleToggle = (trigger) => {
    const sectionElement = getSectionElement(trigger);
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;
    if (nextState) {
      collapseAll(trigger);
    }
    setExpanded(trigger, nextState, { force: true });
    if (nextState) {
      scrollSectionIntoView(sectionElement);
    }
  };

  const handleKeyDown = (event) => {
    const { key } = event;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;

    event.preventDefault();
    const index = triggers.indexOf(event.currentTarget);
    if (index < 0) return;

    if (key === 'ArrowDown') {
      focusTriggerAt(index + 1);
    } else if (key === 'ArrowUp') {
      focusTriggerAt(index - 1);
    } else if (key === 'Home') {
      focusTriggerAt(0);
    } else if (key === 'End') {
      focusTriggerAt(triggers.length - 1);
    }
  };

  const updateExpandedHeights = () => {
    triggers.forEach((trigger) => {
      const panel = getPanel(trigger);
      if (!panel) return;
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        if (prefersReducedMotion()) {
          panel.style.maxHeight = 'none';
        } else {
          panel.style.maxHeight = panel.scrollHeight + 'px';
          requestAnimationFrame(() => {
            if (panel.dataset.open === 'true') {
              panel.style.maxHeight = 'none';
            }
          });
        }
      }
    });
  };

  triggers.forEach((trigger) => {
    const panel = getPanel(trigger);
    if (!panel) return;
    panel.dataset.open = 'true';
    panel.setAttribute('aria-hidden', 'false');

    trigger.addEventListener('click', () => handleToggle(trigger));
    trigger.addEventListener('keydown', handleKeyDown);

    panel.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'max-height') return;
      if (panel.dataset.open === 'true' && !prefersReducedMotion()) {
        panel.style.maxHeight = 'none';
      }
    });
  });

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(updateExpandedHeights);
  });

  const handleMotionChange = () => {
    triggers.forEach((trigger) => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      setExpanded(trigger, expanded, { immediate: true, force: true });
    });
  };

  if (reduceMotionQuery) {
    if (typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof reduceMotionQuery.addListener === 'function') {
      reduceMotionQuery.addListener(handleMotionChange);
    }
  }

  requestAnimationFrame(() => {
    triggers.forEach((trigger) => {
      setExpanded(trigger, false, { immediate: true, force: true });
    });
    openFromHash(window.location.hash, { immediate: true, scroll: true });
  });

  window.addEventListener('hashchange', () => {
    openFromHash(window.location.hash, { scroll: true });
  });
})();
