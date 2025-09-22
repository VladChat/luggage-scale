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
