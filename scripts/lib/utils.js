const fs = require("fs");
const path = require("path");

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

module.exports = {
  ensureDir,
  readFileSafe,
  writeJsonPretty,
  toTitleCase,
  slugify,
  nowIso,
  stamp,
  countWords
};
