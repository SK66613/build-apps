#!/usr/bin/env bash
set -euo pipefail

# Build React cabinet module and publish a combined static folder for Cloudflare Pages.
# Output: ./dist_site

ROOT_DIR="$(pwd)"
OUT="${ROOT_DIR}/dist_site"

rm -rf "$OUT"
mkdir -p "$OUT"

# 1) Copy current static cabinet files (everything in repo root)
# EXCEPT: React source, build output, node_modules, and miniapp (we copy it into /panel-react/miniapp explicitly)

tar -cf - \
  --exclude='./dist_site' \
  --exclude='./sg-cabinet-react' \
  --exclude='./miniapp' \
  --exclude='./functions' \
  --exclude='./node_modules' \
  . | (cd "$OUT" && tar -xf -)


# 2) Build React app
# Prefer npm ci for deterministic builds (requires sg-cabinet-react/package-lock.json)
if [ -f "$ROOT_DIR/sg-cabinet-react/package-lock.json" ]; then
  npm ci --prefix "$ROOT_DIR/sg-cabinet-react"
else
  npm install --prefix "$ROOT_DIR/sg-cabinet-react"
fi

npm run build --prefix "$ROOT_DIR/sg-cabinet-react"

# 3) Copy React build into /panel-react/
mkdir -p "$OUT/panel-react"
cp -R "$ROOT_DIR/sg-cabinet-react/dist/"* "$OUT/panel-react/"

# 4) Copy constructor (miniapp) into /panel-react/miniapp/
if [ -d "$ROOT_DIR/sg-cabinet-react/miniapp" ]; then
  mkdir -p "$OUT/panel-react/miniapp"
  cp -R "$ROOT_DIR/sg-cabinet-react/miniapp/"* "$OUT/panel-react/miniapp/"
else
  echo "WARN: ./sg-cabinet-react/miniapp not found, skipping copy"
fi


echo "Built combined site into: $OUT"
