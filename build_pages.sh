#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
OUT="${ROOT_DIR}/dist_site"

rm -rf "$OUT"
mkdir -p "$OUT"

# 1) Copy legacy static files from repo root
tar -cf - \
  --exclude='./dist_site' \
  --exclude='./sg-cabinet-react' \
  --exclude='./functions' \
  --exclude='./node_modules' \
  . | (cd "$OUT" && tar -xf -)

# 2) Build React app (Vite)
if [ -f "$ROOT_DIR/sg-cabinet-react/package-lock.json" ]; then
  npm ci --prefix "$ROOT_DIR/sg-cabinet-react"
else
  npm install --prefix "$ROOT_DIR/sg-cabinet-react"
fi

npm run build --prefix "$ROOT_DIR/sg-cabinet-react"

# 3) Publish React build into /panel-react/
mkdir -p "$OUT/panel-react"
cp -R "$ROOT_DIR/sg-cabinet-react/dist/"* "$OUT/panel-react/"

echo "Built combined site into: $OUT"
