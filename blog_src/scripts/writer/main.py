# blog_src/scripts/writer/main.py
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

    txt = (raw_title or "").strip()
    if len(txt) <= max_len:
        return txt

    try:
        rewritten = llm.rephrase_title(txt, max_len)
        if rewritten:
            return rewritten.strip()
    except Exception as e:
        print(f"⚠️ Title rewrite failed: {e}")

    # Fallback — обрезка
    return txt[:max_len].rstrip()


def main():
    topic, summary = get_latest_topic()
    topic = topic or "Travel update"
    summary = summary or ""

    keywords = []
    try:
        keywords = load_keywords()
    except Exception as e:
        print(f"⚠️ Could not load keywords.json: {e}")
        keywords = []

    state = load_state()

    # Получаем keyword по индексу, с защитой от пустого списка
    idx = max(0, int(state.get("keyword_index", 0)))
    if keywords:
        if idx >= len(keywords):
            idx = 0
        keyword = (keywords[idx] or "").strip()
    else:
        keyword = ""

    prompt = build_prompt(topic, summary)

    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)
        qa_result = posts.qa_check(md_raw)

        if qa_result["ok"]:

            # slug = title + keyword → уникальный и SEO-дружелюбный
            slug_source = f"{topic} {keyword}".strip() if keyword else topic
            slug = posts.make_slug(slug_source)

            now = datetime.utcnow()
            out_path = Path(f"blog_src/content/posts/{now.year}/{now.month:02d}/{slug}.md")
            out_path.parent.mkdir(parents=True, exist_ok=True)

            # Подготовим title и экранируем кавычки для YAML
            title = safe_title_text(topic)
            title_escaped = title.replace('"', '\\"')

            # === Формирование тегов ===
            # 4 общих тега — это первые четыре непустых keywords из файла
            common_tags = []
            try:
                common_tags = [
                    (kw or "").strip().lower()
                    for kw in (keywords or [])[:4]
                    if (kw or "").strip()
                ]
            except Exception as e:
                print(f"⚠️ Could not prepare common tags: {e}")
                common_tags = []

            # Динамический (5-й) тег — текущий keyword или fallback
            keyword_tag = (keyword or "travel").strip().lower()

            # Итоговый список: 4 общих + 1 динамический (если не дублируется)
            tags_list = list(common_tags)
            if keyword_tag and (keyword_tag not in tags_list):
                tags_list.append(keyword_tag)

            # Если вообще ничего не вышло — поставим безопасный fallback
            if not tags_list:
                tags_list = ["travel"]

            # Преобразуем список тегов в YAML-friendly строку:
            # каждый тег в одинарных кавычках, одинарные кавычки внутри — задваиваем
            tags_yaml = ", ".join("'" + t.replace("'", "''") + "'" for t in tags_list)

            # YAML front matter
            frontmatter = f"""---
title: "{title_escaped}"
date: {now.isoformat()}Z
draft: false
categories: ['news']
tags: [{tags_yaml}]
---

"""

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(frontmatter + md_raw)

            print(f"✓ New post: {out_path}")

            # увеличиваем keyword_index только если keywords не пустые
            if keywords:
                next_idx = (idx + 1) % len(keywords)
                state["keyword_index"] = next_idx
                save_state(state)

            return
        else:
            print(f"⚠️ Attempt {attempt+1} failed QA: {qa_result['errors']}")

    print("❌ Failed to generate a valid post after retries.")


if __name__ == "__main__":
    main()
