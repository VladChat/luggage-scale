let Parser = null;
try { Parser = require("rss-parser"); } catch (_) {}

async function fetchNewsFromEnv(limit = 3, windowDays = 7) {
  if (!Parser) {
    console.warn("ℹ️  rss-parser is not installed; skipping RSS.");
    return [];
  }
  const feeds = [];
  if (process.env.NEWS_FEEDS_GENERAL) feeds.push(...process.env.NEWS_FEEDS_GENERAL.split(",").map(s => s.trim()).filter(Boolean));
  if (process.env.NEWS_FEEDS_QUERY) feeds.push(...process.env.NEWS_FEEDS_QUERY.split(",").map(s => s.trim()).filter(Boolean));
  if (!feeds.length) return [];

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const parser = new Parser();
  const items = [];

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const it of feed.items || []) {
        const pub = it.isoDate || it.pubDate || it.published || it.updated || it.date;
        const dt = pub ? new Date(pub) : null;
        if (!dt || isNaN(dt)) {
          items.push({ title: it.title || "", link: it.link || "", summary: (it.contentSnippet || it.content || "").trim() });
        } else if (dt >= cutoff) {
          items.push({ title: it.title || "", link: it.link || "", pubDate: dt.toISOString(), summary: (it.contentSnippet || it.content || "").trim() });
        }
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse feed: ${url} (${e.message})`);
    }
  }
  items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return items.slice(0, limit);
}

function formatNewsContext(newsItems) {
  if (!newsItems?.length) return "";
  return newsItems.map(n => `- ${n.title}${n.link ? ` (${n.link})` : ""}`).join("\n");
}

module.exports = { fetchNewsFromEnv, formatNewsContext };
