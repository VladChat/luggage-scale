const pluginRss = require("@11ty/eleventy-plugin-rss");
const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "blog-src/static": "static" });

  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByGlob("blog-src/posts/**/index.md")
      .sort((a, b) => a.date - b.date);
  });

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
    return { sections: [] };
  });

  // Заглушка для amazonLinkInfo
  eleventyConfig.addFilter("amazonLinkInfo", (productKey) => {
    return {
      url: "#",
      title: productKey || "Amazon Product",
      price: "",
      image: ""
    };
  });

  eleventyConfig.addPlugin(pluginRss);

  return {
    dir: {
      input: "blog-src",
      output: "blog",
      includes: "_includes",
      data: "_data"
    }
  };
};
