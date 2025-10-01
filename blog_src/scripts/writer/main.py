import os
from datetime import datetime
from pathlib import Path
from . import llm
from . import posts
from .rss_fetch import get_latest_topic


def load_prompt_template():
    with open("blog_src/config/prompt_template.txt", "r", encoding="utf-8") as f:
        return f.read()


def build_prompt(topic: str, summary: str) -> str:
    template = load_prompt_template()
    return template.format(topic=f"{topic}\n\nContext: {summary}")


def sanitize_yaml_value(s: str) -> str:
    """
    Делает строку безопасной для YAML:
    - заменяет двойные кавычки на одинарные
    - убирает переносы строк
    - обрезает пробелы
    """
    if not s:
        return ""
    s = s.replace('"', "'")
    s = s.replace("\n", " ").strip()
    return s


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

            # Санитизируем заголовок
            safe_title = sanitize_yaml_value(topic)

            # Формируем YAML фронтматтер
            frontmatter = (
                f"---\n"
                f'title: "{safe_title}"\n'
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
