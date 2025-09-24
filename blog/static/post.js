(function () {
  const accordion = document.querySelector('[data-accordion]');
  if (!accordion) return;

  const triggers = Array.from(
    accordion.querySelectorAll('[data-accordion-trigger]')
  );
  if (!triggers.length) return;

  const sectionAliasMap = new Map([
    ['how-it-works-portable-luggage-scale', 'how-it-works'],
  ]);

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

  const createFaqAccordion = (container) => {
    const items = Array.from(container.querySelectorAll('[data-faq-item]'));
    if (!items.length) return null;

    const faqTriggers = items
      .map((item) => item.querySelector('[data-faq-trigger]'))
      .filter(Boolean);

    const aliasMap = new Map();
    items.forEach((item) => {
      const canonicalId = item.dataset.faqId;
      if (!canonicalId) return;
      aliasMap.set(canonicalId, canonicalId);
      const aliases = (item.dataset.faqAliases || '')
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean);
      aliases.forEach((alias) => aliasMap.set(alias, canonicalId));
    });

    const getPanel = (trigger) => {
      const controls = trigger.getAttribute('aria-controls');
      return controls ? document.getElementById(controls) : null;
    };

    const setFaqExpanded = (trigger, expand, options = {}) => {
      const panel = getPanel(trigger);
      if (!panel) return;

      const { immediate = false, force = false } = options;
      const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
      if (!force && wasExpanded === expand) {
        return;
      }

      trigger.setAttribute('aria-expanded', expand ? 'true' : 'false');

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

    const focusFaqTriggerAt = (index) => {
      if (!faqTriggers.length) return;
      const total = faqTriggers.length;
      const nextIndex = (index + total) % total;
      const target = faqTriggers[nextIndex];
      if (target) {
        target.focus();
      }
    };

    const handleFaqKeyDown = (event) => {
      const { key } = event;
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;

      event.preventDefault();
      const index = faqTriggers.indexOf(event.currentTarget);
      if (index < 0) return;

      if (key === 'ArrowDown') {
        focusFaqTriggerAt(index + 1);
      } else if (key === 'ArrowUp') {
        focusFaqTriggerAt(index - 1);
      } else if (key === 'Home') {
        focusFaqTriggerAt(0);
      } else if (key === 'End') {
        focusFaqTriggerAt(faqTriggers.length - 1);
      }
    };

    faqTriggers.forEach((trigger) => {
      const panel = getPanel(trigger);
      if (!panel) return;

      panel.dataset.open = 'true';
      panel.setAttribute('aria-hidden', 'false');

      trigger.addEventListener('click', () => {
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        setFaqExpanded(trigger, !isExpanded, { force: true });
      });

      trigger.addEventListener('keydown', handleFaqKeyDown);

      panel.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'max-height') return;
        if (panel.dataset.open === 'true' && !prefersReducedMotion()) {
          panel.style.maxHeight = 'none';
        }
      });
    });

    const updateExpandedHeights = () => {
      faqTriggers.forEach((trigger) => {
        const panel = getPanel(trigger);
        if (!panel) return;
        if (trigger.getAttribute('aria-expanded') === 'true') {
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

    const handleMotionChange = () => {
      faqTriggers.forEach((trigger) => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        setFaqExpanded(trigger, expanded, { immediate: true, force: true });
      });
    };

    requestAnimationFrame(() => {
      faqTriggers.forEach((trigger) => {
        setFaqExpanded(trigger, false, { immediate: true, force: true });
      });
    });

    const scrollToAnchor = (id) => {
      const anchor = document.getElementById(id);
      if (!anchor) return false;
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      anchor.scrollIntoView({ behavior, block: 'start' });
      if (typeof anchor.focus === 'function') {
        requestAnimationFrame(() => {
          anchor.focus({ preventScroll: true });
        });
      }
      return true;
    };

    const openFromHash = (
      hashId,
      { scroll = false, immediate = false, ensureSection } = {}
    ) => {
      const canonical = aliasMap.get(hashId);
      if (!canonical) return false;
      const trigger = faqTriggers.find((btn) => {
        const item = btn.closest('[data-faq-item]');
        return item && item.dataset.faqId === canonical;
      });
      if (!trigger) return false;

      if (typeof ensureSection === 'function') {
        ensureSection();
      }

      setFaqExpanded(trigger, true, { immediate, force: true });

      if (scroll) {
        if (!scrollToAnchor(hashId)) {
          scrollToAnchor(canonical);
        }
      }

      return true;
    };

    return {
      isFaqHash: (id) => aliasMap.has(id),
      openFromHash,
      updateExpandedHeights,
      handleMotionChange,
    };
  };

  const faqContainer = accordion.querySelector('[data-faq-accordion]');
  const faqController = faqContainer ? createFaqAccordion(faqContainer) : null;

  const openSectionById = (
    sectionId,
    { scroll = false, immediate = false, focusId } = {}
  ) => {
    const trigger = triggers.find((btn) => btn.dataset.section === sectionId);
    if (!trigger) return false;

    const sectionElement = getSectionElement(trigger);
    collapseAll(trigger, { immediate });
    setExpanded(trigger, true, { immediate, force: true });

    if (scroll) {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      const focusTargetId = focusId || null;
      const fallbackTarget = document.getElementById(sectionId);

      if (sectionElement) {
        scrollSectionIntoView(sectionElement, { behavior });
      } else if (fallbackTarget && typeof fallbackTarget.scrollIntoView === 'function') {
        fallbackTarget.scrollIntoView({ behavior, block: 'start' });
      }

      if (focusTargetId) {
        const focusTarget = document.getElementById(focusTargetId);
        if (focusTarget && typeof focusTarget.focus === 'function') {
          requestAnimationFrame(() => {
            focusTarget.focus({ preventScroll: true });
          });
        }
      }
    }

    return true;
  };

  const openFromHash = (hash, { scroll = false, immediate = false } = {}) => {
    if (!hash) return false;
    const targetId = hash.replace('#', '');
    if (!targetId) return false;

    if (faqController && faqController.isFaqHash(targetId)) {
      return faqController.openFromHash(targetId, {
        scroll,
        immediate,
        ensureSection: () =>
          openSectionById('faq', { immediate, scroll: false }),
      });
    }

    const canonicalId = sectionAliasMap.get(targetId) || targetId;
    const focusId = canonicalId !== targetId ? targetId : undefined;

    return openSectionById(canonicalId, {
      scroll,
      immediate,
      focusId,
    });
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
    if (faqController) {
      faqController.updateExpandedHeights();
    }
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
    if (faqController) {
      faqController.handleMotionChange();
    }
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
