(function () {
  const reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  const prefersReducedMotion = () =>
    Boolean(reduceMotionQuery && reduceMotionQuery.matches);

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

  const getPanelContent = (panel) => {
    if (!panel) return null;
    const explicit = panel.querySelector('[data-accordion-panel-content]');
    if (explicit) return explicit;
    if (panel.classList.contains('post-section__panel')) {
      const inner = panel.querySelector('.post-section__panel-inner');
      if (inner) return inner;
    }
    return panel;
  };

  const isContentTopFullyVisible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.top >= getStickyHeaderOffset();
  };

  const scrollContentIntoView = (element, behavior) => {
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

  const scheduleScrollToContent = (panel, options = {}) => {
    const contentEl = getPanelContent(panel);
    if (!contentEl) return;
    const { behavior } = options;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollContentIntoView(contentEl, behavior);
      });
    });
  };

  const initAccordion = (accordion) => {
    if (!accordion) return null;
    const id = accordion.getAttribute('data-accordion-id') || '';
    const type = accordion.getAttribute('data-accordion') || '';
    const exclusive = accordion.getAttribute('data-accordion-exclusive') === 'true';
    const triggers = Array.from(
      accordion.querySelectorAll('[data-accordion-trigger]')
    );
    if (!triggers.length) return null;

    const animatePanel = type === 'primary';
    let allowMany = false;

    const getItem = (trigger) =>
      trigger ? trigger.closest('[data-accordion-item]') : null;

    const getPanel = (trigger) => {
      const controls = trigger.getAttribute('aria-controls');
      return controls ? document.getElementById(controls) : null;
    };

    const setExpanded = (trigger, expand, options = {}) => {
      const panel = getPanel(trigger);
      const item = getItem(trigger);
      if (!panel && !item) {
        return;
      }

      const { immediate = false, force = false, scroll = false, behavior } =
        options;
      const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
      if (!force && wasExpanded === expand) {
        return;
      }

      trigger.setAttribute('aria-expanded', expand ? 'true' : 'false');
      trigger.classList.toggle('is-open', expand);

      if (item) {
        item.dataset.open = expand ? 'true' : 'false';
      }

      if (panel) {
        panel.dataset.open = expand ? 'true' : 'false';
        panel.setAttribute('aria-hidden', expand ? 'false' : 'true');

        if (!animatePanel) {
          panel.style.maxHeight = '';
          panel.style.opacity = '';
          if (expand) {
            panel.removeAttribute('hidden');
          } else {
            panel.setAttribute('hidden', '');
          }
        } else {
          panel.removeAttribute('hidden');
          const skipAnimation = immediate || prefersReducedMotion();
          if (skipAnimation) {
            panel.style.transitionDuration = '0ms';
            panel.style.maxHeight = expand ? 'none' : '0px';
            panel.style.opacity = expand ? '1' : '0';
            requestAnimationFrame(() => {
              panel.style.transitionDuration = '';
            });
          } else if (expand) {
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
        }

        if (scroll && expand) {
          scheduleScrollToContent(panel, { behavior });
        }
      }
    };

    const ensureExclusiveMode = () => {
      if (!exclusive) return;
      allowMany = false;
      delete accordion.dataset.allOpen;
    };

    const collapseOthers = (exceptTrigger, options = {}) => {
      if (!exclusive || allowMany) return;
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

    const toggle = (trigger, { scrollOnOpen = true } = {}) => {
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      const nextState = !isExpanded;
      if (nextState && !allowMany) {
        collapseOthers(trigger);
      }
      setExpanded(trigger, nextState, {
        force: true,
        scroll: scrollOnOpen,
      });
    };

    const handleKeyDown = (event) => {
      const { key } = event;
      if (
        ![
          'ArrowDown',
          'ArrowUp',
          'Home',
          'End',
          'Enter',
          ' ',
        ].includes(key)
      ) {
        return;
      }

      const trigger = event.currentTarget;
      const index = triggers.indexOf(trigger);
      if (index < 0) return;

      if (key === 'ArrowDown') {
        event.preventDefault();
        focusTriggerAt(index + 1);
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        focusTriggerAt(index - 1);
      } else if (key === 'Home') {
        event.preventDefault();
        focusTriggerAt(0);
      } else if (key === 'End') {
        event.preventDefault();
        focusTriggerAt(triggers.length - 1);
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        toggle(trigger, { scrollOnOpen: true });
      }
    };

    triggers.forEach((trigger) => {
      const panel = getPanel(trigger);
      const item = getItem(trigger);
      if (panel) {
        panel.dataset.open = 'true';
        panel.setAttribute('aria-hidden', 'false');
        panel.removeAttribute('hidden');
      }
      if (item) {
        item.dataset.open = 'true';
      }
      trigger.addEventListener('click', () => toggle(trigger));
      trigger.addEventListener('keydown', handleKeyDown);
    });

    requestAnimationFrame(() => {
      triggers.forEach((trigger) => {
        setExpanded(trigger, false, { immediate: true, force: true });
      });
    });

    const expandAll = () => {
      allowMany = true;
      accordion.dataset.allOpen = 'true';
      triggers.forEach((trigger) => {
        setExpanded(trigger, true, { force: true });
      });
    };

    const collapseAll = () => {
      ensureExclusiveMode();
      triggers.forEach((trigger) => {
        setExpanded(trigger, false, { force: true });
      });
    };

    const findTriggerBySection = (sectionId) =>
      triggers.find((trigger) => trigger.dataset.section === sectionId);

    const findTriggerById = (triggerId) =>
      triggers.find((trigger) => trigger.id === triggerId);

    return {
      id,
      type,
      element: accordion,
      triggers,
      setExpanded,
      expandAll,
      collapseAll,
      collapseOthers,
      ensureExclusiveMode,
      findTriggerBySection,
      findTriggerById,
    };
  };

  const accordions = Array.from(document.querySelectorAll('[data-accordion]'));
  const instances = new Map();

  accordions.forEach((accordion) => {
    const instance = initAccordion(accordion);
    if (!instance) return;
    const key = instance.id || instance.type || Symbol();
    instances.set(key, instance);
  });

  const getInstanceById = (id) => {
    if (!id) return null;
    if (instances.has(id)) {
      return instances.get(id);
    }
    for (const instance of instances.values()) {
      if (instance.id === id || instance.type === id) {
        return instance;
      }
    }
    return null;
  };

  const primaryInstance = getInstanceById('primary');
  const faqInstance = getInstanceById('faq');

  const controls = Array.from(
    document.querySelectorAll('[data-accordion-controls]')
  );
  controls.forEach((controlEl) => {
    const targetId = controlEl.getAttribute('data-accordion-controls');
    const instance = getInstanceById(targetId);
    if (!instance) return;

    const expandBtn = controlEl.querySelector(
      '[data-accordion-control="expand"]'
    );
    const collapseBtn = controlEl.querySelector(
      '[data-accordion-control="collapse"]'
    );

    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        instance.expandAll();
      });
    }

    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        instance.collapseAll();
      });
    }
  });

  const openFromHash = (hash, { immediate = false, scroll = false } = {}) => {
    if (!hash) return false;
    const targetId = hash.replace('#', '');
    if (!targetId) return false;

    if (primaryInstance) {
      const sectionTrigger = primaryInstance.findTriggerBySection(targetId);
      if (sectionTrigger) {
        if (primaryInstance.ensureExclusiveMode) {
          primaryInstance.ensureExclusiveMode();
        }
        primaryInstance.collapseOthers(sectionTrigger, { immediate });
        primaryInstance.setExpanded(sectionTrigger, true, {
          immediate,
          force: true,
          scroll,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        return true;
      }
    }

    if (targetId.startsWith('faq-')) {
      const buttonId = `${targetId}-btn`;
      const panelId = `${targetId}-panel`;
      const button = document.getElementById(buttonId);
      const panel = document.getElementById(panelId);
      if (button && panel) {
        if (primaryInstance) {
          const faqTrigger = primaryInstance.findTriggerBySection('faq');
          if (faqTrigger) {
            primaryInstance.collapseOthers(faqTrigger, { immediate: true });
            primaryInstance.setExpanded(faqTrigger, true, {
              immediate,
              force: true,
            });
          }
        }

        if (faqInstance) {
          faqInstance.setExpanded(button, true, {
            immediate,
            force: true,
            scroll,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
        } else {
          button.setAttribute('aria-expanded', 'true');
          panel.dataset.open = 'true';
          panel.setAttribute('aria-hidden', 'false');
          panel.removeAttribute('hidden');
        }

        requestAnimationFrame(() => {
          button.focus({ preventScroll: true });
          if (scroll) {
            const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
            scheduleScrollToContent(panel, { behavior });
          }
        });

        return true;
      }
    }

    return false;
  };

  requestAnimationFrame(() => {
    openFromHash(window.location.hash, { immediate: true, scroll: true });
  });

  window.addEventListener('hashchange', () => {
    openFromHash(window.location.hash, { scroll: true });
  });

  const handleMotionChange = () => {
    instances.forEach((instance) => {
      instance.triggers.forEach((trigger) => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        instance.setExpanded(trigger, expanded, {
          immediate: true,
          force: true,
        });
      });
    });
  };

  if (reduceMotionQuery) {
    if (typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof reduceMotionQuery.addListener === 'function') {
      reduceMotionQuery.addListener(handleMotionChange);
    }
  }
})();
