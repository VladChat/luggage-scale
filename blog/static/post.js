(function () {
  const accordion = document.querySelector('[data-accordion]');
  if (!accordion) return;

  const triggers = Array.from(
    accordion.querySelectorAll('[data-accordion-trigger]')
  );
  if (!triggers.length) return;

  const controls = document.querySelector('[data-accordion-controls]');
  const expandAllButton = controls
    ? controls.querySelector('[data-accordion-expand-all]')
    : null;
  const collapseAllButton = controls
    ? controls.querySelector('[data-accordion-collapse-all]')
    : null;

  const faqElement = accordion.querySelector('[data-faq]');
  const faqButtons = faqElement
    ? Array.from(faqElement.querySelectorAll('.faq-question'))
    : [];

  const reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  const prefersReducedMotion = () =>
    Boolean(reduceMotionQuery && reduceMotionQuery.matches);

  const getSectionElement = (trigger) =>
    trigger ? trigger.closest('[data-post-section]') : null;

  const getPanelContent = (panel) =>
    panel ? panel.querySelector('.post-section__panel-inner') || panel : null;

  const getStickyHeaderOffset = () => {
    const defaultHeight = 72;
    const gap = 12;
    const root = document.documentElement;
    if (!root || typeof window.getComputedStyle !== 'function') {
      return defaultHeight + gap;
    }
    const style = window.getComputedStyle(root);
    if (!style) {
      return defaultHeight + gap;
    }
    const parsed = parseFloat(style.getPropertyValue('--sticky-header-height'));
    const headerHeight = Number.isNaN(parsed) ? defaultHeight : parsed;
    return headerHeight + gap;
  };

  const isContentTopFullyVisible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= getStickyHeaderOffset();
  };

  const scrollContentIntoView = (element, { behavior } = {}) => {
    if (!element || typeof element.scrollIntoView !== 'function') {
      return;
    }
    if (isContentTopFullyVisible(element)) {
      return;
    }
    const scrollBehavior =
      behavior || (prefersReducedMotion() ? 'auto' : 'smooth');
    element.scrollIntoView({ block: 'start', behavior: scrollBehavior });
  };

  const scheduleScrollToElement = (element, options = {}) => {
    if (!element) return;
    const { behavior } = options;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollContentIntoView(element, { behavior });
      });
    });
  };

  const scheduleScrollToContent = (panel, options = {}) => {
    const contentEl = getPanelContent(panel);
    if (!contentEl) return;
    scheduleScrollToElement(contentEl, options);
  };

  const getPanel = (trigger) => {
    const controls = trigger.getAttribute('aria-controls');
    return controls ? document.getElementById(controls) : null;
  };

  const setExpanded = (trigger, expand, options = {}) => {
    const panel = getPanel(trigger);
    const sectionElement = getSectionElement(trigger);
    if (!panel) {
      if (sectionElement) {
        sectionElement.dataset.open = expand ? 'true' : 'false';
      }
      return;
    }

    const { immediate = false, force = false } = options;
    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
    if (!force && wasExpanded === expand) {
      return;
    }

    trigger.setAttribute('aria-expanded', expand ? 'true' : 'false');
    trigger.classList.toggle('is-open', expand);

    panel.dataset.open = expand ? 'true' : 'false';
    panel.setAttribute('aria-hidden', expand ? 'false' : 'true');
    if (sectionElement) {
      sectionElement.dataset.open = expand ? 'true' : 'false';
    }

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

  const getFaqAnswer = (button) => {
    const controls = button.getAttribute('aria-controls');
    return controls ? document.getElementById(controls) : null;
  };

  const setFaqExpanded = (button, expand, options = {}) => {
    if (!button) return;
    const answer = getFaqAnswer(button);
    if (!answer) return;

    const { force = false, scroll = false, behavior } = options;
    const wasExpanded = button.getAttribute('aria-expanded') === 'true';
    if (!force && wasExpanded === expand) {
      return;
    }

    button.setAttribute('aria-expanded', expand ? 'true' : 'false');
    button.classList.toggle('is-open', expand);

    if (expand) {
      answer.removeAttribute('hidden');
    } else {
      answer.setAttribute('hidden', '');
    }
    answer.setAttribute('aria-hidden', expand ? 'false' : 'true');

    if (expand && scroll) {
      scheduleScrollToElement(answer, {
        behavior: behavior || (prefersReducedMotion() ? 'auto' : 'smooth'),
      });
    }
  };

  const focusFaqButtonAt = (index) => {
    if (!faqButtons.length) return;
    const total = faqButtons.length;
    const nextIndex = (index + total) % total;
    const target = faqButtons[nextIndex];
    if (target) {
      target.focus();
    }
  };

  const handleFaqKeyDown = (event) => {
    const { key } = event;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const index = faqButtons.indexOf(event.currentTarget);
    if (index < 0) return;

    if (key === 'ArrowDown') {
      focusFaqButtonAt(index + 1);
    } else if (key === 'ArrowUp') {
      focusFaqButtonAt(index - 1);
    } else if (key === 'Home') {
      focusFaqButtonAt(0);
    } else if (key === 'End') {
      focusFaqButtonAt(faqButtons.length - 1);
    }
  };

  const openFaqFromHash = (
    hash,
    { scroll = false, immediate = false, focus = false } = {}
  ) => {
    if (!faqButtons.length || !hash) return false;
    const raw = hash.replace('#', '');
    if (!raw) return false;

    const slug = raw.startsWith('faq-') ? raw.slice(4) : raw;
    const targetButton = faqButtons.find(
      (btn) => btn.dataset.faqQuestion === slug
    );

    const faqTrigger = triggers.find((btn) => btn.dataset.section === 'faq');
    if (raw === 'faq' && faqTrigger) {
      collapseAll(faqTrigger, { immediate });
      setExpanded(faqTrigger, true, { immediate, force: true });
      if (scroll) {
        const panel = getPanel(faqTrigger);
        const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
        if (panel) {
          scheduleScrollToContent(panel, { behavior });
        }
      }
      if (focus) {
        requestAnimationFrame(() => {
          faqTrigger.focus();
        });
      }
      return true;
    }

    if (!targetButton) return false;

    if (faqTrigger) {
      collapseAll(faqTrigger, { immediate });
      setExpanded(faqTrigger, true, { immediate, force: true });
    }

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    setFaqExpanded(targetButton, true, {
      force: true,
      scroll,
      behavior,
    });

    if (focus) {
      requestAnimationFrame(() => {
        targetButton.focus();
      });
    }

    return true;
  };

  const openFromHash = (hash, options = {}) => {
    if (!hash) return false;
    const targetId = hash.replace('#', '');
    if (!targetId) return false;
    const trigger = triggers.find((btn) => btn.dataset.section === targetId);
    if (trigger) {
      const sectionElement = getSectionElement(trigger);
      const panel = getPanel(trigger);
      collapseAll(trigger, { immediate: options.immediate });
      setExpanded(trigger, true, { immediate: options.immediate, force: true });

      if (options.scroll) {
        const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
        if (panel) {
          scheduleScrollToContent(panel, { behavior });
        } else if (sectionElement) {
          scrollContentIntoView(sectionElement, { behavior });
        } else {
          const heading = document.getElementById(targetId);
          if (heading && typeof heading.scrollIntoView === 'function') {
            heading.scrollIntoView({ behavior, block: 'start' });
          }
        }
      }

      return true;
    }

    return openFaqFromHash(hash, {
      scroll: options.scroll,
      immediate: options.immediate,
      focus: true,
    });
  };

  const handleToggle = (trigger) => {
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;
    setExpanded(trigger, nextState, { force: true });
    if (nextState) {
      const panel = getPanel(trigger);
      scheduleScrollToContent(panel);
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
    const sectionElement = getSectionElement(trigger);
    if (sectionElement) {
      sectionElement.dataset.open = 'true';
    }

    trigger.addEventListener('click', () => handleToggle(trigger));
    trigger.addEventListener('keydown', handleKeyDown);

    panel.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'max-height') return;
      if (panel.dataset.open === 'true' && !prefersReducedMotion()) {
        panel.style.maxHeight = 'none';
      }
    });
  });

  const setAllSections = (expand) => {
    triggers.forEach((trigger) => {
      setExpanded(trigger, expand, { immediate: true, force: true });
    });
    if (!expand && faqButtons.length) {
      faqButtons.forEach((button) => {
        setFaqExpanded(button, false, { force: true });
      });
    }
  };

  if (expandAllButton) {
    expandAllButton.addEventListener('click', () => {
      setAllSections(true);
    });
  }

  if (collapseAllButton) {
    collapseAllButton.addEventListener('click', () => {
      setAllSections(false);
    });
  }

  if (faqButtons.length) {
    faqButtons.forEach((button) => {
      setFaqExpanded(button, false, { force: true });
      button.addEventListener('click', () => {
        const nextState = button.getAttribute('aria-expanded') !== 'true';
        setFaqExpanded(button, nextState, {
          force: true,
          scroll: nextState,
        });
      });
      button.addEventListener('keydown', handleFaqKeyDown);
    });
  }

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
