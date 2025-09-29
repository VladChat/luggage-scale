module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("year", () => String(new Date().getFullYear()));
  eleventyConfig.addFilter("date", (dateObj) => {
    if(!dateObj) return "";
    const d = new Date(dateObj);
    return isNaN(d) ? "" : d.toISOString().split("T")[0];
  });
  eleventyConfig.addFilter("absoluteUrl", (url, base = "") => {
    if(!url) return base || "/";
    if(/^https?:\/\//i.test(url)) return url;
    const b = (base || "").replace(/\/$/, "");
    const u = String(url).replace(/^\//, "");
    return `${b}/${u}`;
  });
  eleventyConfig.addFilter("preparePostContent", content => content || "");
  eleventyConfig.addFilter("amazonLinkInfo", link => link || "");
  eleventyConfig.addFilter("breadcrumbJsonLd", data => JSON.stringify(data || {}));
  eleventyConfig.addFilter("jsonify", obj => JSON.stringify(obj ?? {}));

  eleventyConfig.addPassthroughCopy("blog-src/assets");
  eleventyConfig.addPassthroughCopy("blog-src/css");
  eleventyConfig.addPassthroughCopy("blog-src/js");
  eleventyConfig.addPassthroughCopy("blog-src/images");
  eleventyConfig.addPassthroughCopy({ "blog-src/static": "static" });

  return {
    dir: {
      input: "blog-src",
      output: "blog",
      includes: "_includes",
      layouts: "_includes/layouts"
    }
  };
};
