import json
import hashlib
import feedparser
from pathlib import Path
import time

DATA_DIR = Path("blog_src/data")
FEEDS_FILE = DATA_DIR / "feeds.json"
STATE_FILE = DATA_DIR / "state.json"
MAX_SEEN = 500  # Храним максимум 500 новостей

def load_feeds():
    with open(FEEDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"keyword_index": 0, "seen": []}

def save_state(state):
    # ограничиваем seen последними MAX_SEEN элементами
    if len(state.get("seen", [])) > MAX_SEEN:
        state["seen"] = state["seen"][-MAX_SEEN:]
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def hash_entry(entry):
    """Уникальный ID новости на основе ссылки или заголовка"""
    base = entry.get("id") or entry.get("link") or entry.get("title", "")
    return hashlib.sha1(base.encode("utf-8")).hexdigest()

def get_latest_topic():
    feeds = load_feeds()
    state = load_state()
    seen = set(state.get("seen", []))

    all_entries = []
    for feed_url in feeds:
        parsed = feedparser.parse(feed_url)
        for entry in parsed.entries:
            uid = hash_entry(entry)
            if uid in seen:
                continue
            # Определяем дату публикации
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = time.mktime(entry.published_parsed)
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                published = time.mktime(entry.updated_parsed)
            else:
                published = time.time()  # fallback: считаем свежей

            all_entries.append((published, entry, uid, feed_url))

    if not all_entries:
        raise RuntimeError("No new entries found in any feed")

    # Сортируем по дате, берём самую свежую
    all_entries.sort(key=lambda x: x[0], reverse=True)
    _, entry, uid, feed_url = all_entries[0]

    state.setdefault("seen", []).append(uid)
    save_state(state)

    print(f"ℹ️ From RSS feed: {feed_url}")
    topic = entry.get("title", "").strip()
    summary = entry.get("summary", "").strip() or entry.get("description", "")
    return topic, summary

if __name__ == "__main__":
    t, s = get_latest_topic()
    print("Topic:", t)
    print("Summary:", s[:200])
