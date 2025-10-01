import json
import feedparser
import time
from pathlib import Path

STATE_FILE = Path("blog_src/data/state.json")
RSS_FILE = Path("blog_src/data/rss.json")
KEYWORDS_FILE = Path("blog_src/data/keywords.json")

def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f"⚠️ Could not load {path}: {e}")
        return []

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)

def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"keyword_index": 0}
    except Exception as e:
        print(f"⚠️ Could not load state.json: {e}")
        return {"keyword_index": 0}

def get_latest_topic():
    feeds = load_json(RSS_FILE)
    keywords = load_json(KEYWORDS_FILE)
    state = load_state()

    if not feeds or not keywords:
        raise RuntimeError("RSS feeds or keywords are missing")

    latest_entry = None
    latest_time = 0

    # Проверяем все ленты и ищем самую свежую запись
    for url in feeds:
        try:
            feed = feedparser.parse(url)
            if not feed.entries:
                continue
            entry = feed.entries[0]  # первая запись (самая свежая)
            # Определяем время публикации
            published = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
            if published:
                ts = time.mktime(published)
            else:
                ts = time.time()
            if ts > latest_time:
                latest_time = ts
                latest_entry = entry
        except Exception as e:
            print(f"⚠️ Could not parse feed {url}: {e}")

    if not latest_entry:
        raise RuntimeError("No entries found in any RSS feed")

    # Берем keyword по порядку
    kw_index = state.get("keyword_index", 0)
    keyword = keywords[kw_index % len(keywords)]
    state["keyword_index"] = (kw_index + 1) % len(keywords)
    save_state(state)

    title = latest_entry.title.strip()
    summary = getattr(latest_entry, "summary", "").strip()
    # Ограничиваем summary до 200 слов
    summary_words = summary.split()
    if len(summary_words) > 200:
        summary = " ".join(summary_words[:200])

    topic = f"{title} — {keyword}"
    return topic, summary
