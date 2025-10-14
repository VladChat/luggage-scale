document.addEventListener("DOMContentLoaded", function () {
  const postContent = document.querySelector(".post-content");
  if (!postContent) return;

  const nodes = Array.from(postContent.children);
  const sections = [];
  let cur = null;

  nodes.forEach(node => {
    if (node.tagName === "H2") {
      if (cur) sections.push(cur);
      cur = { h: node, body: [] };
    } else if (cur) cur.body.push(node);
  });
  if (cur) sections.push(cur);
  if (sections.length < 2) return;

  postContent.innerHTML = "";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SCROLL_OFFSET = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue("--accordion-offset")) || 96;

  sections.forEach((sec, idx) => {
    const wrapper = document.createElement("section");
    wrapper.className = "accordion-section" + (idx === 0 ? " open" : "");
    wrapper.dataset.status = (idx === 0) ? "reading" : "toread";
    wrapper.style.scrollMarginTop = SCROLL_OFFSET + "px";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "accordion-header";
    header.setAttribute("aria-expanded", idx === 0 ? "true" : "false");
    header.dataset.status = wrapper.dataset.status;

    const title = document.createElement("span");
    title.className = "accordion-title";
    title.textContent = sec.h.textContent;
    header.appendChild(title);

    const content = document.createElement("div");
    content.className = "accordion-content";
    content.style.overflow = "hidden";
    content.style.transition = "max-height 320ms cubic-bezier(.2,.7,.3,1)";
    content.style.maxHeight = "0px";
    sec.body.forEach(el => content.appendChild(el));
	
// 🔸 Вставляем рекламный блок после первой секции (idx === 0)
if (idx === 0) {
  const aff = document.createElement("div");
  aff.innerHTML = `
    <div data-aff-rotator
         data-json="/blog/aff/aff-cards.json"
         data-img-base="/blog/aff/img/88"
         data-img-base2x="/blog/aff/img/176"
         data-mode="random"
         data-count="1"></div>
  `;
  content.appendChild(aff);

  // 🔹 Принудительно запустить ротатор после вставки
  if (window.affRotatorRun) {
    window.affRotatorRun();
  } else if (window.runAffRotator) {
    window.runAffRotator();
  } else {
    try {
      const script = document.createElement("script");
      script.src = "/blog/aff/aff-rotator.js";
      document.body.appendChild(script);
    } catch (e) {
      console.warn("Aff rotator re-init failed:", e);
    }
  }

  // 🔹 Пересчёт max-height, когда ротатор подгрузил контент
  // Проверяем каждые 300 мс, пока баннер не займёт реальную высоту
  const fixHeight = setInterval(() => {
    if (wrapper.classList.contains("open")) {
      const visibleHeight = content.scrollHeight;
      if (visibleHeight > parseInt(content.style.maxHeight || 0)) {
        content.style.maxHeight = visibleHeight + "px";
      }
    }
  }, 300);

  // Останавливаем проверку через 3 секунды
  setTimeout(() => clearInterval(fixHeight), 3000);
}

	

    requestAnimationFrame(() => {
      if (idx === 0) {
        wrapper.classList.add("open");
        content.style.maxHeight = content.scrollHeight + "px";
      }
    });

    header.addEventListener("click", () => {
      const willOpen = !wrapper.classList.contains("open");

      postContent.querySelectorAll(".accordion-section.open").forEach(secEl => {
        if (secEl === wrapper) return;
        secEl.classList.remove("open");
        const c = secEl.querySelector(".accordion-content");
        if (c) c.style.maxHeight = "0px";
        secEl.dataset.status = "read";
        const hdr = secEl.querySelector(".accordion-header");
        if (hdr) hdr.dataset.status = "read";
      });

      if (willOpen) {
        wrapper.classList.add("open");
        content.style.maxHeight = "0px";
        content.offsetHeight;
        content.style.maxHeight = content.scrollHeight + "px";

        const scrollAfter = () =>
          wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
        if (prefersReduced) scrollAfter();
        else content.addEventListener("transitionend", scrollAfter, { once: true });

        wrapper.dataset.status = "reading";
        header.dataset.status = "reading";
      } else {
        wrapper.classList.remove("open");
        content.style.maxHeight = "0px";
        wrapper.dataset.status = "read";
        header.dataset.status = "read";
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    postContent.appendChild(wrapper);
  });
});