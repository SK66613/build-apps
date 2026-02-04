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
npm install --prefix "$REACT_DIR" --no-fund --no-audit
npm install --prefix "$REACT_DIR" zustand@^4.5.2 --no-fund --no-audit
npm install --prefix "$REACT_DIR" @tanstack/react-query@^5.17.19 --no-fund --no-audit
npm install --prefix "$REACT_DIR" date-fns@^3.6.0 --no-fund --no-audit
npm install --prefix "$REACT_DIR" -D sass --no-fund --no-audit
npm run build --prefix "$REACT_DIR"



# 3) Publish React build into /panel-react/
mkdir -p "$OUT/panel-react"
cp -R "$REACT_DIR/dist/"* "$OUT/panel-react/"

echo "Built combined site into: $OUT"


