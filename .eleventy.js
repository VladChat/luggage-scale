// .eleventy.js
const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Add a date filter for Nunjucks
  eleventyConfig.addFilter("date", (dateObj, format = "MMMM d, yyyy") => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(format);
  });

  // Collection: all posts under blog-src/posts/**
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("blog-src/posts/**/*.md")
      .filter((p) => p.date <= new Date()) // exclude future posts
      .sort((a, b) => b.date - a.date); // newest first
  });

  return {
    dir: {
      input: "blog-src",
      output: "blog"
    }
  };
};
