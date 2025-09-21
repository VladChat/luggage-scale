// .eleventy.js
// Eleventy config with two Nunjucks filters:
//  - isoDate: format dates as YYYY-MM-DD (UTC)
//  - absoluteUrl: make absolute URLs using site.url + site.base (no double /blog)

const { DateTime } = require("luxon");

/** @param {import('@11ty/eleventy/src/UserConfig')} eleventyConfig */
module.exports = function (eleventyConfig) {
  // ---------- Filters ----------
  eleventyConfig.addNunjucksFilter("isoDate", (value) => {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return "";
    return DateTime.fromJSDate(d, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addNunjucksFilter("absoluteUrl", (path, overrideBaseUrl, overrideBasePath) => {
    const g = eleventyConfig.globalData || {};

    // Prefer your existing structure
    const siteUrl = overrideBaseUrl || g?.site?.url || g?.config?.baseUrl || "";
    const basePath = overrideBasePath || g?.site?.base || g?.config?.basePath || "";

    if (!siteUrl) return path || "";

    const trimmedBase = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
    const prefix = basePath
      ? (basePath.startsWith("/") ? basePath : `/${basePath}`)
      : "";

    // Already absolute?
    if (typeof path === "string" && /^https?:\/\//i.test(path)) {
      return path;
    }

    // Normalize incoming path to start with a single leading slash
    const normalizedPath =
      !path || path === "/"
        ? "/"
        : path.startsWith("/")
        ? path
        : `/${path}`;

    // Avoid /blog/blog/... if path already includes the base
    let pathToUse = normalizedPath;
    if (prefix && (normalizedPath === prefix || normalizedPath.startsWith(prefix + "/"))) {
      // keep as-is
    } else if (prefix) {
      pathToUse = `${prefix}${normalizedPath}`;
    }

    return `${trimmedBase}${pathToUse}`;
  });

  // (Keep/restore any passthrough or collections you already had here)

  return {
    dir: {
      input: "blog-src",
      includes: "_includes",
      data: "_data",
      output: "blog",
    },
  };
};
