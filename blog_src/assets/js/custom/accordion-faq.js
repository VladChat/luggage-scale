(function () {
  const i18nFAQ = /(faq|frequently\s+asked\s+questions|вопросы|вопрос-ответ)/i;

  function findFAQContainer() {
    const root = document.querySelector('.post-content');
    if (!root) return null;
    const secs = root.querySelectorAll('.accordion-section');
    for (const sec of secs) {
      const header = sec.querySelector('.accordion-header');
      if (header && i18nFAQ.test((header.textContent || '').trim())) {
        return sec.querySelector('.accordion-content') || sec;
      }
    }
    return null;
  }

  // --- FIXED: устойчивый парсер Q:/A: с поддержкой заголовков "Q:" на отдельной строке ---
  function extractQAFromHTML(html) {
    // 1) Превращаем <p> и <br> в \n, убираем прочие теги
    let text = (html || '')
      .replace(/<\/p>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ') // NBSP -> space
      .trim();

    // 2) Нормализуем многострочные отступы
    text = text
      .replace(/[ \t]+\n/g, '\n') // хвостовые пробелы перед переносами
      .replace(/\n{3,}/g, '\n\n') // слишком много пустых строк -> двойной перенос
      .trim();

    // 3) Регэксп, который выдёргивает каждую пару Q/A, останавливаясь перед след. Q: или концом
    // Поддерживает:
    //   Q:
    //   Вопрос здесь...
    //   A:
    //   Ответ здесь...
    //
    // и компактный вариант:
    //   Q: Вопрос здесь... A: Ответ здесь...
    const re = /(?:^|\n)\s*Q\s*:\s*([\s\S]*?)(?:\n+|\s+)A\s*:\s*([\s\S]*?)(?=\n\s*Q\s*:|$)/gi;

    const qa = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const q = (m[1] || '').trim().replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
      const a = (m[2] || '').trim().replace(/\n{2,}/g, '\n').replace(/[ \t]{2,}/g, ' ');
      if (q && a) qa.push({ q, a });
    }

    // Фолбэк: если по какой-то причине ничего не собрано, пробуем старую мягкую схему
    if (!qa.length) {
      const softParts = text.split(/(?=\bQ\s*:)/i);
      for (const part of softParts) {
        const m2 = part.match(/Q\s*:\s*([\s\S]*?)(?:\n+|\s+)A\s*:\s*([\s\S]*?)$/i);
        if (m2) {
          const q2 = (m2[1] || '').trim().replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
          const a2 = (m2[2] || '').trim().replace(/\n{2,}/g, '\n').replace(/[ \t]{2,}/g, ' ');
          if (q2 && a2) qa.push({ q: q2, a: a2 });
        }
      }
    }

    return qa;
  }

  function buildAccordion(qa) {
    const acc = document.createElement('div');
    acc.className = 'faq-accordion';
    qa.forEach((item, idx) => {
      const it = document.createElement('div');
      it.className = 'faq-item' + (idx === 0 ? ' open' : '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'faq-q';
      btn.setAttribute('aria-expanded', idx === 0 ? 'true' : 'false');
      btn.innerHTML =
        `<h3 class="label"><strong style="font-size:1.5em;line-height:1;margin-right:.4rem;">Q</strong>${escapeHTML(item.q)}</h3><span class="mark">+</span>`;
      const aWrap = document.createElement('div');
      aWrap.className = 'faq-a';
      const inner = document.createElement('div');
      inner.className = 'faq-a-inner';
      // Ответ может содержать переносы строк — превращаем в <p> с br
      const safeA = escapeHTML(item.a).replace(/\n/g, '<br>');
      inner.innerHTML = `<p>${safeA}</p>`;
      aWrap.appendChild(inner);
      requestAnimationFrame(() => {
        aWrap.style.maxHeight = idx === 0 ? (inner.scrollHeight + 2) + 'px' : '0px';
      });
      btn.addEventListener('click', () => {
        const isOpen = it.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        aWrap.style.maxHeight = isOpen ? (inner.scrollHeight + 2) + 'px' : '0px';
        acc.querySelectorAll('.faq-item').forEach(other => {
          if (other !== it) {
            other.classList.remove('open');
            const oPanel = other.querySelector('.faq-a');
            const oBtn = other.querySelector('.faq-q');
            if (oPanel) oPanel.style.maxHeight = '0px';
            if (oBtn) oBtn.setAttribute('aria-expanded', 'false');
          }
        });
      });
      it.appendChild(btn);
      it.appendChild(aWrap);
      acc.appendChild(it);
    });
    const recalc = () => {
      acc.querySelectorAll('.faq-item.open .faq-a-inner').forEach(inner => {
        const wrap = inner.parentElement;
        wrap.style.maxHeight = (inner.scrollHeight + 2) + 'px';
      });
    };
    window.addEventListener('resize', recalc, { passive: true });
    acc.querySelectorAll('img').forEach(img => img.addEventListener('load', recalc, { once: true }));
    return acc;
  }

  function injectJSONLD(qa) {
    if (!qa.length) return;
    // Не дублируем, если уже вставлен
    const prev = document.getElementById('auto-faq-jsonld');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    const ld = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": qa.map(x => ({
        "@type": "Question",
        "name": x.q,
        "acceptedAnswer": { "@type": "Answer", "text": x.a }
      }))
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'auto-faq-jsonld';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  function escapeHTML(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', function () {
    const container = findFAQContainer();
    if (!container) return;
    const html = container.innerHTML || '';
    const qa = extractQAFromHTML(html);
    if (!qa.length) return;
    const acc = buildAccordion(qa);
    container.innerHTML = '';
    container.appendChild(acc);
    injectJSONLD(qa);
  });
})();
