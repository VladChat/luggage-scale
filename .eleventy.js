module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    try {
      return new URL(url, base).toString();
    } catch(e) {
      return url;
    }
  });

  eleventyConfig.addFilter("isoDate", dateObj => {
    try {
      return new Date(dateObj).toISOString();
    } catch(e) {
      return "";
    }
  });

  eleventyConfig.addFilter("date", (dateObj, format) => {
    try {
      const d = new Date(dateObj);
      if (format === "yyyy") return d.getFullYear();
      if (format === "MM") return String(d.getMonth() + 1).padStart(2, "0");
      if (format === "dd") return String(d.getDate()).padStart(2, "0");
      return d.toISOString();
    } catch(e) {
      return "";
    }
  });

  // ???????? ??? ?????????? ?????
  eleventyConfig.addShortcode("amazonLink", () => {
    return `<div class="ad-placeholder">[Ad placeholder]</div>`;
  });
};
