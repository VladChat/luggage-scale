// .eleventy.js
const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Pretty date, e.g., "September 18, 2025"
  eleventyConfig.addFilter("date", (dateObj, fmt = "MMMM d, yyyy") =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(fmt)
  );

  // ISO date yyyy-mm-dd
  eleventyConfig.addFilter("isoDate", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toISODate()
  );

  // Build absolute URLs safely (no double /blog)
  // Expects config.site like: { "url": "https://luggage-scale.com", "base": "/blog" }
  eleventyConfig.addFilter("absoluteUrl", (path, site) => {
    if (!site || !site.url) return path;
    // base = https://luggage-scale.com/blog/
    const base = new URL(site.base || "/", site.url).toString();
    return new URL(path, base).toString();
  });

  // Posts collection (newest first)
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("blog-src/posts/**/index.md").sort((a, b) => b.date - a.date)
  );

  return {
    dir: { input: "blog-src", output: "blog", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
