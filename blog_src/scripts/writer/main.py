import os
import json
from datetime import datetime
from pathlib import Path
from . import llm
from . import posts
from .rss_fetch import get_latest_topic

DATA_DIR = Path("blog_src/data")
KEYWORDS_FILE = DATA_DIR / "keywords.json"
STATE_FILE = DATA_DIR / "state.json"

def load_prompt_template():
    with open("blog_src/config/prompt_template.txt", "r", encoding="utf-8") as f:
        return f.read()

def load_writer_config():
    try:
        with open("blog_src/config/writer_config.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Could not load writer_config.json: {e}")
        return {"title_max_chars": 60}

def load_keywords():
    with open(KEYWORDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"keyword_index": 0, "seen": []}

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def build_prompt(topic: str, summary: str) -> str:
    template = load_prompt_template()
    return template.format(topic=f"{topic}\n\nContext: {summary}")

def safe_title_text(raw_title: str) -> str:
    """
    Возвращает безопасный title не длиннее title_max_chars.
    Использует llm.rephrase_title, если строка слишком длинная.
    """
    config = load_writer_config()
    max_len = config.get("title_max_chars", 60)

    if len(raw_title) <= max_len:
        return raw_title.strip()

    try:
        rewritten = llm.rephrase_title(raw_title, max_len)
        if rewritten:
            return rewritten.strip()
    except Exception as e:
        print(f"⚠️ Title rewrite failed: {e}")

    # Fallback — обрезка
    return raw_title[:max_len].rstrip()

def main():
    topic, summary = get_latest_topic()
    keywords = load_keywords()
    state = load_state()

    # Получаем keyword по индексу
    idx = state.get("keyword_index", 0)
    if idx < 0 or idx >= len(keywords):
        idx = 0
    keyword = keywords[idx].strip()

    prompt = build_prompt(topic, summary)

    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)
        qa_result = posts.qa_check(md_raw)

        if qa_result["ok"]:
            # slug = title + keyword → уникальный и SEO-дружелюбный
            slug_source = f"{topic} {keyword}" if keyword else topic
            slug = posts.make_slug(slug_source)

            now = datetime.utcnow()
            out_path = Path(f"blog_src/content/posts/{now.year}/{now.month:02d}/{slug}.md")
            out_path.parent.mkdir(parents=True, exist_ok=True)

            # Подготовим title
            title = safe_title_text(topic)

            # YAML frontmatter
            frontmatter = (
    f"---
"
    f'title: "{title}"
'
    f"date: {now.isoformat()}Z
"
    f"draft: false
"
    # Category kept simple for now; adjust if you split News/Guides later
    f"categories: ['news']
"
    # Tags: primary = current keyword (lowercased, quotes escaped), fallback = travel
    f"tags: ['{(keyword or \"travel\").replace('\\'', '\\'\\'').lower()}']
"
    f"---

"
)

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(frontmatter + md_raw)

            print(f"✓ New post: {out_path}")

            # увеличиваем keyword_index
            next_idx = (idx + 1) % len(keywords)
            state["keyword_index"] = next_idx
            save_state(state)

            return
        else:
            print(f"⚠️ Attempt {attempt+1} failed QA: {qa_result['errors']}")

    print("❌ Failed to generate a valid post after retries.")

if __name__ == "__main__":
    main()
