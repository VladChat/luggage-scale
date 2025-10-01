import os, json, re, random, datetime, pathlib, hashlib
import feedparser
from slugify import slugify
import openai

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CONTENT = ROOT / "content" / "posts"
CONFIG = ROOT / "config" / "writer_config.json"

def load_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def now_iso():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def choose_keyword(keywords, state):
    i = state.get("keyword_index", 0)
    if not keywords: 
        return "", state
    kw = keywords[i % len(keywords)]
    state["keyword_index"] = (i + 1) % len(keywords)
    return kw, state

def gather_posts():
    posts = []
    for md in CONTENT.rglob("*.md"):
        rel = md.relative_to(CONTENT)
        if len(rel.parts) >= 3:
            y, m = rel.parts[0], rel.parts[1]
            slug = md.stem
            url = f"/blog/posts/{y}/{m}/{slug}/"
            t = re.search(r'^title:\s*"(.*)"', md.read_text(encoding="utf-8"), flags=re.M)
            posts.append({"title": t.group(1) if t else slug, "url": url})
    return posts

def inject_links(md, pool, n_min, n_max):
    if not pool: 
        return md
    n = random.randint(n_min, n_max)
    picks = random.sample(pool, min(n, len(pool)))
    paras = md.split("\n\n")
    step = max(1, len(paras)//(len(picks)+1))
    for i, p in enumerate(picks, start=1):
        paras.insert(i*step, f"See also: [{p['title']}]({p['url']})")
    return "\n\n".join(paras)

def call_llm(prompt):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    resp = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
        temperature=0.7,
        max_tokens=4096
    )
    return resp["choices"][0]["message"]["content"]

# ---------- Front matter fix ----------
def ensure_front_matter(md):
    # Если модель не вернула блок --- --- в начале, обернём первый кусок
    if not md.strip().startswith("---"):
        parts = md.split("\n\n", 1)
        if len(parts) == 2:
            fm, body = parts
            return f"---\n{fm.strip()}\n---\n\n{body.strip()}"
    return md

# ---------- QA ----------
def word_count(text):
    body = re.sub(r"^---.*?---", "", text, flags=re.S)
    return len(re.findall(r"\w+", body, flags=re.U))

def subheadings_count(text):
    return len(re.findall(r"^##\s+|^###\s+", text, flags=re.M))

def has_faq(text):
    return bool(re.search(r"^##\s*faq|^##\s*question", text, flags=re.I|re.M))

def has_internal_link(text):
    return "/blog/posts/" in text

def enforce_draft(text):
    if re.search(r'(?m)^draft:\s*false', text):
        return re.sub(r'(?m)^draft:\s*false', 'draft: true', text)
    if "draft:" not in text:
        return text.replace("---", "---\ndraft: true", 1)
    return text

def qa_check(md_text, cfg):
    ok = True
    thr = cfg.get("qa_thresholds", {})
    w = word_count(md_text)
    if w < thr.get("min_words",1700) or w > thr.get("max_words",2100):
        ok=False; print(f"QA FAIL: words={w}")
    if subheadings_count(md_text) < thr.get("min_subheadings",6):
        ok=False; print("QA FAIL: subheadings")
    if thr.get("require_faq",True) and not has_faq(md_text):
        ok=False; print("QA FAIL: FAQ missing")
    if thr.get("require_internal_links",True) and not has_internal_link(md_text):
        ok=False; print("QA FAIL: no internal links")
    if not ok and cfg.get("draft_if_fail",True):
        md_text = enforce_draft(md_text)
        print("→ Marked as draft:true")
    else:
        print("QA OK")
    return md_text

# ---------- main ----------
def main():
    cfg = load_json(CONFIG, {})
    rss = load_json(DATA/"rss.json", [])
    keywords = load_json(DATA/"keywords.json", [])
    state = load_json(DATA/"state.json", {"keyword_index":0,"seen":[]})
    seen = set(state.get("seen", []))

    entry = None; entry_id=None
    for feed_url in rss:
        for e in feedparser.parse(feed_url).entries[:20]:
            link = e.get("link","")
            guid = hashlib.sha1(link.encode()).hexdigest()
            if guid not in seen:
                entry, entry_id = e, guid; break
        if entry: break
    if not entry:
        print("No new entries"); return

    kw, state = choose_keyword(keywords, state)
    news_title = entry.get("title","")
    news_summary = entry.get("summary","")
    news_link = entry.get("link","")

    prompt = f"""
You are writing an SEO long-form blog post for Hugo PaperMod (language: {cfg['language']}).
Requirements:
- {cfg['post_length_min']}–{cfg['post_length_max']} words
- subheadings every ~{cfg['subheading_interval']} words (H2/H3)
- FAQ {cfg['faq_count_min']}–{cfg['faq_count_max']} questions
- headings ≤ {cfg['h2_max_chars']} characters
- return valid Markdown with YAML front matter wrapped in --- delimiters + body

Front matter must include:
title, date, description, draft=false, tags=[keyword], categories=["News"],
cover (image=/blog/images/covers/default.jpg, alt from title),
canonicalURL, sources=[{news_link}].

News: {news_title} – {news_summary}
Keyword: "{kw}"
"""

    md = call_llm(prompt)

    # fix front matter if model returned it as plain text
    md = ensure_front_matter(md)

    # inject internal links
    pool = gather_posts()
    if len(pool) >= cfg["min_link_pool_posts"]:
        md = inject_links(md, pool, cfg["internal_links_min"], cfg["internal_links_max"])

    # QA check
    md = qa_check(md, cfg)

    # save
    today = datetime.datetime.utcnow()
    y, m = today.strftime("%Y"), today.strftime("%m")
    slug = slugify(news_title)[:80] or hashlib.sha1(news_title.encode()).hexdigest()[:12]
    post_dir = CONTENT / y / m
    post_dir.mkdir(parents=True, exist_ok=True)
    path = post_dir / f"{slug}.md"
    path.write_text(md, encoding="utf-8")

    state["seen"] = sorted(seen | {entry_id})
    save_json(DATA/"state.json", state)
    print(f"✓ New post: {path}")

if __name__=="__main__":
    main()
