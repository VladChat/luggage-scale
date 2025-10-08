# blog_src/scripts/writer/config_loader.py
import json

CONFIG_PATH = "blog_src/config/writer_config.json"

_DEFAULTS = {
    "language": "en",
    "generation": {
        "post_length_min": 1800,
        "post_length_max": 2200,
        "subheading_interval": 250,
        "h2_max_chars": 60,
        "h3_max_chars": 60,
        "title_max_chars": 60,
        "description_max_chars": 160
    },
    "internal_links_min": 1,
    "internal_links_max": 3,
    "min_link_pool_posts": 5,
    "faq_count_min": 3,
    "faq_count_max": 6,
    "max_posts_per_day": 0,
    "draft_if_fail": True,
    "categories_mode": "auto",
    "categories_allowed": [],
    "categories_per_post": 1,
    "default_category": "news",
    "qa_thresholds": {
        "min_words": 1000,
        "max_words": 3500,
        "min_subheadings": 4,
        "require_faq": False,
        "require_internal_links": False,
        "strict": False
    }
}

def load_writer_config() -> dict:
    """
    Единая точка загрузки настроек генератора/QA.
    Возвращает словарь с дефолтами, поверх которых мёрджится JSON-конфиг (если есть).
    """
    cfg = {}
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f) or {}
    except FileNotFoundError:
        # Ок: работаем на дефолтах.
        cfg = {}
    except Exception as e:
        print(f"⚠️ Failed to read {CONFIG_PATH}: {e}")
        cfg = {}

    # Глубокий мердж дефолтов и пользовательских настроек (простая рекурсивная стратегия)
    def _merge(base: dict, override: dict) -> dict:
        out = dict(base)
        for k, v in (override or {}).items():
            if isinstance(v, dict) and isinstance(out.get(k), dict):
                out[k] = _merge(out[k], v)
            else:
                out[k] = v
        return out

    return _merge(_DEFAULTS, cfg)
