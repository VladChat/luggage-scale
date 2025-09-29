const pluginRss = require("@11ty/eleventy-plugin-rss");
const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  // Copy static assets from blog-src/static to blog/static
  eleventyConfig.addPassthroughCopy({ "blog-src/static": "static" });

  // Collections: all posts under blog-src/posts/**/index.md
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByGlob("blog-src/posts/**/index.md")
      .sort((a, b) => a.date - b.date); // oldest → newest
  });

  // Filters
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toISODate();
  });

  eleventyConfig.addFilter("date", (dateObj, format = "yyyy-LL-dd") => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(format);
  });

  // Plugins
  eleventyConfig.addPlugin(pluginRss);

  // Directory structure
  return {
    dir: {
      input: "blog-src",
      output: "blog",
      includes: "_includes",
      data: "_data"
    }
  };
};
