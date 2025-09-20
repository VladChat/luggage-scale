# scripts/quick-push.ps1
param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

# Default commit message if none given
if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

# Go to repo root (one level up from /scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

Write-Host "Commit message: $Message" -ForegroundColor Cyan

# 0) Quick sanity info
try { $branch = (git rev-parse --abbrev-ref HEAD).Trim() } catch { $branch = "main" }
Write-Host "On branch: $branch"

# 1) Stage typical project files (including workflows and .nojekyll)
#    -A ensures deletions are tracked too
git add -A blog-src .eleventy.js package.json package-lock.json .github .nojekyll scripts

# 2) Commit if there are staged changes
if (git diff --cached --quiet) {
  Write-Host "No staged changes to commit." -ForegroundColor Yellow
} else {
  git commit -m "$Message"
  Write-Host "Committed changes." -ForegroundColor Green
}

# 3) Pull latest with rebase + AUTOSTASH (handles untracked like blog/.nojekyll)
#    If this fails, try a safer fallback: abort rebase, stash everything, rebase again.
Write-Host "Syncing with remote (rebase + autostash)..." -ForegroundColor Cyan
& git pull --rebase --autostash origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rebase failed, attempting safe fallback..." -ForegroundColor Yellow
  git rebase --abort 2>$null
  git stash push -u -m "auto-stash-by-quick-push"
  git pull --rebase origin main
}

# 4) Push
git push

Write-Host "✅ Blog sync complete. GitHub Action will build and publish /blog/." -ForegroundColor Green
