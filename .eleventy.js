const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Copy generated OG images to /blog/og/
  eleventyConfig.addPassthroughCopy({ "blog-src/_generated": "og" });

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

  // Posts collection: exclude future-dated posts
  eleventyConfig.addCollection("posts", (collection) => {
    const now = new Date();
    return collection
      .getFilteredByGlob("blog-src/posts/**/index.md")
      .filter((item) => item.date <= now);
  });

  return {
    dir: {
      input: "blog-src",
      includes: "_includes",
      data: "_data",
      output: "blog"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    passthroughFileCopy: true
  };
};
