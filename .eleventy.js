const pluginRss = require("@11ty/eleventy-plugin-rss");

module.exports = function(eleventyConfig) {
  // Copy static assets from blog-src/static to blog/static
  eleventyConfig.addPassthroughCopy({ "blog-src/static": "static" });

  // Collections: all posts under blog-src/posts/**/index.md
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByGlob("blog-src/posts/**/index.md")
      .sort((a, b) => (a.date > b.date ? 1 : -1)); // oldest -> newest
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
    // Do NOT set pathPrefix here; we handle base paths via config.site.base ("/blog")
  };
};
