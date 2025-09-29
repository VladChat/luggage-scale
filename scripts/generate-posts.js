#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

const DEBUG_AUTOMATION = Boolean(process.env.BLOG_AUTOMATION_DEBUG);

/**
 * Batch-generate dated Eleventy posts from a JSON or CSV topic list.
 *
 * Usage:
 *   node scripts/generate-posts.js path/to/topics.json [--date=YYYY-MM-DD] [--limit=10] [--dry-run]
 *
 * The script caps each run at 10 posts so you can schedule future batches on
 * separate days when working with large topic files.
 */

const DEFAULT_LIMIT = 10;
const POSTS_ROOT = path.resolve(__dirname, "..", "blog-src", "posts");
const POSTS_DATA_FILE = path.join(POSTS_ROOT, "posts.json");

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.auto) {
      await runAutomatedGeneration(options);
      return;
    }

    runLegacyGenerator(options);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  }
}

function runLegacyGenerator(options) {
  const inputTopics = loadTopics(options.inputPath);
  if (!inputTopics.length) {
    console.log(`No topics found in ${options.inputPath}. Nothing to do.`);
    return;
  }

  const postsData = readPostsData();
  const defaultAuthor = postsData.author || "uPatch Travel Team";
  const defaultDate = options.date || DateTime.now();
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
  if (options.limit && options.limit > DEFAULT_LIMIT) {
    console.warn(
      `Limiting batch to ${DEFAULT_LIMIT} posts per run. Remaining topics will be ignored.`
    );
  }

  const normalised = inputTopics
    .map((topic, index) =>
      normaliseTopic(topic, {
        defaultAuthor,
        defaultDate,
        index,
        inputPath: options.inputPath,
      })
    )
    .filter(Boolean);

  if (!normalised.length) {
    console.log("No valid topics after normalisation.");
    return;
  }

  const batch = normalised.slice(0, limit);
  const skipped = normalised.slice(limit);

  if (skipped.length) {
    console.warn(
      `Skipped ${skipped.length} topic(s) because the daily batch limit is ${DEFAULT_LIMIT}.`
    );
  }

  ensureDirectory(POSTS_ROOT);

  const createdPosts = [];

  for (const topic of batch) {
    const folderName = `${topic.dateISO}-${topic.slug}`;
    const targetDir = resolveUniqueDir(path.join(POSTS_ROOT, folderName));
    const folderSlug = path.basename(targetDir);
    const frontMatter = buildFrontMatter(topic);
    const body = formatBody(topic.body);
    const content = `${frontMatter}\n\n${body}`;

    if (options.dryRun) {
      console.log(`[dry-run] Would create ${folderSlug}/index.md`);
      createdPosts.push({
        slug: folderSlug,
        title: topic.title,
        date: topic.dateISO,
      });
      continue;
    }

    ensureDirectory(targetDir);
    const filePath = path.join(targetDir, "index.md");
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Created ${path.relative(process.cwd(), filePath)}`);
    createdPosts.push({
      slug: folderSlug,
      title: topic.title,
      date: topic.dateISO,
    });
  }

  updatePostsData(postsData, createdPosts, options.inputPath, options.dryRun);

  if (createdPosts.length) {
    console.log(`\nSuccessfully generated ${createdPosts.length} post(s).`);
  } else if (!options.dryRun) {
    console.log("No new posts were generated.");
  }
}

function parseArgs(argv) {
  const options = {
    limit: DEFAULT_LIMIT,
    dryRun: false,
    auto: false,
    fillMode: "api",
  };
  const positional = [];

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [flag, value] = arg.slice(2).split("=");
    switch (flag) {
      case "auto": {
        options.auto = value === undefined ? true : value !== "false";
        break;
      }
      case "date": {
        if (!value) {
          throw new Error("--date expects a value in YYYY-MM-DD format.");
        }
        const parsed = DateTime.fromISO(value, { zone: "utc" });
        if (!parsed.isValid) {
          throw new Error(`Invalid --date value: ${value}`);
        }
        options.date = parsed;
        break;
      }
      case "limit": {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--limit must be a positive integer.");
        }
        options.limit = parsed;
        break;
      }
      case "mode": {
        if (!value) {
          throw new Error("--mode expects 'api' or 'manual'.");
        }
        const lower = value.toLowerCase();
        if (!["api", "manual"].includes(lower)) {
          throw new Error("--mode expects 'api' or 'manual'.");
        }
        options.fillMode = lower;
        break;
      }
      case "keyword": {
        if (!value) {
          throw new Error("--keyword expects a value.");
        }
        options.keywordOverride = value.trim();
        break;
      }
      case "news-limit": {
        if (!value) {
          throw new Error("--news-limit expects a numeric value.");
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--news-limit must be a positive integer.");
        }
        options.newsLimit = parsed;
        break;
      }
      case "news-window": {
        if (!value) {
          throw new Error("--news-window expects a numeric value.");
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--news-window must be a positive integer.");
        }
        options.newsRecencyDays = parsed;
        break;
      }
      case "news-cooldown": {
        if (!value) {
          throw new Error("--news-cooldown expects a numeric value.");
        }
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--news-cooldown must be a positive integer.");
        }
        options.newsCooldownDays = parsed;
        break;
      }
      case "news-reuse-margin": {
        if (!value) {
          throw new Error("--news-reuse-margin expects a numeric value.");
        }
        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed) || parsed < 0) {
          throw new Error("--news-reuse-margin must be zero or a positive number.");
        }
        options.newsReuseMargin = parsed;
        break;
      }
      case "feeds-general": {
        options.newsFeedsGeneral = parseListArgument(value);
        break;
      }
      case "feeds-query": {
        options.newsFeedsQuery = parseListArgument(value);
        break;
      }
      case "dry-run": {
        options.dryRun = true;
        break;
      }
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
  }

  if (positional.length && positional[0].toLowerCase() === "auto") {
    options.auto = true;
    positional.shift();
  }

  if (options.auto) {
    if (positional.length && !options.keywordOverride) {
      options.keywordOverride = positional.shift();
    }
    return options;
  }

  if (!positional.length) {
    throw new Error(
      "Missing topics file. Usage: node scripts/generate-posts.js path/to/topics.json [--date=YYYY-MM-DD] [--limit=10] [--dry-run]"
    );
  }

  options.inputPath = path.resolve(process.cwd(), positional[0]);
  if (!fs.existsSync(options.inputPath)) {
    throw new Error(`Cannot find topics file: ${options.inputPath}`);
  }

  return options;
}

function parseListArgument(value) {
  if (!value) {
    return [];
  }
  return value
    .split(/[,|]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function loadTopics(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed.topics)) {
      return parsed.topics;
    }
    throw new Error("JSON topics file must export an array or an object with a 'topics' array.");
  }

  if (extension === ".csv") {
    return parseCsv(raw);
  }

  throw new Error(`Unsupported file type: ${extension}. Use .json or .csv.`);
}

function parseCsv(content) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  function endValue() {
    current.push(value);
    value = "";
  }

  function endRow() {
    if (current.length) {
      rows.push(current);
    }
    current = [];
  }

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === "\r") {
      continue;
    }

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      endValue();
      continue;
    }

    if (char === "\n" && !inQuotes) {
      endValue();
      endRow();
      continue;
    }

    value += char;
  }

  if (value.length > 0 || current.length) {
    endValue();
    endRow();
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  const records = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === "") {
      continue;
    }
    if (row.length !== headers.length) {
      throw new Error(
        `CSV row ${i + 1} has ${row.length} column(s); expected ${headers.length}.`
      );
    }
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    records.push(record);
  }
  return records;
}

function readPostsData() {
  if (!fs.existsSync(POSTS_DATA_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(POSTS_DATA_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${POSTS_DATA_FILE}: ${error.message}`);
  }
}

function normaliseTopic(rawTopic, context) {
  if (!rawTopic || typeof rawTopic !== "object") {
    console.warn(`Skipping topic at index ${context.index}: expected an object.`);
    return null;
  }

  const topic = { ...rawTopic };
  if (!topic.title) {
    console.warn(`Skipping topic at index ${context.index}: missing title.`);
    return null;
  }

  if (!topic.body) {
    console.warn(`Skipping topic at index ${context.index}: missing body copy.`);
    return null;
  }

  const title = String(topic.title).trim();
  const slug = slugify(topic.slug || title);
  if (!slug) {
    console.warn(`Skipping topic '${title}': unable to derive slug.`);
    return null;
  }

  const body = String(topic.body);

  const dateSource = topic.date ? String(topic.date).trim() : null;
  let date = dateSource ? DateTime.fromISO(dateSource, { zone: "utc" }) : null;
  if (!date || !date.isValid) {
    date = context.defaultDate;
  }
  const dateISO = date.toISODate();

  const tags = normaliseTags(topic.tags);
  const author = topic.author ? String(topic.author).trim() : context.defaultAuthor;

  const reserved = new Set([
    "title",
    "body",
    "tags",
    "date",
    "slug",
    "author",
  ]);

  const extra = {};
  for (const [key, value] of Object.entries(topic)) {
    if (reserved.has(key)) {
      continue;
    }
    if (value === undefined || value === null || value === "") {
      continue;
    }
    extra[key] = value;
  }

  return {
    raw: topic,
    title,
    slug,
    body,
    tags,
    author,
    dateISO,
    description: topic.description ? String(topic.description) : undefined,
    excerpt: topic.excerpt ? String(topic.excerpt) : undefined,
    metaDescription: topic.metaDescription
      ? String(topic.metaDescription)
      : undefined,
    extra,
  };
}

function normaliseTags(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => String(entry).trim())
            .filter((entry) => entry.length > 0);
        }
      } catch (error) {
        // fall through to split-based parsing below
      }
    }
    return trimmed
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [String(value).trim()].filter((entry) => entry.length > 0);
}

function buildFrontMatter(topic) {
  const lines = ["---"];

  const addField = (key, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        return;
      }
      lines.push(`${key}:`);
      value.forEach((item) => {
        lines.push(`  - ${formatYamlValue(item)}`);
      });
      return;
    }
    if (typeof value === "object") {
      console.warn(
        `Skipping front matter field '${key}' because nested objects are not supported.`
      );
      return;
    }
    lines.push(`${key}: ${formatYamlValue(value)}`);
  };

  addField("title", topic.title);
  addField("description", topic.description);
  addField("excerpt", topic.excerpt);
  addField("metaDescription", topic.metaDescription);
  addField("author", topic.author);
  addField("date", topic.dateISO);
  addField("tags", topic.tags);

  for (const [key, value] of Object.entries(topic.extra || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (["description", "excerpt", "metaDescription", "date"].includes(key)) {
      continue;
    }
    if (key === "tags") {
      continue;
    }
    addField(key, value);
  }

  lines.push("---");
  return lines.join("\n");
}

function formatYamlValue(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const stringValue = String(value);
  if (stringValue === "") {
    return '""';
  }
  const needsQuotes =
    /^\s|\s$/.test(stringValue) ||
    /[:{}\[\],&*#?|–—<>!=%@`]/.test(stringValue) ||
    stringValue.includes("\n") ||
    stringValue.includes("\"") ||
    stringValue.includes("'");
  return needsQuotes ? JSON.stringify(stringValue) : stringValue;
}

function formatBody(body) {
  const normalised = body.replace(/\r\n/g, "\n");
  const trimmed = normalised.trimEnd();
  return `${trimmed}\n`;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveUniqueDir(target) {
  if (!fs.existsSync(target)) {
    return target;
  }
  let counter = 2;
  let candidate = `${target}-${counter}`;
  while (fs.existsSync(candidate)) {
    counter += 1;
    candidate = `${target}-${counter}`;
  }
  return candidate;
}

function updatePostsData(originalData, createdPosts, inputPath, dryRun) {
  const data = { ...originalData };
  const generatedBatches = Array.isArray(originalData.generatedBatches)
    ? [...originalData.generatedBatches]
    : [];

  const nowIso = DateTime.now().toISO();
  const batch = {
    source: path.relative(process.cwd(), inputPath),
    generatedOn: nowIso,
    count: createdPosts.length,
    posts: createdPosts,
  };

  if (createdPosts.length > 0) {
    generatedBatches.push(batch);
  }

  data.lastGeneratedOn = nowIso;
  if (generatedBatches.length) {
    data.generatedBatches = generatedBatches.slice(-20);
  }

  if (dryRun) {
    console.log("[dry-run] posts.json would be updated with the latest batch metadata.");
    return;
  }

  fs.writeFileSync(POSTS_DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const KEYWORD_DENSITY_RANGE = { min: 0.01, max: 0.015 };
const DESIRED_KEYWORD_DENSITY = 0.0125;
const TITLE_MAX_LENGTH = 60;
const SUBTITLE_RANGE = { min: 90, max: 120 };
const DESCRIPTION_RANGE = { min: 140, max: 160 };
const TOTAL_WORD_TARGET = { min: 1200, max: 1500 };
const HERO_VARIANTS = ["suitcase", "scale", "leaf", "no-battery"];
const AUTHOR_ROTATION = [
  "Avery Lee",
  "Casey Morgan",
  "Jordan Patel",
  "Riley Quinn",
];
const INTERNAL_LINK_TARGETS = [
  {
    href: "/manual.html",
    buildSentence(keyword) {
      return `For detailed steps, review [our ${keyword} manual](/manual.html) before packing.`;
    },
  },
  {
    href: "/shop.html",
    buildSentence(keyword) {
      return `Compare models in [the ${keyword} shop](/shop.html) to match your routine.`;
    },
  },
  {
    href: "/flight-baggage-limits.html",
    buildSentence(keyword) {
      return `Bookmark [this baggage allowance reference](/flight-baggage-limits.html) so your ${keyword} planning stays aligned with limits.`;
    },
  },
];
const EXTERNAL_LINK_TARGET = {
  href: "https://www.faa.gov/travelers/baggage",
  buildSentence(keyword) {
    return `Cross-check allowances through [federal baggage guidance](${this.href}) to keep every ${keyword} decision compliant.`;
  },
};
const DEFAULT_NEWS_CONFIG = {
  recencyDays: 7,
  cooldownDays: 14,
  topK: 3,
  reuseMargin: 0.3,
  weights: {
    overlap: 0.4,
    fuzzy: 0.3,
    recency: 0.2,
    length: 0.1,
  },
};
const SECTION_SPECS = [
  {
    id: "introduction",
    headingTemplate: "Introduction",
    minWords: 150,
    maxWords: 200,
    purpose:
      "Introduce the topic, highlight reader pain from the news, and present the keyword as a solution.",
    promptNotes: [
      "Open with the news hook to ground the context.",
      "Use 2–3 short paragraphs with active voice.",
      "Mention the keyword naturally within the first 100 words.",
      "Reference the section roadmap to preview what follows.",
    ],
    manualNotes: [
      "Start with the news hook summary.",
      "Name the core problem and promise relief with the keyword.",
      "Target 2–3 short paragraphs.",
    ],
    includeKeywordFirst100: true,
  },
  {
    id: "whyItMatters",
    headingTemplate: "Why It Matters",
    minWords: 150,
    maxWords: 200,
    purpose: "Explain why the news context creates urgency and how readers benefit from acting now.",
    promptNotes: [
      "Connect the news hook to the reader's day-to-day pain points.",
      "Describe tangible stakes and outcomes.",
      "Weave the keyword into at least one sentence.",
    ],
    manualNotes: [
      "Tie the hook to everyday stress.",
      "Show the cost of ignoring the update.",
      "Keep paragraphs compact.",
    ],
  },
  {
    id: "howItWorks",
    headingTemplate: "How {{KEYWORD}} Works",
    minWords: 200,
    maxWords: 300,
    purpose: "Explain the process or workflow for using the keyword effectively with clear steps.",
    promptNotes: [
      "Outline each major step in order using numbered formatting.",
      "Describe what the reader does and why it matters.",
      "Mention the keyword 1–2 times in the narrative.",
    ],
    manualNotes: [
      "List sequential steps with short explanations.",
      "Clarify tools and checkpoints.",
      "Keep sentences under 20 words when possible.",
    ],
    validators: [{ type: "numberedList", min: 3 }],
  },
  {
    id: "keyBenefits",
    headingTemplate: "Key Benefits",
    minWords: 150,
    maxWords: 200,
    purpose: "Detail the top advantages, tying at least one benefit to the news hook.",
    promptNotes: [
      "Use Markdown bullet list with 4–6 items.",
      "Keep each bullet between 12–20 words.",
      "Highlight measurable outcomes for the reader.",
    ],
    manualNotes: [
      "Draft 4–6 bullet points, 12–20 words each.",
      "Link one bullet directly to the news insight.",
    ],
    validators: [{ type: "bulletCount", min: 4, max: 6 }],
  },
  {
    id: "comparison",
    headingTemplate: "Comparison",
    minWords: 200,
    maxWords: 250,
    purpose:
      "Contrast the keyword approach with a familiar alternative, then explain why the keyword wins for the reader.",
    promptNotes: [
      "Include a two-column Markdown table contrasting the keyword solution vs. a common alternative.",
      "Follow the table with a short analysis paragraph summarising the takeaways.",
    ],
    manualNotes: [
      "Build a two-column table (keyword vs. alternative).",
      "Add 1–2 paragraphs interpreting the table.",
    ],
    validators: [{ type: "table" }],
  },
  {
    id: "useCases",
    headingTemplate: "Use Cases",
    minWords: 200,
    maxWords: 250,
    purpose: "Show 3–4 real scenarios where the keyword solves the problem, including one tied to the news hook.",
    promptNotes: [
      "Describe 3–4 scenarios with bolded lead-ins.",
      "Tie at least one scenario directly to the news hook impact.",
    ],
    manualNotes: [
      "Outline 3–4 scenario subheadings with bold intros.",
      "Explain how the keyword resolves each scenario.",
    ],
  },
  {
    id: "proTips",
    headingTemplate: "Pro Tips",
    minWords: 150,
    maxWords: 200,
    purpose: "Provide advanced tactics that reinforce reader confidence and keep them aligned with the news trend.",
    promptNotes: [
      "Create a numbered list of 3–5 tips.",
      "Bold a short label at the start of each tip.",
      "Include the keyword once across the section.",
    ],
    manualNotes: [
      "List 3–5 numbered tips with bold labels.",
      "Focus on actionable, low-effort wins.",
    ],
    validators: [{ type: "numberedList", min: 3, max: 5, requireBold: true }],
  },
  {
    id: "faq",
    headingTemplate: "FAQ",
    minWords: 300,
    maxWords: 400,
    purpose: "Answer the top reader questions related to the keyword and current context.",
    promptNotes: [
      "Provide 5–6 Q&A pairs.",
      "Format each question as 'Q:' on its own line followed by 'A:' lines of 60–80 words.",
      "Ensure the keyword appears in at least two answers.",
    ],
    manualNotes: [
      "List 5–6 questions labelled 'Q:' with matching 'A:' answers (60–80 words).",
      "Blend evergreen and news-aware angles.",
    ],
    validators: [{ type: "faqCount", min: 5, max: 6 }],
  },
  {
    id: "conclusion",
    headingTemplate: "Conclusion + CTA",
    minWords: 100,
    maxWords: 150,
    purpose: "Summarise the key insight and offer a clear call-to-action tied to the keyword.",
    promptNotes: [
      "Reinforce the news hook or evergreen insight in the opening sentence.",
      "Close with a direct call-to-action encouraging the reader to act now.",
    ],
    manualNotes: [
      "Summarise benefits in 1–2 paragraphs.",
      "Add a confident CTA referencing the keyword.",
    ],
  },
];

const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "with",
  ]
);

async function runAutomatedGeneration(options) {
  const config = buildAutomationConfig(options);
  ensureDirectory(config.stateDir);
  ensureDirectory(POSTS_ROOT);

  const keywords = loadKeywordList(config.keywordFile);
  if (!keywords.length) {
    throw new Error(`No keywords found in ${config.keywordFile}.`);
  }

  const state = readAutomationState(config.stateFile);
  const usedHeadlines = readUsedHeadlines(config.usedHeadlinesFile);
  const keywordSelection = selectKeywordForRun(
    keywords,
    state,
    options.keywordOverride
  );
  const keyword = keywordSelection.keyword;
  const slug = slugify(keyword);
  const targetDir = path.join(POSTS_ROOT, slug);
  const now = DateTime.now().setZone("utc");
  if (DEBUG_AUTOMATION) {
    console.log(`Automation debug: selected keyword='${keyword}' slug='${slug}'`);
  }

  if (!options.dryRun && fs.existsSync(targetDir)) {
    throw new Error(
      `Post directory already exists at ${path.relative(
        process.cwd(),
        targetDir
      )}. Use --keyword to override or remove the existing post first.`
    );
  }

  const newsContext = await buildNewsContext({
    keyword,
    config,
    usedHeadlines,
    now,
    options,
  });
  if (DEBUG_AUTOMATION) {
    console.log(`Automation debug: mode=${newsContext.mode}`);
  }

  const authorInfo = rotateAuthor(AUTHOR_ROTATION, state);
  const heroInfo = rotateHeroVariant(HERO_VARIANTS, state);
  const heroSvg = renderHeroSvg({ keyword, slug, variant: heroInfo.variant });

  const metadata = buildAutomationMetadata({
    keyword,
    slug,
    date: now,
    author: authorInfo.name,
    newsContext,
  });

  let sections;
  if (options.fillMode === "manual") {
    sections = buildManualSections({ keyword, newsContext });
    if (DEBUG_AUTOMATION) {
      console.log("Automation debug: built manual placeholders");
    }
  } else {
    const apiKey = config.openai.apiKey;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required for API fill mode. Provide the key or use --mode=manual."
      );
    }
    sections = await generateSectionsWithApi({
      keyword,
      newsContext,
      config,
    });
    insertRequiredLinks(sections, keyword);
    enforceKeywordDensity(sections, keyword);
    if (DEBUG_AUTOMATION) {
      console.log("Automation debug: generated sections via API");
    }
  }

  const totalWords = sections.reduce((sum, entry) => sum + entry.wordCount, 0);
  if (totalWords && totalWords < TOTAL_WORD_TARGET.min) {
    console.warn(
      `Warning: total word count ${totalWords} words is below the desired floor of ${TOTAL_WORD_TARGET.min}.`
    );
  } else if (totalWords && totalWords > TOTAL_WORD_TARGET.max) {
    console.warn(
      `Warning: total word count ${totalWords} words exceeds the desired ceiling of ${TOTAL_WORD_TARGET.max}.`
    );
  }

  const faqSection = sections.find((entry) => entry.spec.id === "faq");
  const faqSchema = buildFaqSchema({
    sectionContent: faqSection ? faqSection.content : "",
    title: metadata.title,
    keyword,
    permalink: metadata.permalink,
  });

  const postContent = composeAutomatedPost({
    metadata,
    heroSvg,
    sections,
    faqSchema,
  });

  if (options.dryRun) {
    console.log(`[dry-run] Would create ${path.join(slug, "index.md")} for '${keyword}'.`);
  } else {
    ensureDirectory(targetDir);
    const outputPath = path.join(targetDir, "index.md");
    fs.writeFileSync(outputPath, `${postContent}\n`, "utf8");
    console.log(`Created ${path.relative(process.cwd(), outputPath)}`);

    if (!keywordSelection.override) {
      state.lastKeywordIndex = keywordSelection.index;
    }
    state.lastAuthorIndex = authorInfo.index;
    state.lastHeroIndex = heroInfo.index;
    writeAutomationState(config.stateFile, state);
    updateUsedHeadlines({
      usedHeadlines,
      selected: newsContext.selectedHeadlines,
      now,
    });
    writeUsedHeadlines(config.usedHeadlinesFile, usedHeadlines);
  }

  console.log(
    `Finished automation run for '${keyword}' using ${
      options.fillMode === "manual" ? "manual" : "API"
    } fill mode.`
  );
  if (DEBUG_AUTOMATION) {
    console.log("Automation debug: run complete");
  }
}

function buildAutomationConfig(options) {
  const stateDir = path.resolve(__dirname, "..", "data");
  const keywordFile = path.resolve(__dirname, "keywords.txt");
  const stateFile = path.join(stateDir, "automation-state.json");
  const usedHeadlinesFile = path.join(stateDir, "used_headlines.json");
  const generalFeeds = options.newsFeedsGeneral || parseEnvList("NEWS_FEEDS_GENERAL");
  const queryFeedTemplates =
    options.newsFeedsQuery || parseEnvList("NEWS_FEEDS_QUERY");
  const newsLimit = options.newsLimit || Number.parseInt(process.env.NEWS_LIMIT || "", 10);

  const newsConfig = {
    ...DEFAULT_NEWS_CONFIG,
  };

  if (Number.isInteger(options.newsRecencyDays)) {
    newsConfig.recencyDays = options.newsRecencyDays;
  } else if (Number.isInteger(Number.parseInt(process.env.NEWS_RECENCY_DAYS || "", 10))) {
    newsConfig.recencyDays = Number.parseInt(process.env.NEWS_RECENCY_DAYS, 10);
  }

  if (Number.isInteger(options.newsCooldownDays)) {
    newsConfig.cooldownDays = options.newsCooldownDays;
  } else if (Number.isInteger(Number.parseInt(process.env.NEWS_COOLDOWN_DAYS || "", 10))) {
    newsConfig.cooldownDays = Number.parseInt(process.env.NEWS_COOLDOWN_DAYS, 10);
  }

  if (!Number.isNaN(Number.parseFloat(process.env.NEWS_REUSE_MARGIN || ""))) {
    newsConfig.reuseMargin = Number.parseFloat(process.env.NEWS_REUSE_MARGIN);
  }
  if (!Number.isNaN(Number.parseFloat(process.env.NEWS_WEIGHT_OVERLAP || ""))) {
    newsConfig.weights.overlap = Number.parseFloat(process.env.NEWS_WEIGHT_OVERLAP);
  }
  if (!Number.isNaN(Number.parseFloat(process.env.NEWS_WEIGHT_FUZZY || ""))) {
    newsConfig.weights.fuzzy = Number.parseFloat(process.env.NEWS_WEIGHT_FUZZY);
  }
  if (!Number.isNaN(Number.parseFloat(process.env.NEWS_WEIGHT_RECENCY || ""))) {
    newsConfig.weights.recency = Number.parseFloat(process.env.NEWS_WEIGHT_RECENCY);
  }
  if (!Number.isNaN(Number.parseFloat(process.env.NEWS_WEIGHT_LENGTH || ""))) {
    newsConfig.weights.length = Number.parseFloat(process.env.NEWS_WEIGHT_LENGTH);
  }

  if (Number.isInteger(newsLimit) && newsLimit > 0) {
    newsConfig.topK = Math.min(newsLimit, 3);
  }

  const openai = {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    endpoint:
      process.env.OPENAI_API_ENDPOINT || "https://api.openai.com/v1/chat/completions",
    temperature: Number.isNaN(Number.parseFloat(process.env.OPENAI_TEMPERATURE || ""))
      ? 0.7
      : Number.parseFloat(process.env.OPENAI_TEMPERATURE),
    maxTokens: Number.isNaN(Number.parseInt(process.env.OPENAI_MAX_TOKENS || "", 10))
      ? 1200
      : Number.parseInt(process.env.OPENAI_MAX_TOKENS, 10),
  };

  return {
    stateDir,
    keywordFile,
    stateFile,
    usedHeadlinesFile,
    newsFeeds: {
      generalFeeds,
      queryFeedTemplates,
    },
    newsConfig,
    openai,
    authors: AUTHOR_ROTATION,
    heroVariants: HERO_VARIANTS,
  };
}

function parseEnvList(name) {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,|\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function loadKeywordList(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readAutomationState(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Warning: unable to parse automation state. Starting fresh. (${error.message})`);
    return {};
  }
}

function writeAutomationState(filePath, state) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function readUsedHeadlines(filePath) {
  if (!fs.existsSync(filePath)) {
    return { entries: {}, history: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.entries || typeof parsed.entries !== "object") {
      return { entries: {}, history: [] };
    }
    parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
    return parsed;
  } catch (error) {
    console.warn(`Warning: unable to parse used headlines file. (${error.message})`);
    return { entries: {}, history: [] };
  }
}

function writeUsedHeadlines(filePath, data) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updateUsedHeadlines({ usedHeadlines, selected, now }) {
  if (!Array.isArray(selected) || !selected.length) {
    return;
  }
  const iso = now.toISO();
  usedHeadlines.entries = usedHeadlines.entries || {};
  usedHeadlines.history = Array.isArray(usedHeadlines.history)
    ? usedHeadlines.history
    : [];
  for (const item of selected) {
    if (!item || !item.url) {
      continue;
    }
    usedHeadlines.entries[item.url] = iso;
    usedHeadlines.history.push({
      url: item.url,
      usedAt: iso,
      title: item.title,
    });
  }
  if (usedHeadlines.history.length > 200) {
    usedHeadlines.history = usedHeadlines.history.slice(-200);
  }
}

function selectKeywordForRun(keywords, state, override) {
  if (override && override.trim().length) {
    const trimmed = override.trim();
    const index = keywords.findIndex((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    return {
      keyword: trimmed,
      index: index >= 0 ? index : 0,
      override: true,
    };
  }
  const lastIndex = Number.isInteger(state.lastKeywordIndex)
    ? state.lastKeywordIndex
    : -1;
  const nextIndex = (lastIndex + 1) % keywords.length;
  return {
    keyword: keywords[nextIndex],
    index: nextIndex,
    override: false,
  };
}

function rotateAuthor(authors, state) {
  const list = Array.isArray(authors) && authors.length ? authors : ["Automation" ];
  const lastIndex = Number.isInteger(state.lastAuthorIndex)
    ? state.lastAuthorIndex
    : -1;
  const nextIndex = (lastIndex + 1) % list.length;
  return {
    name: list[nextIndex],
    index: nextIndex,
  };
}

function rotateHeroVariant(variants, state) {
  const list = Array.isArray(variants) && variants.length ? variants : ["scale"];
  const lastIndex = Number.isInteger(state.lastHeroIndex) ? state.lastHeroIndex : -1;
  const nextIndex = (lastIndex + 1) % list.length;
  return {
    variant: list[nextIndex],
    index: nextIndex,
  };
}

async function buildNewsContext({ keyword, config, usedHeadlines, now, options }) {
  const feeds = resolveFeedUrls({ keyword, config });
  if (DEBUG_AUTOMATION) {
    console.log(`Automation debug: resolved feeds count=${feeds.length}`);
  }
  if (!feeds.length) {
    return buildEvergreenFallback(keyword);
  }

  const headlines = [];
  for (const feedUrl of feeds) {
    if (DEBUG_AUTOMATION) {
      console.log(`Automation debug: fetching feed ${feedUrl}`);
    }
    try {
      const items = await fetchFeed(feedUrl);
      headlines.push(
        ...items.map((item) => ({
          ...item,
          sourceUrl: feedUrl,
        }))
      );
    } catch (error) {
      console.warn(`Warning: failed to load feed ${feedUrl}: ${error.message}`);
    }
  }

  if (!headlines.length) {
    return buildEvergreenFallback(keyword);
  }

  const scored = scoreHeadlines({
    keyword,
    items: headlines,
    now,
    config: config.newsConfig,
  });

  const selectedHeadlines = selectTopHeadlines({
    scored,
    now,
    usedHeadlines,
    config: config.newsConfig,
  });

  if (!selectedHeadlines.length) {
    return buildEvergreenFallback(keyword);
  }

  const hook = buildNewsHookFromHeadlines({ headlines: selectedHeadlines, keyword });

  return {
    mode: "news",
    hook: hook.text,
    selectedHeadlines,
    keyPhrases: hook.keyPhrases,
    primaryPhrase: hook.primaryPhrase,
  };
}

function resolveFeedUrls({ keyword, config }) {
  const urls = new Set();
  const encodedKeyword = encodeURIComponent(keyword);
  const slugKeyword = slugify(keyword);

  for (const template of config.newsFeeds.queryFeedTemplates || []) {
    const filled = template
      .replace(/{{\s*KEYWORD\s*}}/gi, encodedKeyword)
      .replace(/{{\s*KEYWORD_SLUG\s*}}/gi, slugKeyword);
    if (filled) {
      urls.add(filled);
    }
  }
  for (const feed of config.newsFeeds.generalFeeds || []) {
    if (feed) {
      urls.add(feed);
    }
  }
  return Array.from(urls);
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "blog-automation/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const items = parseFeedXml(xml, url);
    return items
      .map((item) => ({
        title: item.title,
        summary: item.summary,
        url: canonicalizeUrl(item.link),
        publishedAt: extractDateFromString(item.published),
        source:
          item.source || deriveHostname(item.link) || deriveHostname(url) || "News source",
      }))
      .filter((entry) => entry.title && entry.url);
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeedXml(xml, fallbackUrl) {
  if (!xml || typeof xml !== "string") {
    return [];
  }
  if (/<rss/i.test(xml)) {
    return parseRssFeed(xml, fallbackUrl);
  }
  if (/<feed/i.test(xml)) {
    return parseAtomFeed(xml, fallbackUrl);
  }
  return [];
}

function parseRssFeed(xml, fallbackUrl) {
  const channelMatch = xml.match(/<channel[\s\S]*?<\/channel>/i);
  const channelBlock = channelMatch ? channelMatch[0] : "";
  const channelTitle = decodeHtmlEntities(extractTagValue(channelBlock, "title"));
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const items = [];
  let match;
  while ((match = itemRegex.exec(xml))) {
    const block = match[0];
    const title = decodeHtmlEntities(extractTagValue(block, "title"));
    const link = decodeHtmlEntities(extractTagValue(block, "link"));
    const summary = decodeHtmlEntities(
      extractTagValue(block, "description") || extractTagValue(block, "content:encoded")
    );
    const published = extractTagValue(block, "pubdate") || extractTagValue(block, "dc:date");
    items.push({
      title,
      link,
      summary,
      published,
      source: channelTitle || deriveHostname(fallbackUrl),
    });
  }
  return items;
}

function parseAtomFeed(xml, fallbackUrl) {
  const feedTitle = decodeHtmlEntities(extractTagValue(xml, "title"));
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  const items = [];
  let match;
  while ((match = entryRegex.exec(xml))) {
    const block = match[0];
    const title = decodeHtmlEntities(extractTagValue(block, "title"));
    const link = decodeHtmlEntities(
      extractAttribute(block, "link", "href") || extractTagValue(block, "link")
    );
    const summary = decodeHtmlEntities(
      extractTagValue(block, "summary") || extractTagValue(block, "content")
    );
    const published =
      extractTagValue(block, "updated") ||
      extractTagValue(block, "published") ||
      extractTagValue(block, "dc:date");
    items.push({
      title,
      link,
      summary,
      published,
      source: feedTitle || deriveHostname(fallbackUrl),
    });
  }
  return items;
}

function extractTagValue(block, tag) {
  if (!block) {
    return "";
  }
  const regex = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, "i");
  const match = block.match(regex);
  if (!match) {
    return "";
  }
  return cleanCdata(match[1]);
}

function extractAttribute(block, tag, attribute) {
  const regex = new RegExp(`<${tag}[^>]*${attribute}="([^"]+)"[^>]*>`, "i");
  const match = block.match(regex);
  return match ? match[1] : "";
}

function cleanCdata(value) {
  if (!value) {
    return "";
  }
  return value
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/]]>/gi, "")
    .trim();
}

function decodeHtmlEntities(value) {
  if (!value) {
    return "";
  }
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function extractDateFromString(value) {
  if (!value) {
    return null;
  }
  const iso = DateTime.fromISO(value, { zone: "utc" });
  if (iso.isValid) {
    return iso;
  }
  const rfc = DateTime.fromRFC2822(value, { zone: "utc" });
  if (rfc.isValid) {
    return rfc;
  }
  const trimmed = value.replace(/\(.+?\)/g, "");
  const alt = DateTime.fromJSDate(new Date(trimmed));
  return alt.isValid ? alt : null;
}

function deriveHostname(url) {
  if (!url) {
    return "";
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function canonicalizeUrl(url) {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const removable = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("utm_") || removable.includes(key)) {
        params.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return url;
  }
}

function scoreHeadlines({ keyword, items, now, config }) {
  const keywordTokens = tokenize(keyword);
  const unique = new Map();
  for (const item of items) {
    if (!item.title || !item.url) {
      continue;
    }
    const key = `${item.url}`;
    if (unique.has(key)) {
      continue;
    }
    unique.set(key, item);
  }

  const scored = [];
  for (const item of unique.values()) {
    const headlineTokens = tokenize(`${item.title} ${item.summary}`);
    const overlap = computeTokenOverlap(keywordTokens, headlineTokens);
    const fuzzy = computeFuzzySimilarity(keyword, item.title);
    const recency = computeRecencyBoost(now, item.publishedAt, config.recencyDays);
    const lengthPrior = computeLengthPrior(headlineTokens.length);
    const score =
      config.weights.overlap * overlap +
      config.weights.fuzzy * fuzzy +
      config.weights.recency * recency +
      config.weights.length * lengthPrior;
    scored.push({
      ...item,
      tokens: headlineTokens,
      overlap,
      fuzzy,
      recency,
      lengthPrior,
      score,
      keyPhrases: extractKeyPhrases(item.title, 3),
      hostname: deriveHostname(item.url),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function tokenize(text) {
  if (!text) {
    return [];
  }
  const matches = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g);
  if (!matches) {
    return [];
  }
  return matches.filter((token) => !STOP_WORDS.has(token));
}

function computeTokenOverlap(keywordTokens, headlineTokens) {
  if (!keywordTokens.length || !headlineTokens.length) {
    return 0;
  }
  const keywordSet = new Set(keywordTokens);
  const headlineSet = new Set(headlineTokens);
  let overlap = 0;
  for (const token of keywordSet) {
    if (headlineSet.has(token)) {
      overlap += 1;
    }
  }
  return overlap / keywordSet.size;
}

function computeFuzzySimilarity(keyword, title) {
  const a = keyword.toLowerCase();
  const b = title.toLowerCase();
  if (!a || !b) {
    return 0;
  }
  if (b.includes(a)) {
    return 1;
  }
  const distance = levenshteinDistance(a, b.slice(0, Math.min(b.length, a.length + 32)));
  const longest = Math.max(a.length, b.length);
  if (!longest) {
    return 0;
  }
  return Math.max(0, 1 - distance / longest);
}

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function computeRecencyBoost(now, publishedAt, recencyDays) {
  if (!publishedAt || !publishedAt.isValid) {
    return 0;
  }
  const diff = now.diff(publishedAt, "days").days;
  if (diff < 0) {
    return 0.5;
  }
  if (diff > recencyDays) {
    return 0;
  }
  return Math.max(0, 1 - diff / Math.max(recencyDays, 1));
}

function computeLengthPrior(tokenCount) {
  if (!tokenCount) {
    return 0;
  }
  const target = 12;
  const diff = Math.abs(tokenCount - target);
  return Math.max(0, 1 - diff / target);
}

function selectTopHeadlines({ scored, now, usedHeadlines, config }) {
  if (!scored.length) {
    return [];
  }
  const entries = usedHeadlines.entries || {};
  const cooldownMs = config.cooldownDays * 24 * 60 * 60 * 1000;
  const fresh = [];
  const cooling = [];
  for (const item of scored) {
    if (!item.url) {
      continue;
    }
    const lastUsedIso = entries[item.url];
    if (lastUsedIso) {
      const lastUsed = Date.parse(lastUsedIso);
      if (!Number.isNaN(lastUsed) && now.toMillis() - lastUsed < cooldownMs) {
        cooling.push(item);
        continue;
      }
    }
    if (item.publishedAt && item.publishedAt.isValid) {
      const diff = now.diff(item.publishedAt, "days").days;
      if (diff > config.recencyDays) {
        continue;
      }
    }
    fresh.push(item);
  }

  const selected = [];
  const hosts = new Set();
  const addCandidate = (candidate) => {
    if (!candidate) {
      return;
    }
    if (hosts.has(candidate.hostname) && fresh.some((item) => !hosts.has(item.hostname))) {
      return;
    }
    hosts.add(candidate.hostname);
    selected.push(candidate);
  };

  for (const candidate of fresh) {
    if (selected.length >= config.topK) {
      break;
    }
    addCandidate(candidate);
  }

  if (selected.length < config.topK) {
    const remainingSlots = config.topK - selected.length;
    const bestFreshScore = fresh.length ? fresh[0].score : 0;
    for (const candidate of cooling) {
      if (selected.length >= config.topK) {
        break;
      }
      if (candidate.score - bestFreshScore >= config.reuseMargin || !fresh.length) {
        addCandidate(candidate);
      }
    }
    if (selected.length < config.topK) {
      for (const candidate of cooling) {
        if (selected.length >= config.topK) {
          break;
        }
        addCandidate(candidate);
      }
    }
  }

  return selected.slice(0, config.topK);
}

function buildNewsHookFromHeadlines({ headlines, keyword }) {
  if (!Array.isArray(headlines) || !headlines.length) {
    return { text: buildEvergreenHook(keyword), keyPhrases: [], primaryPhrase: "" };
  }
  const sentences = [];
  const keyPhrases = headlines.flatMap((item) => item.keyPhrases || []);
  const primaryPhrase = keyPhrases.length ? keyPhrases[0] : keyword;

  const [first, ...rest] = headlines;
  if (first) {
    sentences.push(
      summariseHeadline({
        headline: first,
        keyword,
        lead: true,
      })
    );
  }
  if (rest.length) {
    sentences.push(
      summariseAdditionalHeadlines({ headlines: rest, keyword })
    );
  }

  const variantA = sentences.join(" ").trim();
  const variantB = buildTrendSummary({ headlines, keyword, primaryPhrase });
  const candidates = [variantA, variantB].filter((entry) => entry && entry.length);
  if (!candidates.length) {
    return { text: buildEvergreenHook(keyword), keyPhrases, primaryPhrase };
  }
  candidates.sort((a, b) => Math.abs(a.length - 180) - Math.abs(b.length - 180));
  return { text: candidates[0], keyPhrases, primaryPhrase };
}

function summariseHeadline({ headline, keyword, lead }) {
  const date = headline.publishedAt && headline.publishedAt.isValid
    ? headline.publishedAt.toISODate()
    : "recent";
  const themes = headline.keyPhrases && headline.keyPhrases.length
    ? headline.keyPhrases.join(", ")
    : keyword;
  const prefix = lead
    ? `On ${date}, ${headline.source} outlined developments touching ${keyword}.`
    : `${headline.source} added context on ${date}.`;
  return `${prefix} The coverage emphasised themes such as ${themes}.`;
}

function summariseAdditionalHeadlines({ headlines, keyword }) {
  const segments = headlines.slice(0, 2).map((item) => {
    const date = item.publishedAt && item.publishedAt.isValid
      ? item.publishedAt.toISODate()
      : "recently";
    const themes = item.keyPhrases && item.keyPhrases.length
      ? item.keyPhrases.join(", ")
      : keyword;
    return `${item.source} noted related angles on ${date}, focusing on ${themes}.`;
  });
  if (!segments.length) {
    return "";
  }
  return segments.join(" ");
}

function buildTrendSummary({ headlines, keyword, primaryPhrase }) {
  const dates = headlines
    .map((item) => (item.publishedAt && item.publishedAt.isValid ? item.publishedAt.toISODate() : null))
    .filter(Boolean);
  const earliest = dates.length ? dates[dates.length - 1] : "recent weeks";
  const latest = dates.length ? dates[0] : "recent updates";
  const sources = Array.from(new Set(headlines.map((item) => item.source))).join(", ");
  const phrase = primaryPhrase || keyword;
  return `Coverage from ${sources} between ${earliest} and ${latest} keeps the spotlight on ${phrase}, signalling that ${keyword} decisions should stay proactive.`;
}

function extractKeyPhrases(text, limit = 3) {
  const tokens = tokenize(text);
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token.replace(/-/g, " "));
}

function buildEvergreenFallback(keyword) {
  return {
    mode: "evergreen",
    hook: buildEvergreenHook(keyword),
    selectedHeadlines: [],
    keyPhrases: [keyword],
    primaryPhrase: keyword,
  };
}

function buildEvergreenHook(keyword) {
  return `Ongoing planning reminders highlight how ${keyword} keeps packing calm, expenses predictable, and itineraries on schedule.`;
}

function renderHeroSvg({ keyword, slug, variant }) {
  const idBase = `${slug}-hero`;
  switch (variant) {
    case "suitcase":
      return `
<svg role="img" aria-labelledby="${idBase}-title ${idBase}-desc" viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <title id="${idBase}-title">${toTitleCase(keyword)} travel readiness</title>
  <desc id="${idBase}-desc">Stylised suitcase icon underscoring how ${keyword} keeps trips organised.</desc>
  <rect x="20" y="30" width="120" height="70" rx="10" fill="#f0f4ff" stroke="#2e4a7b" stroke-width="3" />
  <rect x="60" y="15" width="40" height="20" rx="8" fill="#d7e3ff" stroke="#2e4a7b" stroke-width="3" />
  <line x1="40" y1="55" x2="120" y2="55" stroke="#2e4a7b" stroke-width="2" stroke-dasharray="6 6" />
  <circle cx="60" cy="75" r="6" fill="#2e4a7b" />
  <circle cx="100" cy="75" r="6" fill="#2e4a7b" />
</svg>`;
    case "leaf":
      return `
<svg role="img" aria-labelledby="${idBase}-title ${idBase}-desc" viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <title id="${idBase}-title">${toTitleCase(keyword)} sustainability focus</title>
  <desc id="${idBase}-desc">Abstract eco leaf expressing efficient, low-impact choices powered by ${keyword}.</desc>
  <path d="M20 90 C20 35 80 20 140 20 C120 60 100 90 60 100 Z" fill="#d8f3dc" stroke="#2f7d32" stroke-width="3" />
  <path d="M40 85 C60 60 90 45 120 40" stroke="#2f7d32" stroke-width="3" fill="none" stroke-linecap="round" />
</svg>`;
    case "no-battery":
      return `
<svg role="img" aria-labelledby="${idBase}-title ${idBase}-desc" viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <title id="${idBase}-title">${toTitleCase(keyword)} no-battery innovation</title>
  <desc id="${idBase}-desc">Minimal power icon with a strike-through celebrating ${keyword} energy independence.</desc>
  <circle cx="80" cy="55" r="40" fill="#fff3cd" stroke="#b8860b" stroke-width="3" />
  <polyline points="60,55 80,25 80,55 100,35" fill="none" stroke="#b8860b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <line x1="45" y1="30" x2="115" y2="80" stroke="#b94a48" stroke-width="5" stroke-linecap="round" />
</svg>`;
    case "scale":
    default:
      return `
<svg role="img" aria-labelledby="${idBase}-title ${idBase}-desc" viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">
  <title id="${idBase}-title">${toTitleCase(keyword)} accuracy visual</title>
  <desc id="${idBase}-desc">Dial-inspired ${keyword} illustration showing balanced readings for confident travel.</desc>
  <circle cx="80" cy="60" r="45" fill="#eef2ff" stroke="#3f51b5" stroke-width="3" />
  <circle cx="80" cy="60" r="6" fill="#3f51b5" />
  <line x1="80" y1="60" x2="110" y2="50" stroke="#3f51b5" stroke-width="4" stroke-linecap="round" />
  <path d="M40 60 A40 40 0 0 1 120 60" fill="none" stroke="#3f51b5" stroke-width="3" stroke-dasharray="8 6" />
</svg>`;
  }
}

function buildAutomationMetadata({ keyword, slug, date, author, newsContext }) {
  const keywordTitle = toTitleCase(keyword);
  const focusPhrase = newsContext.mode === "news"
    ? toTitleCase((newsContext.primaryPhrase || "trend").split(/\s+/).slice(0, 3).join(" ")) || "Coverage"
    : "Reader Gains";
  const availableSuffixLength = Math.max(
    10,
    TITLE_MAX_LENGTH - keywordTitle.length - 3
  );
  const titleSuffix = truncateByWords(
    newsContext.mode === "news" ? `${focusPhrase} Insights` : `${focusPhrase}`,
    availableSuffixLength
  );
  const title = `${keywordTitle} – ${titleSuffix}`;

  const benefits = newsContext.mode === "news"
    ? [
        "respond to current coverage",
        "steady baggage budgets",
        "boost traveller calm",
      ]
    : [
        "simplify packing routines",
        "avoid surprise fees",
        "increase trip confidence",
      ];
  const expanded = `${keywordTitle} strategies`;
  let subtitle = `${expanded} — ${benefits.join(", ")}.`;
  subtitle = fitLengthRange(subtitle, SUBTITLE_RANGE.min, SUBTITLE_RANGE.max, [
    "Stay agile as rules shift.",
    "Keep every checkpoint predictable.",
  ]);

  const descriptionSegments = [
    `${keyword} keeps planning calm`,
    newsContext.mode === "news"
      ? "aligns actions with fresh coverage"
      : "supports consistent packing wins",
    "and invites you to act now",
  ];
  let description = `${descriptionSegments.join(", ")}.`;
  description = description.replace(/\s+/g, " ").trim();
  description = fitLengthRange(description, DESCRIPTION_RANGE.min, DESCRIPTION_RANGE.max, [
    "Follow the guide to put every step in motion today.",
    "Use the insights to keep every bag compliant and calm.",
  ]);

  const dateIso = date.toISODate();
  const tags = buildTags(keyword, newsContext);

  return {
    title,
    subtitle,
    description,
    date: dateIso,
    author,
    tags,
    keyword,
    slug,
    newsHook: newsContext.hook,
    permalink: `/blog/${slug}/`,
  };
}

function toTitleCase(value) {
  return String(value)
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function truncateByWords(value, maxLength) {
  const words = value.split(/\s+/);
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxLength) {
      break;
    }
    result = next;
  }
  return result || words.slice(0, 2).join(" ");
}

function fitLengthRange(text, min, max, fillers) {
  let result = text;
  let fillerIndex = 0;
  while (result.length < min && fillerIndex < fillers.length) {
    result = `${result} ${fillers[fillerIndex]}`.trim();
    fillerIndex += 1;
  }
  while (result.length > max && result.includes(",")) {
    result = result.replace(/, [^,]+(?=\.|$)/, ".");
  }
  if (result.length > max) {
    result = result.slice(0, max).replace(/\s+[^\s]+$/, "").trim();
    if (!result.endsWith(".")) {
      result = `${result}.`;
    }
  }
  return result;
}

function buildTags(keyword, newsContext) {
  const tags = new Set();
  tags.add(keyword);
  if (newsContext && Array.isArray(newsContext.keyPhrases)) {
    for (const phrase of newsContext.keyPhrases) {
      if (phrase && phrase.length > 2) {
        tags.add(phrase.toLowerCase());
      }
      if (tags.size >= 3) {
        break;
      }
    }
  }
  const fallback = [
    `${keyword.split(" ")[0]} insights`,
    "travel planning",
    "packing strategy",
  ];
  for (const term of fallback) {
    if (tags.size >= 3) {
      break;
    }
    tags.add(term.toLowerCase());
  }
  return Array.from(tags).slice(0, 3);
}

function buildManualSections({ keyword, newsContext }) {
  return SECTION_SPECS.map((spec) => {
    const heading = buildSectionHeading(spec, keyword);
    const notes = spec.manualNotes ? spec.manualNotes.join(" ") : "";
    const placeholder = [
      `<!-- ${heading}: target ${spec.minWords}-${spec.maxWords} words -->`,
      `## ${heading}`,
      `<!-- Purpose: ${spec.purpose} -->`,
      `<!-- Guidance: ${notes} -->`,
      `<!-- Include keyword '${keyword}' and reference this hook: ${newsContext.hook} -->`,
      "",
    ].join("\n");
    return {
      spec,
      heading,
      content: placeholder,
      wordCount: 0,
    };
  });
}

function buildSectionHeading(spec, keyword) {
  return spec.headingTemplate.replace(/{{\s*KEYWORD\s*}}/gi, toTitleCase(keyword));
}

async function generateSectionsWithApi({ keyword, newsContext, config }) {
  const results = [];
  for (const spec of SECTION_SPECS) {
    const heading = buildSectionHeading(spec, keyword);
    const content = await generateSectionContent({
      spec,
      keyword,
      newsContext,
      config,
    });
    const wordCount = countWords(content);
    results.push({
      spec,
      heading,
      content,
      wordCount,
    });
  }
  return results;
}

async function generateSectionContent({ spec, keyword, newsContext, config }) {
  const prompt = buildSectionPrompt({ spec, keyword, newsContext });
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await callOpenAI({ prompt, config: config.openai });
    const text = sanitizeOpenAIResponse(raw);
    const wordCount = countWords(text);
    if (wordCount < spec.minWords || wordCount > spec.maxWords) {
      if (attempt === maxAttempts) {
        throw new Error(
          `${spec.headingTemplate} length ${wordCount} is outside ${spec.minWords}-${spec.maxWords} words.`
        );
      }
      continue;
    }
    if (!validateSectionStructure({ spec, text })) {
      if (attempt === maxAttempts) {
        throw new Error(`Generated ${spec.headingTemplate} section failed structural validation.`);
      }
      continue;
    }
    if (!ensureSectionKeywordPresence({ spec, text, keyword })) {
      if (attempt === maxAttempts) {
        throw new Error(`Generated ${spec.headingTemplate} section is missing the keyword.`);
      }
      continue;
    }
    if (spec.includeKeywordFirst100 && !isKeywordInFirstWords(text, keyword, 100)) {
      if (attempt === maxAttempts) {
        throw new Error(`Introduction does not mention the keyword within the first 100 words.`);
      }
      continue;
    }
    return text.trim();
  }
  throw new Error(`Unable to generate ${spec.headingTemplate} after multiple attempts.`);
}

function buildSectionPrompt({ spec, keyword, newsContext }) {
  const heading = buildSectionHeading(spec, keyword);
  const newsHook = newsContext.mode === "news" ? newsContext.hook : "evergreen";
  const lines = [
    `Write a blog section called "${heading}" for a travel blog.`,
    `Keyword: "${keyword}"`,
    `News hook: "${newsHook}"`,
    `Purpose: ${spec.purpose}`,
    `Length: ${spec.minWords}-${spec.maxWords} words.`,
    "Style: Conversational but professional, reader-friendly, short paragraphs (2–4 sentences), active voice, 15–20 words per sentence.",
    "Requirements:",
    "- Mention the keyword naturally at least once (ideally twice).",
    "- Use concrete details and avoid fluff.",
    "- Output plain text only; rely on Markdown formatting when lists or tables are needed.",
  ];
  if (spec.includeKeywordFirst100) {
    lines.push("- Include the keyword within the first 100 words.");
  }
  for (const note of spec.promptNotes || []) {
    lines.push(`- ${note}`);
  }
  if (newsContext.mode !== "news") {
    lines.push("- Treat the news hook as an evergreen context cue if it says 'evergreen'.");
  }
  return lines.join("\n");
}

async function callOpenAI({ prompt, config }) {
  const body = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You are an expert marketing writer generating Markdown-ready sections. Follow the instructions carefully, use active voice, and keep language accessible.",
      },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  };

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI API returned no content.");
  }
  return content;
}

function sanitizeOpenAIResponse(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function validateSectionStructure({ spec, text }) {
  if (!spec.validators || !spec.validators.length) {
    return true;
  }
  for (const validator of spec.validators) {
    switch (validator.type) {
      case "bulletCount": {
        const bullets = text.split(/\r?\n/).filter((line) => line.trim().startsWith("- "));
        if (bullets.length < validator.min || bullets.length > validator.max) {
          return false;
        }
        break;
      }
      case "numberedList": {
        const numbered = text.split(/\r?\n/).filter((line) => /^\d+\.\s/.test(line.trim()));
        if (numbered.length < (validator.min || 0)) {
          return false;
        }
        if (validator.max && numbered.length > validator.max) {
          return false;
        }
        if (validator.requireBold) {
          if (!numbered.every((line) => /\*\*[\w\W]+\*\*/.test(line))) {
            return false;
          }
        }
        break;
      }
      case "table": {
        const hasTable = /\|/.test(text) && /\|\s*-+\s*\|/.test(text);
        if (!hasTable) {
          return false;
        }
        break;
      }
      case "faqCount": {
        const questions = text.match(/^Q:\s?.+/gim) || [];
        if (questions.length < validator.min || questions.length > validator.max) {
          return false;
        }
        break;
      }
      default:
        break;
    }
  }
  return true;
}

function ensureSectionKeywordPresence({ spec, text, keyword }) {
  const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
  if (pattern.test(text)) {
    return true;
  }
  // Allow keyword variations separated by spaces vs hyphen
  const simplified = keyword.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!simplified) {
    return true;
  }
  return new RegExp(`\\b${escapeRegex(simplified)}\\b`, "i").test(text.replace(/[^a-z0-9]+/gi, " "));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isKeywordInFirstWords(text, keyword, limit) {
  const words = text.split(/\s+/);
  const snippet = words.slice(0, limit).join(" ");
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i").test(snippet);
}

function countWords(text) {
  if (!text) {
    return 0;
  }
  const matches = text.match(/[\p{L}\p{N}']+/gu);
  return matches ? matches.length : 0;
}

function insertRequiredLinks(sections, keyword) {
  const sectionMap = new Map(sections.map((entry) => [entry.spec.id, entry]));
  const internalTargets = [...INTERNAL_LINK_TARGETS];
  const targets = [
    { id: "howItWorks", builder: internalTargets[0] },
    { id: "useCases", builder: internalTargets[1] },
    { id: "proTips", builder: internalTargets[2] },
  ];
  for (const target of targets) {
    const section = sectionMap.get(target.id);
    if (section && target.builder) {
      const sentence = target.builder.buildSentence(keyword);
      if (!section.content.includes(target.builder.href)) {
        section.content = `${section.content.trim()}\n\n${sentence}`.trim();
        section.wordCount = countWords(section.content);
      }
    }
  }

  const externalSentence = EXTERNAL_LINK_TARGET.buildSentence(keyword);
  const externalTarget = sectionMap.get("whyItMatters") || sectionMap.get("faq") || sections[0];
  if (externalTarget && !externalTarget.content.includes(EXTERNAL_LINK_TARGET.href)) {
    externalTarget.content = `${externalTarget.content.trim()}\n\n${externalSentence}`.trim();
    externalTarget.wordCount = countWords(externalTarget.content);
  }
}

function enforceKeywordDensity(sections, keyword) {
  const totalWords = sections.reduce((sum, entry) => sum + entry.wordCount, 0);
  if (!totalWords) {
    return;
  }
  const occurrences = sections.reduce(
    (sum, entry) => sum + countKeywordOccurrences(entry.content, keyword),
    0
  );
  const density = occurrences / totalWords;
  if (density >= KEYWORD_DENSITY_RANGE.min && density <= KEYWORD_DENSITY_RANGE.max) {
    return;
  }
  if (density < KEYWORD_DENSITY_RANGE.min) {
    const desired = Math.ceil(totalWords * DESIRED_KEYWORD_DENSITY);
    const additionalNeeded = Math.max(0, desired - occurrences);
    const reinforcementSentences = buildKeywordReinforcementSentences(keyword);
    for (let i = 0; i < additionalNeeded; i += 1) {
      const section = sections[i % sections.length];
      const sentence = reinforcementSentences[i % reinforcementSentences.length];
      section.content = `${section.content.trim()}\n\n${sentence}`.trim();
      section.wordCount = countWords(section.content);
    }
  } else {
    console.warn(
      `Warning: keyword density ${(density * 100).toFixed(2)}% exceeds ${
        KEYWORD_DENSITY_RANGE.max * 100
      }%. Review manually if needed.`
    );
  }
}

function buildKeywordReinforcementSentences(keyword) {
  return [
    `This ${keyword} approach keeps every checkpoint structured and calm for the reader.`,
    `Adding a ${keyword} to the routine maintains accuracy while reducing last-minute stress.`,
    `Readers can rely on this ${keyword} workflow to protect budgets and confidence.`,
  ];
}

function countKeywordOccurrences(text, keyword) {
  if (!text || !keyword) {
    return 0;
  }
  const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function composeAutomatedPost({ metadata, heroSvg, sections, faqSchema }) {
  const frontMatter = buildFrontMatterForAutomation(metadata);
  const headerLines = [
    `# ${metadata.title}`,
    `**${metadata.subtitle}**`,
    heroSvg.trim(),
  ];
  const sectionBlocks = sections.map((entry) => {
    const body = entry.content.trim();
    return `## ${entry.heading}\n\n${body}`;
  });
  const blocks = [frontMatter, "", ...headerLines, "", ...sectionBlocks];
  if (faqSchema) {
    blocks.push("", `<script type=\"application/ld+json\">\n${faqSchema}\n</script>`);
  }
  return blocks.filter((block) => block !== null && block !== undefined).join("\n\n").trim();
}

function buildFrontMatterForAutomation(metadata) {
  const lines = ["---"];
  const addField = (key, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        return;
      }
      lines.push(`${key}:`);
      value.forEach((item) => {
        lines.push(`  - ${formatYamlValue(item)}`);
      });
      return;
    }
    lines.push(`${key}: ${formatYamlValue(value)}`);
  };

  addField("title", metadata.title);
  addField("subtitle", metadata.subtitle);
  addField("description", metadata.description);
  addField("date", metadata.date);
  addField("permalink", metadata.permalink);
  addField("tags", metadata.tags);
  addField("author", metadata.author);
  addField("newsHook", metadata.newsHook);
  lines.push("---");
  return lines.join("\n");
}

function buildFaqSchema({ sectionContent, title, keyword, permalink }) {
  let entries = parseFaqEntries(sectionContent);
  if (!entries.length) {
    entries = [
      {
        question: `How does ${keyword} support day-to-day planning?`,
        answer:
          `Update this answer with practical guidance showing how ${keyword} keeps packing accurate and low-stress.`,
      },
      {
        question: `What makes ${keyword} valuable when schedules change?`,
        answer:
          `Add detail explaining how ${keyword} handles shifting requirements while protecting the reader's budget and time.`,
      },
      {
        question: `Which travellers benefit most from ${keyword}?`,
        answer:
          `Replace this placeholder with scenarios explaining who gains the most from ${keyword} and why.`,
      },
      {
        question: `How do you maintain ${keyword} accuracy over time?`,
        answer:
          `Share maintenance advice for ${keyword}, including calibration habits and storage tips to keep readings reliable.`,
      },
      {
        question: `What backup plan should readers use alongside ${keyword}?`,
        answer:
          `Provide actionable steps for pairing ${keyword} with checklists or references to stay compliant when rules evolve.`,
      },
    ];
  }
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
  return JSON.stringify(schema, null, 2);
}

function parseFaqEntries(text) {
  if (!text) {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const entries = [];
  let currentQuestion = null;
  let answerLines = [];
  for (const line of lines) {
    if (/^Q:\s?/i.test(line)) {
      if (currentQuestion && answerLines.length) {
        entries.push({
          question: currentQuestion,
          answer: answerLines.join(" ").trim(),
        });
      }
      currentQuestion = line.replace(/^Q:\s?/i, "").trim();
      answerLines = [];
      continue;
    }
    if (/^A:\s?/i.test(line)) {
      answerLines.push(line.replace(/^A:\s?/i, "").trim());
      continue;
    }
    if (line.trim() === "") {
      continue;
    }
    if (answerLines.length) {
      answerLines.push(line.trim());
    }
  }
  if (currentQuestion && answerLines.length) {
    entries.push({
      question: currentQuestion,
      answer: answerLines.join(" ").trim(),
    });
  }
  return entries;
}

main();
