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

  // Улучшенный парсер: извлекает Q/A даже из HTML (<p>, <br> и т.п.)
  function extractQAFromHTML(html) {
    const text = html
      .replace(/<\/p>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .trim();
    const parts = text.split(/(?=\bQ\s*:)/i);
    const qa = [];
    for (const part of parts) {
      const match = part.match(/Q\s*:\s*(.+?)(?:\s*A\s*:\s*([\s\S]+))?$/i);
      if (match) {
        const q = match[1].trim();
        const a = (match[2] || '').trim();
        if (q && a) qa.push({ q, a });
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
      btn.innerHTML = `<h3 class="label"><strong style="font-size:1.5em;line-height:1;margin-right:.4rem;">Q</strong>${escapeHTML(item.q)}</h3><span class="mark">+</span>`;
      const aWrap = document.createElement('div');
      aWrap.className = 'faq-a';
      const inner = document.createElement('div');
      inner.className = 'faq-a-inner';
      inner.innerHTML = `<p>${escapeHTML(item.a)}</p>`;
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