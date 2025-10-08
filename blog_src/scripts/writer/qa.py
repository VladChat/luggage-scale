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

def has_faq_header(text: str) -> bool:
    """Returns True if there's an H2 'FAQ' (or 'Questions') section header."""
    body = _strip_front_matter(text)
    return bool(re.search(r"^##\s*(faq|questions)\b", body, flags=re.I | re.M))

# Accept both '### Q:' / 'A:' pairs (preferred) and plain 'Q:'/'A:' pairs.
FAQ_QA_PAIR_RE = re.compile(
    r"(?mi)^\s*(?:###\s*)?Q:\s+.+\n\s*A:\s+.+",
    re.MULTILINE | re.IGNORECASE
)

def faq_pair_count(text: str) -> int:
    body = _strip_front_matter(text)
    return len(FAQ_QA_PAIR_RE.findall(body))

def has_internal_link(text: str) -> bool:
    # Простая эвристика для внутренних ссылок Hugo
    return "/blog/posts/" in text

def _extract_faq_block(text: str) -> str | None:
    """Extracts the FAQ block if it is delimited by an '## FAQ' header.
    If there's no explicit header, returns a synthetic block that
    concatenates all Q:/A: pairs found at the end of the document.
    """
    body = _strip_front_matter(text)

    # 1) Header-based extraction (original behavior)
    m = re.search(r"(?s)^##\s*(?:faq|questions).*?(?=^##\s|\Z)", body, flags=re.I | re.M)
    if m:
        return m.group(0)

    # 2) Fallback: collect trailing Q:/A: pairs near the end
    pairs = list(FAQ_QA_PAIR_RE.finditer(body))
    if not pairs:
        return None

    # Take from the first pair that appears in the last 30% of the document
    start_idx = int(len(body) * 0.7)
    start_pos = None
    for m in pairs:
        if m.start() >= start_idx:
            start_pos = m.start()
            break
    if start_pos is None:
        # If all pairs are earlier, still return from the first pair
        start_pos = pairs[0].start()

    # End at next H2 or end of doc
    tail = body[start_pos:]
    m2 = re.search(r"(?m)^##\s+", tail)
    if m2:
        tail = tail[:m2.start()]
    return tail

# --- Единственная точка QA ---
def qa_check(md_text: str) -> dict:
    """
    Базовый QA-контроль по конфигу:
      - длина
      - количество подзаголовков
      - наличие FAQ (опционально; теперь допускается FAQ без заголовка '## FAQ', если есть Q:/A: пары)
      - наличие внутренних ссылок (опционально)
      - строгий режим валидирует структуру Q:/A: внутри FAQ
    """
    cfg = load_writer_config()
    thr = dict(cfg.get("qa_thresholds", {}))
    errors: list[str] = []

    wc = word_count(md_text)
    if thr.get("min_words") and wc < thr["min_words"]:
        errors.append(f"words={wc} (<{thr['min_words']})")
    if thr.get("max_words") and wc > thr["max_words"]:
        errors.append(f"words={wc} (>{thr['max_words']})")

    subs = subheadings_count(md_text)
    if thr.get("min_subheadings") and subs < thr["min_subheadings"]:
        errors.append(f"subheadings={subs} (<{thr.get('min_subheadings')})")

    # --- FAQ presence ---
    require_faq = bool(thr.get("require_faq", False))
    faq_min = int(cfg.get("faq_count_min", 3))
    header_present = has_faq_header(md_text)
    pair_cnt = faq_pair_count(md_text)

    if require_faq and not (header_present or pair_cnt >= faq_min):
        errors.append("FAQ missing")

    # --- Internal links ---
    if thr.get("require_internal_links", False) and not has_internal_link(md_text):
        errors.append("internal links missing")

    # --- Strict FAQ structure ---
    if thr.get("strict", False):
        if header_present:
            block = _extract_faq_block(md_text)
            # If a header exists but we cannot extract, mark invalid
            if not block:
                errors.append("FAQ structure invalid (cannot extract block)")
            else:
                if not FAQ_QA_PAIR_RE.search(block):
                    errors.append("FAQ structure invalid (missing Q:/A: pairs)")
        else:
            # No header: validate on the whole doc using pair count
            if pair_cnt < faq_min:
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
