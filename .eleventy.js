// .eleventy.js
const { DateTime } = require("luxon");

/**
 * Normalize different date inputs to a JS Date.
 * Accepts: Date, "now", ISO-ish strings, undefined/null.
 */
function toJsDate(value) {
  if (value === undefined || value === null || value === "now") return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed)) return parsed;
  return new Date();
}

module.exports = function (eleventyConfig) {
  // Pretty date, e.g., "September 18, 2025"
  eleventyConfig.addFilter("date", (value, fmt = "MMMM d, yyyy") =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toFormat(fmt)
  );

  // ISO date yyyy-mm-dd
  eleventyConfig.addFilter("isoDate", (value) =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toISODate()
  );

  // Always prepend /blog to local URLs so links don’t 404
  eleventyConfig.addFilter("url", function (url) {
    const base = "/blog";
    if (!url) return base + "/";
    return base + (url.startsWith("/") ? url : "/" + url);
  });

  // Build absolute URLs safely (always include /blog, no duplicates)
  // Expects config.site like: { "url": "https://luggage-scale.com", "base": "/blog" }
  eleventyConfig.addFilter("absoluteUrl", (path, site) => {
    if (!site || !site.url) return path;

    let p = path || "/";
    // Ensure the path starts with site.base (e.g. /blog)
    if (!p.startsWith(site.base)) {
      // Avoid double slashes
      p = site.base.replace(/\/$/, "") + (p.startsWith("/") ? p : "/" + p);
    }

    return new URL(p, site.url).toString();
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
