# scripts/quick-push.ps1
param(
  [string]$Message = "sync: $(Get-Date -Format o)"
)

$ErrorActionPreference = "Stop"

# Show commit message
Write-Host "Commit message: $Message" -ForegroundColor Cyan

# Go to repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

# Show current branch
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "On branch: $branch" -ForegroundColor Cyan

# Update from GitHub
git fetch --all
git pull --rebase

# Add ONLY blog-related files
git add blog-src/ .eleventy.js package.json package-lock.json scripts/

# Commit only if changes exist
if (git diff --cached --quiet) {
  Write-Host "No blog changes to commit." -ForegroundColor Yellow
} else {
  git commit -m "$Message"
  Write-Host "Committed changes with message: $Message" -ForegroundColor Green
}

# Push
git push

Write-Host "✅ Blog sync complete. GitHub Action will build and publish /blog/." -ForegroundColor Green
