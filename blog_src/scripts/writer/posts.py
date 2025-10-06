import re
import pathlib
import random
from slugify import slugify
import json

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
    """
    Безопасный slug без слэшей. Это предотвращает появление вложенных директорий
    (например /sec/) в финальном пути Hugo.
    """
    if not s:
        return "post"
    # Базовая нормализация
    s = slugify(s)[:80]
    # Жёстко убираем любые слэши, чтобы Hugo не создал подпапки
    s = s.replace("/", "-").replace("\\", "-")
    # Схлопываем повторные дефисы и подчищаем края
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "post"

def load_writer_config():
    try:
        with open("blog_src/config/writer_config.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Could not load writer_config.json: {e}")
        return {
            "qa_thresholds": {
                "min_words": 1000,
                "max_words": 3000,
                "min_subheadings": 5,
                "require_faq": True,
                "require_internal_links": False
            }
        }

def qa_check(md_text: str) -> dict:
    """
    Проверка качества текста по правилам из writer_config.json.
    Возвращает dict: {"ok": bool, "errors": [список ошибок]}
    """
    config = load_writer_config()
    rules = config.get("qa_thresholds", {})

    min_words = rules.get("min_words", 0)
    max_words = rules.get("max_words", 99999)
    min_subheadings = rules.get("min_subheadings", 0)
    require_faq = rules.get("require_faq", False)
    # internal links check полностью отключена
    # require_internal_links = rules.get("require_internal_links", False)

    errors = []
    words = len(md_text.split())
    subheadings = md_text.count("## ")
    has_faq = "FAQ" in md_text or "?" in md_text
    # has_link = "<a href=" in md_text  # отключено

    if words < min_words:
        errors.append(f"words={words} (<{min_words})")
    if words > max_words:
        errors.append(f"words={words} (>{max_words})")
    if subheadings < min_subheadings:
        errors.append(f"subheadings={subheadings} (<{min_subheadings})")
    if require_faq and not has_faq:
        errors.append("FAQ missing")
    # if require_internal_links and not has_link:
    #     errors.append("internal links missing")

    return {"ok": len(errors) == 0, "errors": errors}
