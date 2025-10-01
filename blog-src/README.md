# luggage-scale.com/blog — Hugo (PaperMod)

This is the source for the **/blog** section of https://luggage-scale.com.  
⚠️ The static mini-site in the repository root (index.html, shop.html, manual.html, flight-baggage-limits.html, warranty.html, CNAME) ALREADY EXISTS and must never be modified by this project.

## Structure

/blog-src/                  ← Hugo source
├─ content/
│  ├─ posts/                ← published posts
│  └─ drafts/               ← drafts
├─ data/
│  ├─ keywords.json         ← SEO keywords
│  └─ rss.json              ← RSS feeds
├─ scripts/                 ← reserved for automation agent
├─ themes/
│  └─ PaperMod/             ← Hugo theme
├─ config.yml               ← Hugo configuration
/blog/                      ← GENERATED output (do not edit)

## Build & Deploy (GitHub Actions)

- Workflow `.github/workflows/build-blog.yml` builds the blog from `/blog-src/` and writes the generated site to `/blog/`.
- It commits **only** changes inside `/blog/`.
- It **never** touches root files.

## Content

- Create posts in `/blog-src/content/posts/` as Markdown files.
- Set `draft: false` in front matter to publish.

## Future Automation

- `/blog-src/scripts/` is reserved for a writer agent.
- It will use `/blog-src/data/rss.json` (RSS feeds) and `/blog-src/data/keywords.json` (SEO keywords).
- Generated posts will be saved into `/blog-src/content/posts/` before Hugo build.
