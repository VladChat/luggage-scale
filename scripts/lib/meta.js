const fs = require("fs");
const path = require("path");
const { toTitleCase } = require("./utils");
const { openaiChat } = require("./openai");

const BLOG_SRC = path.join(path.resolve(__dirname, "../.."), "blog-src");
const PRODUCTS_DIR = path.join(BLOG_SRC, "static", "products");

function pickHeroImage() {
  try {
    const files = fs.existsSync(PRODUCTS_DIR)
      ? fs.readdirSync(PRODUCTS_DIR).filter(n => /\.(svg|png|jpg|jpeg|webp)$/i.test(n))
      : [];
    const fallback = "static/products/upatch-digital-scale.svg";
    if (!files.length) return fallback;
    const pick = files[Math.floor(Math.random() * files.length)];
    return `static/products/${pick}`;
  } catch {
    return "static/products/upatch-digital-scale.svg";
  }
}

async function generateMeta(keyword, newsContext) {
  const system = "You are an expert editorial assistant for a travel gear brand blog. You create concise, compelling metadata.";
  const user = `Keyword: "${keyword}"\n\nWrite JSON with two fields:\n- subtitle: 8–12 words, engaging and natural\n- description: 140–160 characters, actionable meta description without quotes\n\n${newsContext ? "News context:\n" + newsContext : ""}\n\nReturn ONLY compact JSON.`;
  const out = await openaiChat([{ role: "system", content: system }, { role: "user", content: user }]);
  try {
    const parsed = JSON.parse(out);
    let subtitle = String(parsed.subtitle || "").trim();
    let description = String(parsed.description || "").trim();
    if (!subtitle) subtitle = toTitleCase(keyword);
    if (!description) description = `Tips and guidance on ${keyword.toLowerCase()} to help travelers avoid baggage fees.`;
    return { subtitle, description };
  } catch {
    return { subtitle: toTitleCase(keyword), description: `Guide on ${keyword.toLowerCase()} for travelers.` };
  }
}

module.exports = { pickHeroImage, generateMeta };
