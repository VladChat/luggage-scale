const OpenAI = require("openai");

let cachedClient = null;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

module.exports = { openaiChat };
