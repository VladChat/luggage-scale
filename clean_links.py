import os
import re

# Папки
CONTENT_DIR = "blog_src/content"
POSTS_DIR = os.path.join(CONTENT_DIR, "posts")

# Собираем список реально существующих страниц
existing = set()
for root, _, files in os.walk(CONTENT_DIR):
    for f in files:
        if f.endswith(".md"):
            slug = "/" + os.path.relpath(os.path.join(root, f), CONTENT_DIR).replace("\\", "/").replace(".md", "")
            existing.add(slug)

# Регекс для markdown-ссылок [текст](/blog/...)
link_pattern = re.compile(r"\[([^\]]+)\]\((/blog[^\)]+)\)")

changed_files = 0

for root, _, files in os.walk(POSTS_DIR):
    for f in files:
        if f.endswith(".md"):
            path = os.path.join(root, f)
            text = open(path, encoding="utf-8").read()

            def repl(m):
                label, url = m.groups()
                norm = url.split("?")[0].split("#")[0].rstrip("/")
                check = norm[5:] if norm.startswith("/blog") else norm
                if check not in existing:
                    return label  # убираем ссылку
                return m.group(0)

            new = link_pattern.sub(repl, text)
            if new != text:
                with open(path, "w", encoding="utf-8") as f2:
                    f2.write(new)
                print("Cleaned:", path)
                changed_files += 1

print("✅ Done. Files changed:", changed_files)
