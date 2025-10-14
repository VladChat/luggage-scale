/* Удаляем префикс "H3:" (и вариации) только если он стоит в начале заголовка */
document.addEventListener('DOMContentLoaded', () => {
  const RE = /^\s*H3\s*[:\-–—]?\s*/i;

  function firstTextNode(el) {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === Node.TEXT_NODE) return n;
      if (n.nodeType === Node.ELEMENT_NODE) {
        const deep = firstTextNode(n);
        if (deep) return deep;
      }
    }
    return null;
  }

  document.querySelectorAll('.post-content h3').forEach(h => {
    const t = firstTextNode(h);
    if (t && RE.test(t.nodeValue)) {
      t.nodeValue = t.nodeValue.replace(RE, '');
    }
  });
});