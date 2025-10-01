
import re

FRONT_MATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.S)

def _body(text: str) -> str:
    return FRONT_MATTER_RE.sub("", text, count=1)

def word_count(text: str) -> int:
    return len(re.findall(r"\w+", _body(text), flags=re.U))

def subheadings_count(text: str) -> int:
    return len(re.findall(r"^##\s+|^###\s+", _body(text), flags=re.M))

def has_faq(text: str) -> bool:
    return bool(re.search(r"^##\s*faq|^##\s*questions", _body(text), flags=re.I|re.M))

def has_internal_link(text: str) -> bool:
    return "/blog/posts/" in text

def qa_decide_draft(md_text: str, cfg: dict) -> bool:
    thr = cfg.get("qa_thresholds", {})
    ok = True
    w = word_count(md_text)
    if w < thr.get("min_words", 1700) or w > thr.get("max_words", 2100):
        ok = False
        print(f"QA FAIL: words={w}")
    if subheadings_count(md_text) < thr.get("min_subheadings", 6):
        ok = False
        print("QA FAIL: subheadings")
    if thr.get("require_faq", True) and not has_faq(md_text):
        ok = False
        print("QA FAIL: FAQ missing")
    if thr.get("require_internal_links", True) and not has_internal_link(md_text):
        ok = False
        print("QA FAIL: no internal links")
    return (not ok) and cfg.get("draft_if_fail", True)
