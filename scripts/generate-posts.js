#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { ensureDir, toTitleCase, slugify, stamp, nowIso } = require("./lib/utils");
const { openaiChat } = require("./lib/openai");
const { fetchNewsFromEnv, formatNewsContext } = require("./lib/rss");
const { generateMeta, pickHeroImage } = require("./lib/meta");
const { readKeywords, loadState, saveState, updatePostsIndex, POSTS_DIR } = require("./lib/posts");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_AUTHOR = "uPatch Editorial Team";
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

async function generateSectionsMarkdown(keyword, newsContext, mode = "api") {
  let md = "";
  const displayKeyword = toTitleCase(keyword);
  for (const section of SECTION_ORDER) {
    md += `## ${section}\n\n`;
    if (mode === "api") {
      const [min, max] = DEFAULT_WORD_RANGES[section];
      const system = "You are an award-winning travel/gear journalist and SEO strategist.";
      const user = `Topic: ${displayKeyword}\nSection: ${section} (${min}-${max} words)\n${newsContext}`;
      const text = await openaiChat([{ role: "system", content: system }, { role: "user", content: user }], DEFAULT_MODEL);
      md += (text || `<!-- Missing content for ${section} -->`) + "\n\n";
    } else {
      const [min, max] = DEFAULT_WORD_RANGES[section];
      md += `<!-- TODO: ${section} for ${displayKeyword} (${min}-${max} words) -->\n\n`;
    }
  }
  return md.trim() + "\n";
}

async function main() {
  const args = process.argv.slice(2);
  const mode = (args.find(a => a.startsWith("--mode=")) || "").split("=")[1] || "api";
  const newsLimit = parseInt((args.find(a => a.startsWith("--news-limit=")) || "").split("=")[1] || "3", 10);
  const newsWindow = parseInt((args.find(a => a.startsWith("--news-window=")) || "").split("=")[1] || "7", 10);

  const keywords = readKeywords();
  const state = loadState();
  const nextIndex = (state.lastIndex + 1) % keywords.length;
  const keyword = keywords[nextIndex];
  state.lastIndex = nextIndex;
  saveState(state);

  const slug = `${slugify(keyword)}-${stamp()}`;
  const outDir = path.join(POSTS_DIR, slug);
  ensureDir(outDir);

  const newsItems = await fetchNewsFromEnv(newsLimit, newsWindow);
  const newsContext = formatNewsContext(newsItems);

  const { subtitle, description } = await generateMeta(keyword, newsContext);
  const heroImage = pickHeroImage();

  const title = `${toTitleCase(keyword)} — Travel Tips & Gear Insights`;
  const fm = [
    "---",
    `title: "${title}"`,
    `subtitle: "${subtitle}"`,
    `description: "${description}"`,
    `date: "${nowIso()}"`,
    `tags: ["${toTitleCase(keyword)}"]`,
    `author: "${DEFAULT_AUTHOR}"`,
    `heroImage: "${heroImage}"`,
    "---",
    ""
  ].join("\n");

  const body = await generateSectionsMarkdown(keyword, newsContext, mode);
  fs.writeFileSync(path.join(outDir, "index.md"), fm + body, "utf-8");
  console.log(`✅ Blog post generated: ${outDir}`);

  updatePostsIndex({ title, slug, date: new Date().toISOString(), tags: [toTitleCase(keyword)], heroImage, link: `/${slug}/` });
}

main().catch(err => { console.error("❌ Error:", err); process.exit(1); });
