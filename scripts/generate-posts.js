#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

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

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
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
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    limit: DEFAULT_LIMIT,
    dryRun: false,
  };
  const positional = [];

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [flag, value] = arg.slice(2).split("=");
    switch (flag) {
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
      case "dry-run": {
        options.dryRun = true;
        break;
      }
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
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

main();
