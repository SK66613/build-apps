#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
OUT="${ROOT_DIR}/dist_site"
REACT_DIR="${ROOT_DIR}/sg-cabinet-react"

rm -rf "$OUT"
mkdir -p "$OUT"

# 1) Copy legacy static files from repo root
tar -cf - \
  --exclude='./dist_site' \
  --exclude='./sg-cabinet-react' \
  --exclude='./functions' \
  --exclude='./node_modules' \
  . | (cd "$OUT" && tar -xf -)

# 2) Install + build React app
# IMPORTANT: we do NOT use npm ci here because you cannot generate/commit package-lock locally.
# We also force-install zustand to avoid "failed to resolve import zustand" in CI.
npm install --prefix "$REACT_DIR" --no-fund --no-audit

# Force ensure zustand is installed even if something weird with deps caching happens
npm install --prefix "$REACT_DIR" zustand@^4.5.2 --no-fund --no-audit

npm run build --prefix "$REACT_DIR"

# 3) Publish React build into /panel-react/
mkdir -p "$OUT/panel-react"
cp -R "$REACT_DIR/dist/"* "$OUT/panel-react/"

echo "Built combined site into: $OUT"


