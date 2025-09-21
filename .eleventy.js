const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // === Settings / constants ===
  // Use your configured site URL, with a safe fallback.
  const SITE_URL = process.env.SITE_URL || "https://luggage-scale.com";

  // === Passthroughs ===
  // Copy generated OG images to /blog/og/
  eleventyConfig.addPassthroughCopy({ "blog-src/_generated": "og" });

  // === Filters ===

  // Date filter (safe; avoids throwing on bad dates)
  eleventyConfig.addFilter("date", (dateObj, fmt = "yyyy-LL-dd") => {
    try {
      if (!dateObj) return "";
      const dt = dateObj instanceof Date ? dateObj : new Date(dateObj);
      return DateTime.fromJSDate(dt, { zone: "utc" }).toFormat(fmt);
    } catch {
      return "";
    }
  });

  // Absolute URL filter
  // Usage: {{ "/blog/hello-world/" | absoluteUrl }}  ->  https://luggage-scale.com/blog/hello-world/
  eleventyConfig.addFilter("absoluteUrl", (path, base = SITE_URL) => {
    try {
      if (!path) return base;
      return new URL(path, base).toString();
    } catch {
      return base;
    }
  });

  // Backward-compat alias for a misspelling used in some templates.
  // This prevents "filter not found: absoluturl" build failures.
  eleventyConfig.addFilter("absoluturl", (path, base) =>
    eleventyConfig.getFilter("absoluteUrl")(path, base)
  );

  // === Collections ===

  // Posts collection: exclude future-dated posts
  eleventyConfig.addCollection("posts", (collection) => {
    const now = new Date();
    return collection
      .getFilteredByGlob("blog-src/posts/**/index.md")
      .filter((item) => item.date <= now);
  });

  // === Eleventy dir & engines ===
  return {
    dir: {
      input: "blog-src",
      includes: "_includes",
      data: "_data",
      output: "blog",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    passthroughFileCopy: true,
  };
};
