
import re
import pathlib
import random
from slugify import slugify

def gather_posts(content_dir: pathlib.Path):
    posts = []
    for md in content_dir.rglob("*.md"):
        rel = md.relative_to(content_dir)
        if len(rel.parts) >= 3:
            y, m = rel.parts[0], rel.parts[1]
            slug = md.stem
            url = f"/blog/posts/{y}/{m}/{slug}/"
            text = md.read_text(encoding="utf-8")
            t = re.search(r'^title:\s*"(.*)"\s*$', text, flags=re.M)
            posts.append({"title": t.group(1) if t else slug, "url": url})
    return posts

def inject_links(md: str, pool: list, n_min: int, n_max: int) -> str:
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
    if not s:
        return "post"
    s = slugify(s)[:80]
    return s or "post"

def qa_check(md_text: str) -> dict:
    """
    Простая проверка качества текста.
    Возвращает dict: {"ok": bool, "errors": [список ошибок]}
    """
    errors = []
    words = len(md_text.split())
    subheadings = md_text.count("## ")
    faq = "FAQ" in md_text or "?" in md_text

    if words < 1400:
        errors.append(f"words={words} (<1400)")
    if subheadings < 6:
        errors.append(f"subheadings={subheadings} (<6)")
    if not faq:
        errors.append("FAQ missing")

    return {"ok": len(errors) == 0, "errors": errors}
