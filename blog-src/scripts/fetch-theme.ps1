Param()
$ErrorActionPreference = "Stop"
$themes = Join-Path $PSScriptRoot "..\themes"
$paperMod = Join-Path $themes "PaperMod"
New-Item -ItemType Directory -Force -Path $themes | Out-Null
if (-Not (Test-Path $paperMod)) {
  git clone --depth=1 https://github.com/adityatelange/hugo-PaperMod.git $paperMod
  Write-Host "PaperMod cloned to blog-src/themes/PaperMod"
} else {
  Write-Host "PaperMod already present."
}
