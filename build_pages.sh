#!/usr/bin/env bash
set -euo pipefail

# Build React cabinet module and publish a combined static folder for Cloudflare Pages.
# Output: ./dist_site

ROOT_DIR="$(pwd)"
OUT="${ROOT_DIR}/dist_site"

rm -rf "$OUT"
mkdir -p "$OUT"

# 1) Copy current static cabinet files (everything in repo root) EXCEPT the React source and the output folder itself.
# Using tar keeps permissions and is available in CF Pages build image.

tar -cf - \
  --exclude='./dist_site' \
  --exclude='./sg-cabinet-react' \
  --exclude='./node_modules' \
  . | (cd "$OUT" && tar -xf -)

# 2) Build React app
npm install --prefix "$ROOT_DIR/sg-cabinet-react"
npm run build --prefix "$ROOT_DIR/sg-cabinet-react"


# 3) Copy React build into /panel-react/ (subfolder)
mkdir -p "$OUT/panel-react"
cp -R "$ROOT_DIR/sg-cabinet-react/dist/"* "$OUT/panel-react/"

mkdir -p "$OUT/panel-react/miniapp"
cp -R "$ROOT_DIR/miniapp/"* "$OUT/panel-react/miniapp/"


# Done.
echo "Built combined site into: $OUT"
