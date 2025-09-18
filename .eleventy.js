// .eleventy.js
module.exports = function (eleventyConfig) {
  // Collection: all posts under blog-src/posts/**
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("blog-src/posts/**/*.md")
      .sort((a, b) => (a.date > b.date ? -1 : 1)); // newest first
  });

  // Input dir only; output set via npm scripts
  return {
    dir: {
      input: "blog-src"
    }
  };
};
