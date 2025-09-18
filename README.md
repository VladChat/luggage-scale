# Blog-only scaffold for luggage-scale.com

Upload the following to the **repo root**:
- `blog-src/`
- `.github/workflows/build-blog.yml`
- `blog/.gitkeep` (keeps the folder)

Keep your existing `index.html`, `shop.html`, `manual.html`, etc.
Make sure `.nojekyll` stays in the repo root (you already created it).

## After upload
1) Settings → Actions → Workflow permissions = **Read and write** (so auto-commit can write to `/blog/`).
2) Edit any file inside `blog-src/` and commit → workflow runs → HTML appears in `/blog/`.
3) Open https://luggage-scale.com/blog/
