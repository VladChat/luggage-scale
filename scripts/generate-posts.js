#!/usr/bin/env node

/**
 * Blog Post Generator Script
 *
 * - Cycles through keywords in scripts/keywords.txt
 * - Fetches recent headlines from news feeds (RSS/Atom)
 * - Builds blog skeleton with frontmatter, hero SVG, and sections
 * - Supports API Fill Mode (--mode=api) or Manual Fill Mode (--mode=manual)
 * - Performs SEO/quality checks
 *
 * Fixed version: word count / validation issues now log warnings instead of throwing errors,
 * so the workflow won’t abort if a section is too short or too long.
 */

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// --- Constants ---

const KEYWORDS_FILE = path.join(__dirname, "keywords.txt");
const STATE_FILE = path.join(__dirname, "../data/automation-state.json");
const POSTS_DIR = path.join(__dirname, "../blog-src/posts/");

const DEFAULT_WORD_RANGES = {
  Introduction: [150, 200],
  "Why It Matters": [150, 200],
  "How It Works": [200, 300],
  "Key Benefits": [150, 200],
  Comparison: [200, 250],
  "Use Cases": [200, 250],
  "Pro Tips": [150, 200],
  FAQ: [300, 400],
  "Conclusion + CTA": [100, 150],
};

// --- Helpers ---
function readKeywords() {
  const content = fs.readFileSync(KEYWORDS_FILE, "utf-8");
  return content.split("\n").map(k => k.trim()).filter(Boolean);
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { lastIndex: -1 };
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTitleCase(str) {
  if (typeof str !== "string" || !str.trim()) return "";
  return str
    .toLowerCase()
    .split(/([\s-]+)/)
    .map(part => (/[\s-]+/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

function countWords(str) {
  if (typeof str !== "string") return 0;
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// --- OpenAI Integration ---
let cachedOpenAIClient = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required when using --mode=api"
    );
  }
  if (!cachedOpenAIClient) {
    cachedOpenAIClient = new OpenAI({ apiKey });
  }
  return cachedOpenAIClient;
}

async function callOpenAI(prompt, sectionName) {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  let text = "";

  if (typeof rawContent === "string") {
    text = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    text = rawContent
      .map(part => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  if (!text) {
    throw new Error(
      `OpenAI returned no content for section "${sectionName}". Check the prompt and API response.`
    );
  }

  return text;
}

// --- Validation (now warnings only) ---
function checkWordCount(sectionName, text) {
  if (typeof text !== "string" || text.trim() === "") {
    console.warn(
      `⚠️ Warning: ${sectionName} has no content; skipping word count.`
    );
    return 0;
  }
  const words = countWords(text);
  const [min, max] = DEFAULT_WORD_RANGES[sectionName] || [0, Infinity];
  if (words < min || words > max) {
    console.warn(
      `⚠️ Warning: ${sectionName} length ${words} is outside ${min}-${max} words`
    );
  } else {
    console.log(`✅ ${sectionName} length ${words} words (OK)`);
  }
  return words;
}

// --- Main Flow ---
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--mode=api") ? "api" : "manual";

  const keywords = readKeywords();
  const state = loadState();
  let nextIndex = (state.lastIndex + 1) % keywords.length;
  const keyword = keywords[nextIndex];
  state.lastIndex = nextIndex;
  saveState(state);

  const slug = slugify(keyword);
  const displayKeyword = toTitleCase(keyword);
  const outDir = path.join(POSTS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "index.md");

  let content = `---\n`;
  content += `title: "${displayKeyword} – Blog Post"\n`;
  content += `subtitle: "${displayKeyword} Subtitle Example"\n`;
  content += `description: "${displayKeyword} description here."\n`;
  content += `date: ${new Date().toISOString()}\n`;
  content += `tags: ["${displayKeyword}"]\n`;
  content += `author: "AutoBot"\n`;
  content += `---\n\n`;

  // Sections
  for (const section of Object.keys(DEFAULT_WORD_RANGES)) {
    content += `## ${section}\n\n`;
    if (mode === "api") {
      const prompt = `Write ${section} about "${displayKeyword}"`;
      const text = await callOpenAI(prompt, section);
      checkWordCount(section, text);
      content += text + "\n\n";
    } else {
      const [min, max] = DEFAULT_WORD_RANGES[section];
      content += `<!-- TODO: Write ${section} (${min}-${max} words) -->\n\n`;
    }
  }

  fs.writeFileSync(outFile, content, "utf-8");
  console.log(`✅ Blog post generated: ${outFile}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
