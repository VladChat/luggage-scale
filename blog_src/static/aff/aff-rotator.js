// blog_src/static/aff/aff-rotator.js
// Amazon affiliate rotator — supports multiple mounts per page
(function () {
  const run = () => {
    const mounts = Array.from(document.querySelectorAll("[data-aff-rotator]"));
    if (!mounts.length) return;

    // Cache JSON fetches by URL so we don't refetch for each mount
    const jsonCache = new Map();

    // helpers
    const isAbs = (url) => /^https?:\/\//i.test(url);
    const resolveImg = (img, base1x, base2x) => {
      if (!img) return { src: "", srcset: "" };
      const file = img.replace(/^\//, "");
      const src1x = isAbs(file) ? file : `${base1x}/${file}`;
      const src2x = isAbs(file) ? file : `${base2x}/${file}`;
      return { src: src1x, srcset: `${src1x} 1x, ${src2x} 2x` };
    };

    const renderOne = (root, data) => {
      const mode = root.dataset.mode || "random";
      const count = Math.max(1, parseInt(root.dataset.count || 1, 10));
      const debug = root.dataset.debug === "1";

      const base1x = (root.dataset.imgBase || "").replace(/\/$/, "");
      const base2x = (root.dataset.imgBase2x || base1x).replace(/\/$/, "");

      const cards = Array.isArray(data.cards) ? data.cards.slice() : [];
      if (!cards.length) return;

      if (mode === "random") cards.sort(() => Math.random() - 0.5);
      const chosen = cards.slice(0, count);

      const html = chosen
        .map((c) => {
          const img = resolveImg(c.img, base1x, base2x);
          const link = c.link || "#";
          const title = c.title || "";
          const desc = c.desc || "";
          const alt = (c.alt || "").replace(/"/g, "&quot;");

          return `
            <a class="aff-card" href="${link}" target="_blank" rel="nofollow sponsored noopener">
              <img
                src="${img.src}"
                srcset="${img.srcset}"
                alt="${alt}"
                width="88" height="88"
                loading="lazy" decoding="async">
              <div class="aff-card-body">
                <h4>${title}</h4>
                <p>${desc}</p>
                <span class="aff-link">View on Amazon</span>
                <small class="aff-mini-note">As an Amazon Associate, we may earn commissions.</small>
              </div>
            </a>
          `;
        })
        .join("");

      root.innerHTML = html;

      if (debug) console.log("[aff-rotator]", { root, chosen });
    };

    mounts.forEach((root) => {
      const jsonUrl = root.dataset.json;
      if (!jsonUrl) return;

      let promise = jsonCache.get(jsonUrl);
      if (!promise) {
        promise = fetch(jsonUrl, { credentials: "omit" })
          .then((r) => r.json())
          .catch((err) => {
            console.error("aff-rotator JSON error:", err);
            return {};
          });
        jsonCache.set(jsonUrl, promise);
      }

      promise.then((data) => renderOne(root, data));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    // DOM already parsed (возможен второй блок внизу) — запускаем сразу
    run();
  }
})();
