const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  // Фильтр для форматирования дат
  eleventyConfig.addFilter("date", (dateObj, format = "DDD") => {
    try {
      return DateTime.fromJSDate(dateObj).toFormat(format);
    } catch {
      return "";
    }
  });

  // Фильтр для года (футер)
  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  // Фильтр для ISO-даты (sitemap, schema.org)
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    try {
      return DateTime.fromJSDate(dateObj).toISODate();
    } catch {
      return "";
    }
  });

  // Фильтр absoluteUrl (заглушка для robots/sitemap)
  eleventyConfig.addFilter("absoluteUrl", (url, base = "/") => {
    try {
      if(!url) return base;
      if(url.startsWith("http")) return url;
      return base.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
    } catch {
      return url || base;
    }
  });

  // Заглушки для кастомных фильтров
  eleventyConfig.addFilter("preparePostContent", content => content || "");
  eleventyConfig.addFilter("amazonLinkInfo", link => link || "");
  eleventyConfig.addFilter("breadcrumbJsonLd", json => json || "{}");
  eleventyConfig.addFilter("jsonify", obj => JSON.stringify(obj));

  // Копирование статических файлов (CSS, JS, картинки)
  eleventyConfig.addPassthroughCopy("blog-src/assets");

  return {
    dir: {
      input: "blog-src",
      output: "."
    }
  };
};
