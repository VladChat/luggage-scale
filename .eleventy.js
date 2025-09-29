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

  eleventyConfig.addFilter("year", (dateObj) => {
    if (!dateObj) dateObj = new Date();
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy");
  });

  // Заглушка для preparePostContent
  eleventyConfig.addFilter("preparePostContent", (content, title) => {
    // Возвращаем объект с пустыми секциями, чтобы не падал билд
    return { sections: [] };
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
