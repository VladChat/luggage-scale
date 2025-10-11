# blog_src/scripts/writer/main.py
import json
from datetime import datetime
from pathlib import Path

from . import llm
from . import posts
from .rss_fetch import get_latest_topic
from .config_loader import load_writer_config

DATA_DIR = Path("blog_src/data")
KEYWORDS_FILE = DATA_DIR / "keywords.json"
STATE_FILE = DATA_DIR / "state.json"
CONTENT_DIR = Path("blog_src/content/posts")


def load_prompt_template() -> str:
    with open("blog_src/config/prompt_template.txt", "r", encoding="utf-8") as f:
        return f.read()


def load_keywords() -> list:
    with open(KEYWORDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_state() -> dict:
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"keyword_index": 0, "seen": []}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def build_prompt(topic: str, summary: str) -> str:
    template = load_prompt_template()
    return template.format(topic=f"{topic}\n\nContext: {summary}")


def main():
    cfg = load_writer_config()

    # 1) Тема и краткий контекст
    topic, summary = get_latest_topic()
    topic = topic or "Travel update"
    summary = summary or ""

    # 🧾 Расширенное логирование RSS и финального topic-context
    print("───────────────────────────────")
    print("📰 Extracted from RSS:")
    print(f"Title: {topic}")
    if summary:
        print(f"Summary: {summary[:400]}{'...' if len(summary) > 400 else ''}")
    else:
        print("Summary: (no summary provided)")
    print()
    topic_context_str = f"{topic}\n\nContext: {summary}"
    print("🧩 Final topic-context sent to GPT:")
    print(topic_context_str[:600] + ("..." if len(topic_context_str) > 600 else ""))
    print("───────────────────────────────")

    # 2) Ключевые слова и состояние
    try:
        keywords = load_keywords()
    except Exception as e:
        print(f"⚠️ Could not load keywords.json: {e}")
        keywords = []

    state = load_state()
    idx = max(0, int(state.get("keyword_index", 0)))
    if keywords:
        if idx >= len(keywords):
            idx = 0
        keyword = (keywords[idx] or "").strip()
    else:
        keyword = ""

    # 3) Промпт
    prompt = build_prompt(topic, summary)

    # 4) Генерация с QA-повтором
    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)

        # posts.qa_check_proxy → единый QA из qa.py
        qa_result = posts.qa_check_proxy(md_raw)
        if qa_result["ok"]:
            # 5) Формируем slug и путь
            slug_source = f"{topic} {keyword}".strip() if keyword else topic
            slug = posts.make_slug(slug_source)

            now = datetime.utcnow()
            out_path = CONTENT_DIR / f"{now.year}/{now.month:02d}/{slug}.md"
            out_path.parent.mkdir(parents=True, exist_ok=True)

            # 6) Заголовок — напрямую используем topic (без повторного LLM)
            title = (topic or "Travel article").strip()
            title_escaped = title.replace('"', '\\"')

            # 7) Категория по умолчанию из конфига (единичная)
            default_category = cfg.get("default_category", "news")
            categories_json = f"['{default_category}']"

            # 8) Теги — 4 общих ключевых + 1 динамический (если он уникален)
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
            keyword_tag = (keyword or "travel").strip().lower()
            tags_list = list(common_tags)
            if keyword_tag and (keyword_tag not in tags_list):
                tags_list.append(keyword_tag)
            if not tags_list:
                tags_list = ["travel"]
            tags_yaml = ", ".join("'" + t.replace("'", "''") + "'" for t in tags_list)

            # 9) YAML front matter
            fm = (
                f"---\n"
                f'title: "{title_escaped}"\n'
                f"date: {now.isoformat()}Z\n"
                f"draft: false\n"
                f"categories: {categories_json}\n"
                f"tags: [{tags_yaml}]\n"
                f"---\n\n"
            )

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(fm + md_raw)

            print(f"✓ New post: {out_path}")

            # 10) Обновляем индекс keyword
            if keywords:
                next_idx = (idx + 1) % len(keywords)
                state["keyword_index"] = next_idx
                save_state(state)

            return
        else:
            print(f"⚠️ Attempt {attempt + 1} failed QA: {qa_result['errors']}")

    # Если мы здесь — три попытки не прошли.
    if cfg.get("draft_if_fail", True):
        now = datetime.utcnow()
        fallback_slug = posts.make_slug(f"{topic}-draft")
        out_path = CONTENT_DIR / f"{now.year}/{now.month:02d}/{fallback_slug}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        title = (topic or "Travel article").strip()
        title_escaped = title.replace('"', '\\"')
        default_category = cfg.get("default_category", "news")
        categories_json = f"['{default_category}']"

        fm = (
            f"---\n"
            f'title: "{title_escaped}"\n'
            f"date: {now.isoformat()}Z\n"
            f"draft: true\n"
            f"categories: {categories_json}\n"
            f"tags: ['draft']\n"
            f"---\n\n"
            f"(Auto-saved draft after QA failures)\n\n"
        )

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(fm)

        print(f"📝 Saved draft: {out_path}")
    else:
        print("❌ Failed to generate a valid post after retries.")


if __name__ == "__main__":
    main()
