// .eleventy.js
const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Formats a date; accepts Date, ISO string, or "now"
  eleventyConfig.addFilter("date", (value, format = "MMMM d, yyyy") => {
    let d =
      value === "now"
        ? new Date()
        : value instanceof Date
        ? value
        : new Date(value);
    return DateTime.fromJSDate(d, { zone: "utc" }).toFormat(format);
  });

  // ISO date (YYYY-MM-DD) for meta/sitemap
  eleventyConfig.addFilter("isoDate", (value) => {
    let d =
      value === "now"
        ? new Date()
        : value instanceof Date
        ? value
        : new Date(value);
    return DateTime.fromJSDate(d, { zone: "utc" }).toISODate(); // e.g. 2025-09-18
  });

  // Make an absolute URL from a page/url and your site config
  // Usage: {{ page.url | absoluteUrl(config.site) }}
  eleventyConfig.addFilter("absoluteUrl", (url, site) => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const base = (site?.base || "").replace(/\/$/, "");
    const host = (site?.url || "").replace(/\/$/, "");
    return new URL(base + url, host + "/").toString();
  });

  // Collection: all posts; hide future-dated posts
  eleventyConfig.addCollection("posts", (collectionApi) => {
    const now = new Date();
    return collectionApi
      .getFilteredByGlob("blog-src/posts/**/*.md")
      .filter((p) => p.date <= now)
      .sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: "blog-src",
      output: "blog"
    }
  };
};
