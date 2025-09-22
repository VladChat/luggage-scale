// .eleventy.js
const { DateTime } = require("luxon");
const siteConfig = require("./blog-src/_data/config.json");

/** Normalize different date inputs to a JS Date. */
function toJsDate(value) {
  if (value === undefined || value === null || value === "now") return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed)) return parsed;
  return new Date();
}

function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAmazonLink(productId, textOverride) {
  const affiliate = (siteConfig.affiliate && siteConfig.affiliate.amazon) || {};
  if (!affiliate.products) {
    return "<!-- Amazon affiliate configuration missing -->";
  }

  const resolvedId =
    typeof productId === "string"
      ? productId
      : productId && (productId.id || productId.asin || productId.sku);
  if (!resolvedId) {
    return "<!-- Amazon affiliate product id missing -->";
  }

  const product = affiliate.products[resolvedId];
  if (!product) {
    return `<!-- Amazon affiliate product not found: ${escapeHtml(resolvedId)} -->`;
  }

  const asin = product.asin || resolvedId;
  const baseDomain = product.domain || affiliate.defaultDomain || "com";
  const defaultPath = product.path || `dp/${asin}`;
  const baseUrl = product.url || `https://www.amazon.${baseDomain}/${defaultPath}`;

  const params = new URLSearchParams();
  if (affiliate.tag) {
    params.set("tag", affiliate.tag);
  }
  const defaultQuery = affiliate.defaultQuery || {};
  const productQuery = product.query || {};
  for (const [key, value] of Object.entries({ ...defaultQuery, ...productQuery })) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  const url = queryString
    ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${queryString}`
    : baseUrl;

  const linkText =
    textOverride || product.text || affiliate.defaultText || "View this item on Amazon";
  const linkTitle = product.title || linkText;
  const classNames = [affiliate.defaultClass, product.className]
    .filter(Boolean)
    .join(" ");

  const attributes = [
    `href="${escapeHtml(url)}"`,
    "rel=\"sponsored noopener noreferrer\"",
    "target=\"_blank\"",
    "data-affiliate=\"amazon\"",
  ];
  if (asin) {
    attributes.push(`data-asin=\"${escapeHtml(asin)}\"`);
  }
  if (classNames) {
    attributes.push(`class=\"${escapeHtml(classNames)}\"`);
  }
  if (linkTitle) {
    attributes.push(`title=\"${escapeHtml(linkTitle)}\"`);
  }

  return `<a ${attributes.join(" ")}>${escapeHtml(linkText)}</a>`;
}

module.exports = function (eleventyConfig) {
  // Pretty date, e.g., "September 18, 2025"
  eleventyConfig.addFilter("date", (value, fmt = "MMMM d, yyyy") =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toFormat(fmt)
  );

  // ISO date yyyy-mm-dd
  eleventyConfig.addFilter("isoDate", (value) =>
    DateTime.fromJSDate(toJsDate(value), { zone: "utc" }).toISODate()
  );

  const amazonLinkHelper = (productId, textOverride) =>
    buildAmazonLink(productId, textOverride);

  eleventyConfig.addFilter("amazonLink", amazonLinkHelper);
  eleventyConfig.addShortcode("amazonLink", amazonLinkHelper);

  // Build absolute URLs safely; ensure site.base (e.g., /blog) is present
  // Expects config.site like: { "url": "https://luggage-scale.com", "base": "/blog" }
  eleventyConfig.addFilter("absoluteUrl", (path, site) => {
    if (!site || !site.url) return path;
    let p = path || "/";
    if (!p.startsWith(site.base)) {
      p = site.base.replace(/\/$/, "") + (p.startsWith("/") ? p : "/" + p);
    }
    return new URL(p, site.url).toString();
  });

  // Posts collection (newest first)
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("blog-src/posts/**/index.md")
      .map((post) => {
        if (post && post.url && !post.url.startsWith("/blog/")) {
          post.url = `/blog${post.url}`;
        }
        if (
          post &&
          post.data &&
          post.data.page &&
          typeof post.data.page.url === "string" &&
          !post.data.page.url.startsWith("/blog/")
        ) {
          post.data.page.url = `/blog${post.data.page.url}`;
        }
        return post;
      })
      .sort((a, b) => b.date - a.date)
  );

  // Copy static assets (e.g., CSS) to the published blog directory
  eleventyConfig.addPassthroughCopy({ "blog-src/static": "static" });

  return {
    dir: { input: "blog-src", output: "blog", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    // >>> IMPORTANT: this makes the built-in `url` filter prepend /blog <<<
    pathPrefix: "/blog",
  };
};
