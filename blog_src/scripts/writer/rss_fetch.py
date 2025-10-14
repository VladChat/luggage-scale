import json
import pathlib
import feedparser

STATE_PATH = pathlib.Path("blog_src/data/state.json")
RSS_PATH = pathlib.Path("blog_src/data/rss.json")
KEYWORDS_PATH = pathlib.Path("blog_src/data/keywords.json")

def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")

def get_latest_topic():
    rss_list = load_json(RSS_PATH, [])
    keywords = load_json(KEYWORDS_PATH, [])
    state = load_json(STATE_PATH, {"last_keyword": -1, "last_rss": -1})

    if not rss_list:
        raise RuntimeError("⚠️ rss.json is empty")
    if not keywords:
        raise RuntimeError("⚠️ keywords.json is empty")

    # RSS feed rotation
    rss_index = (state.get("last_rss", -1) + 1) % len(rss_list)
    rss_url = rss_list[rss_index]
    feed = feedparser.parse(rss_url)
    if not feed.entries:
        raise RuntimeError(f"⚠️ No entries found in RSS: {rss_url}")

    latest_entry = feed.entries[0]
    topic = latest_entry.get("title", "Untitled")
    summary = latest_entry.get("summary", "")
    link = latest_entry.get("link", "")  # ✅ добавлено

    # Keyword rotation
    keyword_index = (state.get("last_keyword", -1) + 1) % len(keywords)
    keyword = keywords[keyword_index]

    # Save new state
    state["last_rss"] = rss_index
    state["last_keyword"] = keyword_index
    save_json(STATE_PATH, state)

    print(f"ℹ️ Using keyword: {keyword} (index {keyword_index})")
    print(f"ℹ️ From RSS feed: {rss_url}")

    # ✅ Возвращаем ссылку третьим аргументом
    return f"{topic} — {keyword}", summary, link
