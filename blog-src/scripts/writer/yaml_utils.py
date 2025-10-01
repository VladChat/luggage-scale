
import re

def yaml_safe(s: str) -> str:
    if s is None:
        s = ""
    s = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", s)
    return s.replace('"', '\"')

def clamp(s: str, n: int) -> str:
    s = re.sub(r"\s+", " ", (s or "")).strip()
    if len(s) <= n:
        return s
    cut = s[:n]
    return cut[: cut.rfind(" ")].rstrip(" .,:;—-")

def build_front_matter(*, title, description, date_iso, lastmod_iso, keyword, canonical, cover_image, cover_alt, news_link, draft=False) -> str:
    ytitle = yaml_safe(title)
    ydesc = yaml_safe(description)
    ykw = yaml_safe(keyword)
    ycanon = yaml_safe(canonical)
    yalt = yaml_safe(cover_alt)
    ysrc = yaml_safe(news_link)
    return (
f'''---
title: "{ytitle}"
date: {date_iso}
lastmod: {lastmod_iso}
draft: {"true" if draft else "false"}
description: "{ydesc}"
tags: ["{ykw}"]
categories: ["News"]
cover:
  image: "{cover_image}"
  alt: "{yalt}"
canonicalURL: "{ycanon}"
sources:
  - "{ysrc}"
---
''')
