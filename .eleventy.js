// .eleventy.js
const { DateTime } = require("luxon");

/** Normalize input to Date (handles Date, "now", ISO-ish strings). */
function toJsDate(value) {
  if (value === undefined || value === null || value === "now") return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed)) return parsed;
  return new Date();
}

module.exports = function (eleventyConfig) {
  // Pretty date e.g. "September 18, 2025"
  eleventyConfig.addFilter("date", (value, fmt = "MMMM d, yyyy") =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toFormat(fmt)
  );

  // ISO date yyyy-mm-dd
  eleventyConfig.addFilter("isoDate", (value) =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toISODate()
  );

  // Build absolute URLs safely (no double /blog)
  // Expects blog-src/_data/config.json to contain:
  // { "site": { "url": "https://luggage-scale.com", "base": "/blog" } }
  eleventyConfig.addFilter("absoluteUrl", (path, site) => {
    if (!site || !site.url) return path;
    const base = new URL(site.base || "/", site.url).toString();
    return new URL(path, base).toString();
  });

  // Posts collection: exclude future-dated posts, newest first
  eleventyConfig.addCollection("posts", (api) => {
    const now = new Date();
    return api
      .getFilteredByGlob("blog-src/posts/**/index.md")
      .filter((post) => post.date <= now)
      .sort((a, b) => b.date - a.date);
  });

  return {
    dir: { input: "blog-src", output: "blog", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
