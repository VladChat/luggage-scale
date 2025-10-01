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

def main():
    topic, summary = get_latest_topic()
    prompt = build_prompt(topic, summary)

    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)
        qa_result = posts.qa_check(md_raw)

        if qa_result["ok"]:
            title = topic
            if len(title) > 60:
                print(f"⚠️ Title too long ({len(title)} chars). Rephrasing...")
                title = llm.rephrase_title(title, 60)

            slug = posts.make_slug(title)
            now = datetime.utcnow()
            out_path = Path(f"blog_src/content/posts/{now.year}/{now.month:02d}/{slug}.md")
            out_path.parent.mkdir(parents=True, exist_ok=True)

            # Добавляем YAML frontmatter
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
