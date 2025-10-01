import os
from datetime import datetime
from pathlib import Path
from . import llm
from . import posts
from .rss_fetch import get_latest_topic
import json

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
    prompt = build_prompt(topic, summary)

    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)
        qa_result = posts.qa_check(md_raw)

        if qa_result["ok"]:
            slug = posts.make_slug(topic)
            now = datetime.utcnow()
            out_path = Path(f"blog_src/content/posts/{now.year}/{now.month:02d}/{slug}.md")
            out_path.parent.mkdir(parents=True, exist_ok=True)

            # Подготовим title
            title = safe_title_text(topic)

            # YAML frontmatter
            frontmatter = (
                f"---\n"
                f'title: "{title}"\n'
                f"date: {now.isoformat()}Z\n"
                f"draft: false\n"
                f"---\n\n"
            )

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(frontmatter + md_raw)

            print(f"✓ New post: {out_path}")
            return
        else:
            print(f"⚠️ Attempt {attempt+1} failed QA: {qa_result['errors']}")

    print("❌ Failed to generate a valid post after retries.")

if __name__ == "__main__":
    main()
