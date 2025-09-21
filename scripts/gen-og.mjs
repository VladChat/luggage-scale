// Generate simple Open Graph images for each post.
// Output: blog-src/_generated/og/<slug>.png

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import fg from "fast-glob";
import matter from "gray-matter";
import { Resvg } from "@resvg/resvg-js";

const ROOT = process.cwd();
const POSTS_GLOB = "blog-src/posts/*/index.md";
const OUT_DIR = path.join(ROOT, "blog-src", "_generated", "og");

// Load site config (brand color, site name, etc.)
const cfgPath = path.join(ROOT, "blog-src", "_data", "config.json");
let cfg = {};
try {
  cfg = JSON.parse(await fsp.readFile(cfgPath, "utf8"));
} catch {}
const brand = (cfg?.site?.brandColor) || "#0b5fff";
const siteName = (cfg?.site?.name) || "Blog";

await fsp.mkdir(OUT_DIR, { recursive: true });

/** crude word-wrapping for SVG <text> */
function wrap(title, max = 28) {
  const words = (title || "").toString().trim().split(/\s+/);
  const lines = [];
  let cur = [];
  for (const w of words) {
    const test = [...cur, w].join(" ");
    if (test.length > max && cur.length) {
      lines.push(cur.join(" "));
      cur = [w];
    } else {
      cur.push(w);
    }
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines.slice(0, 5);
}

function svgFor(title, subtitle) {
  const lines = wrap(title, 30);
  const lineHeight = 64;
  const startY = 280 - ((lines.length - 1) * lineHeight) / 2;

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand}"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="rgba(255,255,255,0.08)"/>
  <text x="600" y="${startY}" text-anchor="middle"
        font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="64" font-weight="700"
        fill="#ffffff" letter-spacing="0.5">
    ${lines.map((l, i) => `<tspan x="600" dy="${i ? lineHeight : 0}">${l.replace(/&/g, "&amp;")}</tspan>`).join("")}
  </text>
  <text x="60" y="585" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="28" fill="#ffffff99">${subtitle}</text>
</svg>`;
}

async function generate() {
  const entries = await fg(POSTS_GLOB, { dot: false });

  for (const file of entries) {
    const raw = await fsp.readFile(path.join(ROOT, file), "utf8");
    const fm = matter(raw);
    const dir = path.dirname(file);
    const slug = path.basename(dir);
    const title = fm.data?.title || slug.replace(/[-_]/g, " ");
    const subtitle = siteName;

    const svg = svgFor(title, subtitle);
    const r = new Resvg(svg, {
      background: "rgba(0,0,0,0)",
      fitTo: { mode: "width", value: 1200 }
    });
    const png = r.render().asPng();

    const outFile = path.join(OUT_DIR, `${slug}.png`);
    await fsp.writeFile(outFile, png);
    console.log(`OG ✓  ${slug}.png`);
  }
}

await generate();
console.log(`OG images written to ${OUT_DIR}`);
