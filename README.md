# Blog for luggage-scale.com

This is an Eleventy (11ty) static blog that builds into the `/blog/` subdirectory, leaving your existing `index.html`, `shop.html`, `manual.html` etc untouched.

## How to use

1. Install Node.js 20+
2. Run locally:
   ```
   npm ci
   npm run dev
   ```
3. Deploy: Commit & push. GitHub Actions workflow `deploy-blog.yml` will build into `/blog/`.
4. Visit: https://luggage-scale.com/blog/

## Content

- Posts: `blogsrc/blog/*.md`
- Layouts: `blogsrc/_includes/layouts`

## Notes

- Existing site root pages remain intact.
- Blog appears at `/blog/` path only.
