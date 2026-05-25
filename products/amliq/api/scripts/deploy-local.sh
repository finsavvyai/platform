#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "======================================="
echo "  Local Deploy"
echo "======================================="
if [ "$1" != "--skip-tests" ]; then
  echo "[ci] Running pipeline..."
  if ! ./scripts/ci.sh; then
    echo "Deploy aborted: CI failed"; exit 1
  fi
fi
echo "[build] Go binaries (.)..."
mkdir -p bin
for cmd in ./cmd/*/main.go; do
  [ -f "$cmd" ] || continue
  name=$(basename $(dirname "$cmd"))
  (cd "." && go build -o "$OLDPWD/bin/$name" "./cmd/$name")
  echo "  bin/$name"
done
echo "[build] Frontend (./web)..."
if [ -d "./web/node_modules" ]; then
  (cd "./web" && npx vite build 2>&1 | tail -3) 2>/dev/null \
    || (cd "./web" && npm run build 2>&1 | tail -3) || true
else
  (cd "./web" && npm install && npm run build 2>&1 | tail -3) || true
fi
echo "[deploy] Docker..."
COMPOSE=$(find . -name "docker-compose.yml" | head -1)
if [ -n "$COMPOSE" ]; then
  docker-compose -f "$COMPOSE" down 2>/dev/null || true
  docker-compose -f "$COMPOSE" up -d
  echo "  Services started"
else echo "  No docker-compose.yml found"; fi
echo ""
echo "======================================="
echo "  Deploy complete"
echo "======================================="
