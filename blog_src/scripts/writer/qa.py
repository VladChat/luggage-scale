# blog_src/scripts/writer/qa.py
import re
from .config_loader import load_writer_config

# --- Front matter-aware helpers ---
FRONT_MATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.S)

def _strip_front_matter(text: str) -> str:
    return FRONT_MATTER_RE.sub("", text, count=1)

def word_count(text: str) -> int:
    body = _strip_front_matter(text)
    return len(re.findall(r"\w+", body, flags=re.U))

def subheadings_count(text: str) -> int:
    body = _strip_front_matter(text)
    return len(re.findall(r"^##\s+|^###\s+", body, flags=re.M))

def has_faq(text: str) -> bool:
    body = _strip_front_matter(text)
    return bool(re.search(r"^##\s*(faq|questions)\b", body, flags=re.I | re.M))

def has_internal_link(text: str) -> bool:
    # Простая эвристика для внутренних ссылок Hugo
    return "/blog/posts/" in text

def _extract_faq_block(text: str) -> str | None:
    body = _strip_front_matter(text)
    m = re.search(r"(?s)^##\s*(?:faq|questions).*?(?=^##\s|\Z)", body, flags=re.I | re.M)
    return m.group(0) if m else None

# --- Единственная точка QA ---
def qa_check(md_text: str) -> dict:
    """
    Базовый QA-контроль по конфигу:
      - длина
      - количество подзаголовков
      - наличие FAQ (опционально)
      - наличие внутренних ссылок (опционально)
      - строгий режим валидирует структуру Q:/A: внутри FAQ
    Возвращает: {"ok": bool, "errors": [строки]}
    """
    cfg = load_writer_config()
    thr = cfg.get("qa_thresholds", {})

    errors: list[str] = []

    w = word_count(md_text)
    if w < thr.get("min_words", 0):
        errors.append(f"words={w} (<{thr.get('min_words')})")
    if w > thr.get("max_words", 1_000_000):
        errors.append(f"words={w} (>{thr.get('max_words')})")

    subs = subheadings_count(md_text)
    if subs < thr.get("min_subheadings", 0):
        errors.append(f"subheadings={subs} (<{thr.get('min_subheadings')})")

    if thr.get("require_faq", False) and not has_faq(md_text):
        errors.append("FAQ missing")

    if thr.get("require_internal_links", False) and not has_internal_link(md_text):
        errors.append("internal links missing")

    # strict: проверяем структуру FAQ на пары Q:/A:
    if thr.get("strict", False) and has_faq(md_text):
        block = _extract_faq_block(md_text)
        if block and not re.search(r"(?mi)^\s*Q:\s+.+\n\s*A:\s+.+", block):
            errors.append("FAQ structure invalid (missing Q:/A: pairs)")

    return {"ok": len(errors) == 0, "errors": errors}

# --- Обратная совместимость: помечать как draft, если QA не пройден (опционально) ---
def qa_decide_draft(md_text: str) -> bool:
    """
    Если где-то в пайплайне использовалась логика 'draft если fail' —
    оставляем совместимый хук. Читает draft_if_fail из общего конфига.
    """
    cfg = load_writer_config()
    draft_if_fail = bool(cfg.get("draft_if_fail", True))
    result = qa_check(md_text)
    return (not result["ok"]) and draft_if_fail
