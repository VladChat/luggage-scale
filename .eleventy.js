// .eleventy.js
module.exports = function(eleventyConfig) {
  // ===== Сохраняем твои короткие фильтры (как были) =====
  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  eleventyConfig.addFilter("date", (dateObj, format) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    // твой изначальный формат был ISO с датой — оставляем совместимость
    return isNaN(d) ? "" : d.toISOString().split("T")[0];
  });

  eleventyConfig.addFilter("absoluteUrl", (url, base) => (base || "") + (url || ""));

  eleventyConfig.addFilter("preparePostContent", content => content || "");

  eleventyConfig.addFilter("amazonLinkInfo", link => link || "");

  eleventyConfig.addFilter("breadcrumbJsonLd", data => JSON.stringify(data || {}));

  eleventyConfig.addFilter("jsonify", obj => JSON.stringify(obj || {}));

  // ===== Небольшое безопасное дополнение (не ломает совместимость) =====
  // Иногда шаблоны зовут isoDate — дадим простой фильтр, чтобы не падало
  eleventyConfig.addFilter("isoDate", (value) => {
    if (!value) return "";
    const d = new Date(value);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  });

  // ===== Ключевой фикс: исправляем "layouts/post.njk" на лету =====
  // Если в front matter указано "layout: layouts/post.njk",
  // при конфиге layouts: "_includes/layouts" Eleventy ищет
  // _includes/layouts/layouts/post.njk. Этот computed удалит лишний "layouts/".
  eleventyConfig.addGlobalData("eleventyComputed", {
    layout: (data) => {
      const v = data && data.layout;
      if (!v) return v;
      if (typeof v === "string" && /^layouts\//.test(v)) {
        return v.replace(/^layouts\//, "");
      }
      return v;
    }
  });

  // ===== Директории =====
  return {
    dir: {
      input: "blog-src",
      output: "blog",
      includes: "_includes",
      layouts: "_includes/layouts"   // лэйауты живут здесь
    },
    // Делаем Markdown через Nunjucks, чтобы работал синтаксис с круглыми скобками:
    // {{ page.url | absoluteUrl(config.site) }}
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};
