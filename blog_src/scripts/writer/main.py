import os
from datetime import datetime
from pathlib import Path
from . import llm
from . import posts

def load_prompt_template():
    with open("blog_src/config/prompt_template.txt", "r", encoding="utf-8") as f:
        return f.read()

def build_prompt(topic: str) -> str:
    template = load_prompt_template()
    return template.format(topic=topic)

def main():
    # Получаем тему поста (заглушка: берем из RSS или фиксированный заголовок)
    topic = "New Nonrefundable Travel Options Save Money Until They Backfire"
    prompt = build_prompt(topic)

    max_attempts = 3
    for attempt in range(max_attempts):
        md_raw = llm.call_llm(prompt)

        # Проверка качества (через posts.qa_check)
        qa_result = posts.qa_check(md_raw)
        if qa_result["ok"]:
            # Сохраняем пост
            slug = posts.make_slug(topic)
            now = datetime.utcnow()
            out_path = Path(f"blog_src/content/posts/{now.year}/{now.month:02d}/{slug}.md")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(md_raw)
            print(f"✓ New post: {out_path}")
            return
        else:
            print(f"⚠️ Attempt {attempt+1} failed QA: {qa_result['errors']}")

    print("❌ Failed to generate a valid post after retries.")

if __name__ == "__main__":
    main()
