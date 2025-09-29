# Quick Fix Steps

1) Replace your broken workflow with `.github/workflows/build-blog.yml` from this folder.
2) Add the root `.eleventy.js` (enables static passthrough and defines the `posts` collection).
3) Overwrite `blog-src/index.njk` with the fixed version (correct layout path).
4) Replace `blog-src/posts/posts.json` with the directory data object (sets layout + adds `posts` tag).
5) Commit and push to `main`. The GitHub Pages workflow will build `blog` and deploy. Your blog will be at:
   https://luggage-scale.com/blog/

Commands (PowerShell):
```
git add .github/workflows/build-blog.yml .eleventy.js blog-src/index.njk blog-src/posts/posts.json 404.html
git commit -m "Fix Pages deploy, Eleventy config, posts collection, and 404"
git push origin main
```
