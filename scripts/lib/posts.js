const fs = require("fs");
const path = require("path");
const { ensureDir, readFileSafe, writeJsonPretty } = require("./utils");

const REPO_ROOT = path.resolve(__dirname, "../..");
const BLOG_SRC = path.join(REPO_ROOT, "blog-src");
const POSTS_DIR = path.join(BLOG_SRC, "posts");
const POSTS_JSON = path.join(POSTS_DIR, "posts.json");
const STATE_DIR = path.join(REPO_ROOT, "data");
const STATE_FILE = path.join(STATE_DIR, "automation-state.json");
const KEYWORDS_FILE = path.join(REPO_ROOT, "scripts", "keywords.txt");

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
  return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

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
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  writeJsonPretty(POSTS_JSON, list);
}

module.exports = { loadState, saveState, readKeywords, updatePostsIndex, POSTS_DIR };
