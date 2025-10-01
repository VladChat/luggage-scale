#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$(dirname "$0")/../themes"
if [ ! -d "$(dirname "$0")/../themes/PaperMod" ]; then
  git clone --depth=1 https://github.com/adityatelange/hugo-PaperMod.git "$(dirname "$0")/../themes/PaperMod"
  echo "PaperMod cloned to blog-src/themes/PaperMod"
else
  echo "PaperMod already present."
fi
