# blog_src/scripts/writer/posts.py
import re
import pathlib
import random
from slugify import slugify

from .qa import qa_check
from .config_loader import load_writer_config

def gather_posts(content_dir: pathlib.Path):
    """
    Собирает метаданные постов для пула внутренних ссылок.
    Ожидается структура: content/posts/YYYY/MM/slug.md
    """
    posts = []
    for md in content_dir.rglob("*.md"):
        rel = md.relative_to(content_dir)
        if len(rel.parts) >= 3:
            y, m = rel.parts[0], rel.parts[1]
            slug = md.stem
            url = f"/blog/posts/{y}/{m}/{slug}/"
            try:
                text = md.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                text = ""
            t = re.search(r'^title:\s*"(.*)"\s*$', text, flags=re.M)
            posts.append({"title": t.group(1) if t else slug, "url": url})
    return posts

def inject_links(md: str, pool: list, n_min: int, n_max: int) -> str:
    """
    Вставляет блоки 'See also: ...' равномерно по абзацам.
    """
    if not pool:
        return md

    n = max(0, min(n_max, n_min if n_min == n_max else random.randint(n_min, n_max)))
    if n == 0:
        return md

    from random import sample
    picks = sample(pool, min(n, len(pool)))
    paras = md.split("\n\n")
    step = max(1, len(paras) // (len(picks) + 1))
    for i, p in enumerate(picks, start=1):
        paras.insert(i * step, f"See also: [{p['title']}]({p['url']})")
    return "\n\n".join(paras)

def make_slug(s: str) -> str:
    """
    Безопасный slug без слэшей — предотвращает создание вложенных директорий (Hugo).
    """
    if not s:
        return "post"
    s = slugify(s)[:80]
    s = s.replace("/", "-").replace("\\", "-")
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "post"

# Проксируем QA наружу (для совместимости с main.py, который зовёт posts.qa_check)
def qa_check_proxy(md_text: str) -> dict:
    return qa_check(md_text)

# Хелпер для конфигурации — всё через единый loader
def get_config() -> dict:
    return load_writer_config()
