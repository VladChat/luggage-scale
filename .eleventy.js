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

function decodeHtmlEntities(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizePlainText(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyHeading(value) {
  return normalizePlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function preparePostContent(content, pageTitle) {
  if (!content) {
    return { html: content, headings: [] };
  }

  let html = String(content);

  const firstHeadingMatch = html.match(/^[\s\uFEFF\xA0]*<h1[^>]*>([\s\S]*?)<\/h1>[\s\uFEFF\xA0]*/i);

  if (firstHeadingMatch) {
    const [fullMatch, innerHtml] = firstHeadingMatch;
    const normalizedHeading = normalizePlainText(innerHtml);
    const normalizedTitle = normalizePlainText(pageTitle || "");

    if (normalizedTitle && normalizedHeading && normalizedHeading === normalizedTitle) {
      html = html.replace(fullMatch, "");
    } else {
      const leadingWhitespace = fullMatch.match(/^[\s\uFEFF\xA0]*/)[0];
      const trailingWhitespace = fullMatch.match(/[\s\uFEFF\xA0]*$/)[0];
      const headingMarkup = fullMatch.slice(
        leadingWhitespace.length,
        fullMatch.length - trailingWhitespace.length
      );

      const demotedHeading = headingMarkup
        .replace(/<h1/gi, "<h2")
        .replace(/<\/h1>/gi, "</h2>");

      html = html.replace(
        fullMatch,
        `${leadingWhitespace}${demotedHeading}${trailingWhitespace}`
      );
    }
  }

  const headings = [];
  const usedIds = new Set();

  const headingPattern = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi;

  html = html.replace(headingPattern, (match, level, rawAttrs, innerHtml) => {
    const text = normalizePlainText(innerHtml);
    if (!text) {
      return match;
    }

    const existingIdMatch = rawAttrs && rawAttrs.match(/\sid\s*=\s*["']([^"']+)["']/i);
    const existingId = existingIdMatch ? existingIdMatch[1] : "";
    const slugBase = existingId || slugifyHeading(innerHtml);
    const fallback = `section-${headings.length + 1}`;
    const safeBase = slugBase || fallback;

    let candidate = safeBase;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${safeBase}-${suffix++}`;
    }
    usedIds.add(candidate);

    const withoutId = rawAttrs
      ? rawAttrs.replace(/\sid\s*=\s*["'][^"']*["']/i, "").replace(/\s+/g, " ").trim()
      : "";
    const attributes = withoutId ? ` ${withoutId}` : "";
    const headingMarkup = `<h${level}${attributes} id="${candidate}">${innerHtml}</h${level}>`;

    headings.push({ level: Number(level), id: candidate, text });
    return headingMarkup;
  });

  return { html, headings };
}

function buildAbsoluteUrl(path, site) {
  if (!path) {
    return site && site.url ? new URL(site.base || "", site.url).toString() : path;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!site || !site.url) {
    return path;
  }

  const basePath = (site.base || "").replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullPath = normalizedPath.startsWith(basePath)
    ? normalizedPath
    : `${basePath}${normalizedPath}`;

  return new URL(fullPath || "/", site.url).toString();
}

function normalizeBreadcrumbTrail(trail, site, canonicalUrl) {
  const output = [];
  const entries = Array.isArray(trail) ? trail : [];

  entries.forEach((crumb, index) => {
    if (!crumb) return;
    const label = normalizePlainText(crumb.label || crumb.name || "");
    if (!label) return;

    let targetUrl = crumb.url || crumb.href || "";
    if (!targetUrl && index === entries.length - 1) {
      targetUrl = canonicalUrl;
    }

    const resolvedUrl = buildAbsoluteUrl(targetUrl || canonicalUrl, site);
    if (!resolvedUrl) return;

    output.push({ label, url: resolvedUrl });
  });

  if (canonicalUrl && !output.some((item) => item.url === canonicalUrl)) {
    const fallbackLabel = output.length ? output[output.length - 1].label : "Current page";
    output.push({ label: fallbackLabel, url: canonicalUrl });
  }

  return output;
}

function buildBreadcrumbLd(trail, site, canonicalUrl) {
  const normalized = normalizeBreadcrumbTrail(trail, site, canonicalUrl);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: normalized.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.url,
    })),
  };
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

  eleventyConfig.addFilter("preparePostContent", (content, pageTitle) =>
    preparePostContent(content, pageTitle)
  );

  eleventyConfig.addFilter("normalizePostHeadings", (content, pageTitle) =>
    preparePostContent(content, pageTitle).html
  );

  // Build absolute URLs safely; ensure site.base (e.g., /blog) is present
  // Expects config.site like: { "url": "https://luggage-scale.com", "base": "/blog" }
  eleventyConfig.addFilter("absoluteUrl", (path, site) => buildAbsoluteUrl(path, site));

  eleventyConfig.addFilter("jsonify", (value) =>
    JSON.stringify(value, null, 2)
  );

  eleventyConfig.addFilter("breadcrumbJsonLd", (trail, site, canonicalUrl) =>
    buildBreadcrumbLd(trail, site, canonicalUrl)
  );

  eleventyConfig.addFilter("resolveBreadcrumbTrail", (trail, site, canonicalUrl) =>
    normalizeBreadcrumbTrail(trail, site, canonicalUrl)
  );

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
