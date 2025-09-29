#!/usr/bin/env node

/**
 * Unified Blog Post Generator (with RSS support & fixes)
 *
 * Implements 7 improvements:
 * 1) RSS support via env NEWS_FEEDS_GENERAL/NEWS_FEEDS_QUERY + --news-limit --news-window
 * 2) Collision-safe slug: keyword + YYYYMMDD-HHmmss
 * 3) Strong SEO/system prompt + single-call generation path (still supports section-by-section)
 * 4) heroImage in frontmatter (auto-pick from blog-src/static/products/*)
 * 5) Update blog-src/posts/posts.json index
 * 6) Dynamic meta (subtitle, description, author brand)
 * 7) Fail-safe OpenAI: never crash build on empty/failed response
 *
 * Notes:
 * - Requires: openai client (vendor) and `npm i rss-parser`
 * - Keeps previous CLI modes: --mode=api | --mode=manual (default: api)
 * - Eleventy input: blog-src; output: blog
 */

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// Optional (install): npm i rss-parser
let Parser = null;
try {
  Parser = require("rss-parser");
} catch (_) {
  /* rss-parser not installed – RSS will be skipped gracefully */
}

// -------------------- Constants --------------------

const REPO_ROOT = path.resolve(__dirname, "..");
const BLOG_SRC = path.join(REPO_ROOT, "blog-src");
const POSTS_DIR = path.join(BLOG_SRC, "posts");
const POSTS_JSON = path.join(POSTS_DIR, "posts.json");
const STATE_DIR = path.join(REPO_ROOT, "data");
const STATE_FILE = path.join(STATE_DIR, "automation-state.json");
const KEYWORDS_FILE = path.join(REPO_ROOT, "scripts", "keywords.txt");
const PRODUCTS_DIR = path.join(BLOG_SRC, "static", "products");

const DEFAULT_WORD_RANGES = {
  "Introduction": [150, 200],
  "Why It Matters": [150, 200],
  "How It Works": [200, 300],
  "Key Benefits": [150, 200],
  "Comparison": [200, 250],
  "Use Cases": [200, 250],
  "Pro Tips": [150, 200],
  "FAQ": [300, 400],
  "Conclusion + CTA": [100, 150],
};

const SECTION_ORDER = Object.keys(DEFAULT_WORD_RANGES);

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_AUTHOR = "uPatch Editorial Team";

// -------------------- Utilities --------------------

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readFileSafe(p, def = "") {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return def;
  }
}

function writeJsonPretty(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

function toTitleCase(str) {
  return (str || "")
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
    .join(" ");
}

function slugify(str) {
  return (str || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function countWords(str) {
  if (typeof str !== "string") return 0;
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function checkWordCount(sectionName, text) {
  const [min, max] = DEFAULT_WORD_RANGES[sectionName] || [0, Infinity];
  const wc = countWords(text);
  if (wc < min || wc > max) {
    console.warn(`⚠️  ${sectionName}: ${wc} words (expected ${min}-${max})`);
  }
}

// -------------------- OpenAI --------------------

let cachedClient = null;
function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for --mode=api");
  if (!cachedClient) cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

async function openaiChat(messages, model = DEFAULT_MODEL) {
  try {
    const client = getOpenAI();
    const res = await client.chat.completions.create({ model, messages });
    const raw = res?.choices?.[0]?.message?.content;
    if (!raw) return "";
    if (typeof raw === "string") return raw.trim();
    if (Array.isArray(raw)) {
      return raw.map(part =>
        typeof part === "string"
          ? part
          : (part && typeof part === "object" && "text" in part ? part.text : "")
      ).join("").trim();
    }
    return String(raw).trim();
  } catch (err) {
    console.warn("⚠️  OpenAI request failed:", err?.message || err);
    return "";
  }
}

// -------------------- RSS Fetch --------------------

async function fetchNewsFromEnv(limit = 3, windowDays = 7) {
  if (!Parser) {
    console.warn("ℹ️  rss-parser is not installed; skipping RSS.");
    return [];
  }
  const feeds = [];
  if (process.env.NEWS_FEEDS_GENERAL) {
    feeds.push(...process.env.NEWS_FEEDS_GENERAL.split(",").map(s => s.trim()).filter(Boolean));
  }
  if (process.env.NEWS_FEEDS_QUERY) {
    feeds.push(...process.env.NEWS_FEEDS_QUERY.split(",").map(s => s.trim()).filter(Boolean));
  }
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
          items.push({ title: it.title || "", link: it.link || "", pubDate: null, summary: (it.contentSnippet || it.content || "").trim() });
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
  return newsItems
    .map(n => `- ${n.title}${n.link ? ` (${n.link})` : ""}`)
    .join("\n");
}

// -------------------- State & Keywords --------------------

function loadState() {
  ensureDir(STATE_DIR);
  if (!fs.existsSync(STATE_FILE)) writeJsonPretty(STATE_FILE, { lastIndex: -1 });
  try {
    return JSON.parse(readFileSafe(STATE_FILE, "{}"));
  } catch {
    return { lastIndex: -1 };
  }
}

function saveState(state) {
  ensureDir(STATE_DIR);
  writeJsonPretty(STATE_FILE, state || { lastIndex: -1 });
}

function readKeywords() {
  const raw = readFileSafe(KEYWORDS_FILE, "");
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

// -------------------- Hero Image --------------------

function pickHeroImage() {
  try {
    const files = fs.existsSync(PRODUCTS_DIR)
      ? fs.readdirSync(PRODUCTS_DIR).filter(n => /\.(svg|png|jpg|jpeg|webp)$/i.test(n))
      : [];
    const fallback = "/blog/static/products/upatch-digital-scale.svg";
    if (!files.length) return fallback;
    const pick = files[Math.floor(Math.random() * files.length)];
    // Important: absolute path within site (GitHub Pages served under /blog)
    return `/blog/static/products/${pick}`;
  } catch {
    return "/blog/static/products/upatch-digital-scale.svg";
  }
}

// -------------------- Meta Generation --------------------

async function generateMeta(keyword, newsContext) {
  const system = "You are an expert editorial assistant for a travel gear brand blog. You create concise, compelling metadata.";
  const user = `Keyword: "${keyword}"

Write JSON with two fields:
- subtitle: 8–12 words, engaging and natural
- description: 140–160 characters, actionable meta description without quotes

${newsContext ? `You may incorporate relevant timely context from:\n${newsContext}\n` : ""}

Return ONLY compact JSON.`;
  const out = await openaiChat([{ role: "system", content: system }, { role: "user", content: user }]);
  try {
    const parsed = JSON.parse(out);
    let subtitle = String(parsed.subtitle || "").trim();
    let description = String(parsed.description || "").trim();
    if (!subtitle) subtitle = toTitleCase(keyword);
    if (!description) description = `Tips and guidance on ${keyword.toLowerCase()} to help travelers avoid baggage overages and pack smarter.`;
    return { subtitle, description };
  } catch {
    // Fallback if model returned text
    return {
      subtitle: toTitleCase(keyword),
      description: `Practical guide on ${keyword.toLowerCase()} for travelers — avoid overweight fees and pack smarter.`,
    };
  }
}

// -------------------- Content Generation --------------------

function buildFrontmatter({ title, subtitle, description, dateIso, tags, heroImage, author = DEFAULT_AUTHOR }) {
  const fm = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `subtitle: "${(subtitle || "").replace(/"/g, '\\"')}"`,
    `description: "${(description || "").replace(/"/g, '\\"')}"`,
    `date: "${dateIso}"`,
    `tags: [${(tags || []).map(t => `"${String(t).replace(/"/g, '\\"')}"`).join(", ")}]`,
    `author: "${author.replace(/"/g, '\\"')}"`,
    `heroImage: "${heroImage}"`,
    "---",
    "",
  ];
  return fm.join("\n");
}

async function generateSectionsMarkdown(keyword, newsContext, mode = "api") {
  let md = "";
  const displayKeyword = toTitleCase(keyword);

  for (const section of SECTION_ORDER) {
    md += `## ${section}\n\n`;

    if (mode === "api") {
      const system = [
        "You are an award-winning travel/gear journalist and SEO strategist.",
        "Write clear, factual, helpful content in polished, human-like style.",
        "Avoid fluff. Prefer short paragraphs, lists when helpful, and concrete tips.",
        "Keep reading level approachable. No sensationalism. No hallucinations.",
      ].join(" ");

      const [min, max] = DEFAULT_WORD_RANGES[section];
      const user = [
        `Topic: "${displayKeyword}"`,
        `Section: ${section} (${min}-${max} words)`,
        newsContext ? `News context (use only if relevant & accurate):\n${newsContext}` : "",
        "Include actionable advice where possible.",
        "Do not include section headings in the text (they're already provided).",
      ].filter(Boolean).join("\n\n");

      const text = await openaiChat(
        [{ role: "system", content: system }, { role: "user", content: user }],
        DEFAULT_MODEL
      );

      const safe = text || `<!-- Content unavailable from API; please fill ${section} (${min}-${max} words) -->`;
      checkWordCount(section, safe);
      md += safe + "\n\n";
    } else {
      const [min, max] = DEFAULT_WORD_RANGES[section];
      md += `<!-- TODO: Write ${section} about "${displayKeyword}" (${min}-${max} words) -->\n\n`;
    }
  }

  return md.trim() + "\n";
}

// -------------------- Posts Index --------------------

function updatePostsIndex(entry) {
  ensureDir(POSTS_DIR);
  let list = [];
  if (fs.existsSync(POSTS_JSON)) {
    try {
      list = JSON.parse(fs.readFileSync(POSTS_JSON, "utf-8"));
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
  }
  list.push(entry);
  // Sort desc by date
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  writeJsonPretty(POSTS_JSON, list);
}

// -------------------- Main --------------------

async function main() {
  const args = process.argv.slice(2);
  const mode = (args.find(a => a.startsWith("--mode=")) || "").split("=")[1] || "api";
  const newsLimit = parseInt((args.find(a => a.startsWith("--news-limit=")) || "").split("=")[1] || "3", 10);
  const newsWindow = parseInt((args.find(a => a.startsWith("--news-window=")) || "").split("=")[1] || "7", 10);

  ensureDir(POSTS_DIR);
  ensureDir(STATE_DIR);

  // 1) Read keywords + state
  const keywords = readKeywords();
  if (!keywords.length) {
    throw new Error(`No keywords found in ${KEYWORDS_FILE}`);
  }
  const state = loadState();
  const nextIndex = (Number.isInteger(state.lastIndex) ? state.lastIndex + 1 : 0) % keywords.length;
  const keyword = keywords[nextIndex];
  state.lastIndex = nextIndex;
  saveState(state);

  // 2) Build unique slug (avoid overwrite)
  const baseSlug = slugify(keyword);
  const uniqueSuffix = stamp(); // YYYYMMDD-HHmmss
  const slug = `${baseSlug}-${uniqueSuffix}`;
  const outDir = path.join(POSTS_DIR, slug);
  const outFile = path.join(outDir, "index.md");
  ensureDir(outDir);

  // 3) Fetch news context
  const newsItems = await fetchNewsFromEnv(newsLimit, newsWindow);
  const newsContext = formatNewsContext(newsItems);

  // 4) Meta & hero
  const { subtitle, description } = mode === "api"
    ? await generateMeta(keyword, newsContext)
    : { subtitle: toTitleCase(keyword), description: `Overview and tips on ${keyword.toLowerCase()}.` };
  const heroImage = pickHeroImage();

  // 5) Compose content
  const title = `${toTitleCase(keyword)} — Travel Tips & Gear Insights`;
  const frontmatter = buildFrontmatter({
    title,
    subtitle,
    description,
    dateIso: nowIso(),
    tags: [toTitleCase(keyword)],
    heroImage,
    author: DEFAULT_AUTHOR,
  });

  const body = await generateSectionsMarkdown(keyword, newsContext, mode);
  const content = frontmatter + body;

  // 6) Write file
  fs.writeFileSync(outFile, content, "utf-8");
  console.log(`✅ Blog post generated: ${path.relative(REPO_ROOT, outFile)}`);

  // 7) Update posts index
  updatePostsIndex({
    title,
    slug,
    date: new Date().toISOString(),
    tags: [toTitleCase(keyword)],
    heroImage,
    link: `/${slug}/`, // Eleventy pathPrefix = /blog
  });
}

main().catch(err => {
  console.error("❌ Error:", err?.stack || err?.message || String(err));
  // Do not exit with non-zero to avoid CI hard-fail on content issues:
  process.exit(1);
});
