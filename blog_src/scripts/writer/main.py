
import os, json, re, datetime, pathlib, hashlib, feedparser
from typing import Tuple
from . import llm
from .yaml_utils import build_front_matter, clamp
from .posts import gather_posts, inject_links, make_slug
from .qa import qa_decide_draft

ROOT = pathlib.Path(__file__).resolve().parents[2]  # .../blog-src
DATA = ROOT / "data"
CONTENT = ROOT / "content" / "posts"
CONFIG = ROOT / "config" / "writer_config.json"

def load_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def now_iso():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

FRONT_MATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.S)

def strip_front_matter(md: str) -> str:
    return FRONT_MATTER_RE.sub("", md, count=1)

def extract_h1(md: str) -> Tuple[str, str]:
    m = re.search(r"^#\s+(.+?)\s*$", md, flags=re.M)
    if not m:
        return "", md.strip()
    title = m.group(1).strip()
    start, end = m.span()
    body = (md[:start] + md[end:]).lstrip("\n")
    return title, body.strip()

def main():
    cfg = load_json(CONFIG, {})
    rss = load_json(DATA / "rss.json", [])
    keywords = load_json(DATA / "keywords.json", [])
    state = load_json(DATA / "state.json", {"keyword_index": 0, "seen": []})
    seen = set(state.get("seen", []))

    # choose feed entry
    entry = None; entry_id = None
    for feed_url in rss:
        for e in feedparser.parse(feed_url).entries[:20]:
            link = e.get("link", "")
            if not link: 
                continue
            guid = hashlib.sha1(link.encode()).hexdigest()
            if guid not in seen:
                entry, entry_id = e, guid
                break
        if entry:
            break
    if not entry:
        print("No new entries")
        return

    # keyword rotation
    i = state.get("keyword_index", 0)
    kw = keywords[i % len(keywords)] if keywords else ""
    state["keyword_index"] = (i + 1) % (len(keywords) if keywords else 1)

    news_title = (entry.get("title") or "").strip()
    news_summary = (entry.get("summary") or "").strip()
    news_link = (entry.get("link") or "").strip()

    prompt = f"""
You are writing an SEO long-form blog post for Hugo PaperMod. Language: {cfg.get('language','en')}.
Requirements:
- {cfg.get('post_length_min', 1800)}–{cfg.get('post_length_max', 2000)} words
- Subheadings every ~{cfg.get('subheading_interval', 250)} words (use H2/H3)
- FAQ {cfg.get('faq_count_min', 3)}–{cfg.get('faq_count_max', 5)} questions
- Headings ≤ {cfg.get('h2_max_chars', 60)} characters
- Return valid Markdown BODY only. **Do NOT include any YAML front matter.**
- Start with a single H1 (# ...), then content.

Base it on this news (rewrite in your own words, no copying):
Title: {news_title}
Summary: {news_summary}
Source: {news_link}

Primary keyword (use naturally, no keyword stuffing): "{kw}"
"""

    md_raw = llm.call_llm(prompt)
    body_only = strip_front_matter(md_raw)
    h1_title, body = extract_h1(body_only)
    final_title = h1_title or news_title or "Travel update"

    # description from first paragraph
    first_para = (body.split("\n\n", 1)[0] if body else "")[:400]
    description = clamp(first_para, cfg.get("description_max_chars", 160))
    title_clamped = clamp(final_title, cfg.get("title_max_chars", 60))

    # internal links
    pool = gather_posts(CONTENT)
    if len(pool) >= cfg.get("min_link_pool_posts", 5):
        body = inject_links(body, pool, cfg.get("internal_links_min", 1), cfg.get("internal_links_max", 3))

    # paths/slug
    today = datetime.datetime.utcnow()
    y, m = today.strftime("%Y"), today.strftime("%m")
    from hashlib import sha1
    slug = make_slug(h1_title or news_title or "update")
    post_dir = CONTENT / y / m
    post_dir.mkdir(parents=True, exist_ok=True)
    path = post_dir / f"{slug}.md"

    # front matter
    date_iso = now_iso()
    lastmod_iso = now_iso()
    canonical = f"https://luggage-scale.com/blog/posts/{y}/{m}/{slug}/"
    cover_image = "/blog/images/covers/default.jpg"
    cover_alt = title_clamped

    fm = build_front_matter(
        title=title_clamped,
        description=description,
        date_iso=date_iso,
        lastmod_iso=lastmod_iso,
        keyword=kw,
        canonical=canonical,
        cover_image=cover_image,
        cover_alt=cover_alt,
        news_link=news_link,
        draft=False,
    )

    md_composed = fm + "\n" + body.strip() + "\n"

    # QA
    if qa_decide_draft(md_composed, cfg):
        fm_draft = build_front_matter(
            title=title_clamped,
            description=description,
            date_iso=date_iso,
            lastmod_iso=lastmod_iso,
            keyword=kw,
            canonical=canonical,
            cover_image=cover_image,
            cover_alt=cover_alt,
            news_link=news_link,
            draft=True,
        )
        md_composed = fm_draft + "\n" + body.strip() + "\n"
        print("→ Marked as draft:true")
    else:
        print("QA OK")

    # save and update state
    path.write_text(md_composed, encoding="utf-8")
    seen.add(hashlib.sha1(news_link.encode()).hexdigest())
    state["seen"] = sorted(seen)
    save_json(DATA / "state.json", state)
    print(f"✓ New post: {path}")

if __name__ == "__main__":
    main()
