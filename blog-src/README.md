# Blog authoring guide

The Eleventy layouts compute SEO metadata from the page front matter. Provide the following keys whenever you create a new post or listing page so the shared `<head>` include can populate the Open Graph and Twitter tags correctly.

## Core front matter keys

| Key | Expected value | Used for |
| --- | --------------- | -------- |
| `title` | Plain text page title. Posts usually omit the brand name (it is appended automatically). | `<title>`, Open Graph title, on-page headings. |
| `description` | One or two sentences (155–160 chars is ideal). | `<meta name="description">`, Open Graph/Twitter descriptions, teaser copy on listings. |
| `socialImage` | Absolute URL or a `/blog/...` path to a 1200×630 image. | Open Graph/Twitter preview image. Falls back to `config.seo.defaultOgImage`. |
| `author` | Display name for the article or page owner. | Visible post byline, `<meta name="author">`, `article:author`. Defaults to `uPatch Travel Team`. |
| `published` | ISO date string (`YYYY-MM-DD`). For posts, match the Eleventy `date`. | `article:published_time` and canonical date displays. Optional for listings (layout will fall back to the build date). |

## Optional helpers

- `metaTitle` / `metaDescription` – override the computed title or description for the `<head>` tags when you need custom copy.
- `ogType` – defaults to `article` on posts and `website` on listings. Override for landing pages that need a different Open Graph type.
- `twitterCard` – defaults to `summary_large_image`; set to `summary` if you deliberately ship a smaller card.
- `metaRobots` – supply custom robots directives (e.g., `noindex`) instead of using the automatic `published: false` guard.
- `socialImageAlt` – short alt text for the social sharing image, applied to the `og:image:alt` and `twitter:image:alt` tags.
- `authorTwitter` / `twitterCreator` – handle shown in the `twitter:creator` tag when the post has an author-specific account.

All paths and URLs pass through the `absoluteUrl` filter, so relative paths under `/blog` automatically expand to fully-qualified URLs using the values in `_data/config.json`.

## Batch post generation

Use the Node script in `scripts/generate-posts.js` to create dated post folders in `blog-src/posts/` from a JSON or CSV topic list. The batch generator enforces the 10-post-per-day ceiling described below, so a single run produces up to ten Markdown files for the requested date.

### 1. Prepare a topics file

**JSON** files accept either an array or an object with a `topics` array:

```jsonc
[
  {
    "title": "Packing checklist for spring getaways",
    "description": "A light-weight packing list tailored for mild weather trips.",
    "excerpt": "Use this 10-item checklist to keep your luggage under the airline limit.",
    "author": "Jamie Rivers",
    "tags": ["checklist", "packing"],
    "body": "Intro paragraph...\n\n## Section heading\nMore guidance here.",
    "date": "2024-05-13"
  }
]
```

**CSV** files should provide a header row with matching columns. List multiple tags with commas (e.g., `tags="gear,packing"`).

### 2. Run the generator (max 10 posts per day)

```bash
npm run generate:posts -- ./path/to/topics.json
```

- Omit the optional `--date` flag to use today’s date in the generated folder names and front matter, or provide an explicit ISO date: `npm run generate:posts -- ./topics.csv --date=2024-05-20`.
- The script honours a 10-post ceiling per run (`--limit` defaults to 10 and cannot exceed it). Extra topics in the file are skipped with a warning so you can schedule them for another day.
- Pass `--dry-run` to preview the folders that would be created without writing files.

### 3. Enable API fill mode (optional)

- Set the `OPENAI_API_KEY` environment variable before running with `--mode=api`. The GitHub Actions workflow reads this secret from `OPENAI_API_KEY`, so mirror that locally (for example, `export OPENAI_API_KEY=sk-...`).
- When API mode is active, the script sends the assembled prompt for each section to OpenAI. If the API key is missing or OpenAI returns no content, the run exits with an error so the workflow fails fast.

Every generated post receives an `index.md` with populated front matter (`title`, `description`, `excerpt`, `author`, `tags`, and `date`), and the batch metadata is appended to `blog-src/posts/posts.json` so the shared data file tracks when automated batches were produced.
