#!/bin/bash
# ============================================================
# cicd-init — Zero-cost local CI/CD for any project
# ============================================================
# Auto-detects stack, generates git hooks + CI + deploy scripts
#
# Supports: Go, Node/TS, Python, Rust, Java, Docker
# Supports: monorepos, multi-service, custom line limits
#
# Usage:
#   ./cicd-init.sh              # run from any git repo
#   curl -sL URL | bash         # one-liner install
#
# Generated files:
#   scripts/pre-commit          git hook: lint + format + build
#   scripts/pre-push            git hook: full test suite
#   scripts/ci.sh               full CI pipeline
#   scripts/deploy-local.sh     CI + build + deploy
#   scripts/install-hooks.sh    hook installer
# ============================================================
set -e

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"
mkdir -p scripts

echo "======================================="
echo "  cicd-init — local CI/CD generator"
echo "======================================="
echo ""

# --- Detect all project roots (monorepo support) ---
SERVICES=()
GO_ROOTS=()
NODE_ROOTS=()
PY_ROOTS=()
RUST_ROOTS=()
JAVA_ROOTS=()
DOCKER=false
LINE_LIMIT=0
EXCLUDE=".git vendor node_modules target dist build .claude"

# Load .cicdignore if present (extra dirs to exclude)
if [ -f .cicdignore ]; then
  while IFS= read -r line; do
    [ -z "$line" ] || [[ "$line" == \#* ]] && continue
    EXCLUDE="$EXCLUDE $line"
  done < .cicdignore
fi

find_projects() {
  # Go projects (anywhere with go.mod)
  while IFS= read -r f; do
    dir=$(dirname "$f")
    GO_ROOTS+=("$dir")
    SERVICES+=("go:$dir")
  done < <(find . -name go.mod -not -path "*/vendor/*" \
    -not -path "*/node_modules/*" 2>/dev/null)

  # Node projects
  while IFS= read -r f; do
    dir=$(dirname "$f")
    NODE_ROOTS+=("$dir")
    SERVICES+=("node:$dir")
  done < <(find . -name package.json -not -path "*/node_modules/*" \
    -maxdepth 3 2>/dev/null)

  # Python projects
  for marker in requirements.txt pyproject.toml setup.py; do
    while IFS= read -r f; do
      dir=$(dirname "$f")
      PY_ROOTS+=("$dir")
      SERVICES+=("python:$dir")
    done < <(find . -name "$marker" -maxdepth 3 \
      -not -path "*/node_modules/*" 2>/dev/null)
  done

  # Rust projects
  while IFS= read -r f; do
    dir=$(dirname "$f")
    RUST_ROOTS+=("$dir")
    SERVICES+=("rust:$dir")
  done < <(find . -name Cargo.toml -maxdepth 3 2>/dev/null)

  # Java projects
  for marker in pom.xml build.gradle; do
    while IFS= read -r f; do
      dir=$(dirname "$f")
      JAVA_ROOTS+=("$dir")
      SERVICES+=("java:$dir")
    done < <(find . -name "$marker" -maxdepth 3 \
      -not -path "*/node_modules/*" 2>/dev/null)
  done

  # Docker
  find . -name "docker-compose.yml" -o -name "Dockerfile" \
    2>/dev/null | grep -q . && DOCKER=true

  # Line limit from project config
  for f in CLAUDE.md .cursorrules .editorconfig; do
    if [ -f "$f" ]; then
      lim=$(grep -oP '\d+.line' "$f" 2>/dev/null | grep -oP '\d+' | head -1)
      [ -n "$lim" ] && LINE_LIMIT=$lim
    fi
  done
}

find_projects

echo "Detected:"
for s in "${SERVICES[@]}"; do echo "  $s"; done
$DOCKER && echo "  docker"
[ "$LINE_LIMIT" -gt 0 ] && echo "  line-limit: $LINE_LIMIT"
echo ""

# Build exclusion pattern for find
EXCL_ARGS=""
for p in $EXCLUDE; do
  EXCL_ARGS="$EXCL_ARGS -not -path './$p/*' -not -path '*/$p/*'"
done

# -------------------------------------------------------
# Generate: scripts/pre-commit
# -------------------------------------------------------
echo "Generating scripts/pre-commit..."
cat > scripts/pre-commit << 'HEAD'
#!/bin/bash
set -e
echo "pre-commit: checking..."
HEAD

for dir in "${GO_ROOTS[@]}"; do
cat >> scripts/pre-commit << BLOCK
BAD=\$(cd "$dir" && gofmt -l . 2>/dev/null | grep -v vendor | head -5)
if [ -n "\$BAD" ]; then
  echo "FAIL [$dir]: unformatted Go files:"; echo "\$BAD"
  echo "Run: (cd $dir && go fmt ./...)"; exit 1
fi
if ! (cd "$dir" && go build ./... 2>/dev/null); then
  echo "FAIL [$dir]: go build"; exit 1
fi
BLOCK
done

for dir in "${RUST_ROOTS[@]}"; do
cat >> scripts/pre-commit << BLOCK
if command -v cargo >/dev/null; then
  if ! (cd "$dir" && cargo fmt --check 2>/dev/null); then
    echo "FAIL [$dir]: cargo fmt"; exit 1
  fi
fi
BLOCK
done

for dir in "${PY_ROOTS[@]}"; do
cat >> scripts/pre-commit << BLOCK
if command -v ruff >/dev/null; then
  (cd "$dir" && ruff check . 2>/dev/null) || true
fi
BLOCK
done

if [ "$LINE_LIMIT" -gt 0 ]; then
cat >> scripts/pre-commit << BLOCK
OVER=\$(find . $EXCL_ARGS \\
  \( -name "*.go" -o -name "*.ts" -o -name "*.tsx" \\
     -o -name "*.py" -o -name "*.rs" -o -name "*.java" \) \\
  -exec sh -c 'l=\$(wc -l < "\$1"); [ "\$l" -gt $LINE_LIMIT ] && echo "\$l \$1"' _ {} \;)
if [ -n "\$OVER" ]; then
  echo "FAIL: files over $LINE_LIMIT lines:"; echo "\$OVER"; exit 1
fi
BLOCK
fi

echo 'echo "pre-commit: OK"' >> scripts/pre-commit
chmod +x scripts/pre-commit

# -------------------------------------------------------
# Generate: scripts/pre-push
# -------------------------------------------------------
echo "Generating scripts/pre-push..."
cat > scripts/pre-push << 'HEAD'
#!/bin/bash
set -e
echo "pre-push: running tests..."
HEAD

for dir in "${GO_ROOTS[@]}"; do
cat >> scripts/pre-push << BLOCK
echo "  [$dir] go test..."
(cd "$dir" && go test ./... 2>&1 | tail -20)
BLOCK
done

for dir in "${RUST_ROOTS[@]}"; do
cat >> scripts/pre-push << BLOCK
echo "  [$dir] cargo test..."
(cd "$dir" && cargo test 2>&1 | tail -10)
BLOCK
done

for dir in "${PY_ROOTS[@]}"; do
cat >> scripts/pre-push << BLOCK
echo "  [$dir] pytest..."
if command -v pytest >/dev/null; then
  (cd "$dir" && pytest 2>&1 | tail -10) || true
fi
BLOCK
done

for dir in "${JAVA_ROOTS[@]}"; do
cat >> scripts/pre-push << BLOCK
echo "  [$dir] tests..."
if [ -f "$dir/pom.xml" ]; then (cd "$dir" && mvn test -q 2>&1 | tail -10)
elif [ -f "$dir/build.gradle" ]; then (cd "$dir" && ./gradlew test 2>&1 | tail -10)
fi
BLOCK
done

for dir in "${NODE_ROOTS[@]}"; do
cat >> scripts/pre-push << BLOCK
if [ -d "$dir/node_modules" ]; then
  echo "  [$dir] tsc..."
  (cd "$dir" && npx tsc --noEmit 2>/dev/null) || true
  echo "  [$dir] tests..."
  if grep -q vitest "$dir/package.json" 2>/dev/null; then
    (cd "$dir" && npx vitest run 2>&1 | tail -5)
  elif grep -q jest "$dir/package.json" 2>/dev/null; then
    (cd "$dir" && npx jest 2>&1 | tail -5)
  elif grep -q '"test"' "$dir/package.json" 2>/dev/null; then
    (cd "$dir" && npm test 2>&1 | tail -5)
  fi
fi
BLOCK
done

echo 'echo "pre-push: all tests passed"' >> scripts/pre-push
chmod +x scripts/pre-push

# -------------------------------------------------------
# Generate: scripts/ci.sh
# -------------------------------------------------------
echo "Generating scripts/ci.sh..."
cat > scripts/ci.sh << 'HEAD'
#!/bin/bash
set -e
echo "======================================="
echo "  Local CI Pipeline"
echo "======================================="
FAIL=0
step() { echo ""; echo "[$1] $2..."; }
pass() { echo "  PASS"; }
fail() { echo "  FAIL"; FAIL=1; }
HEAD

for dir in "${GO_ROOTS[@]}"; do
cat >> scripts/ci.sh << BLOCK
step "go" "Build ($dir)"
if (cd "$dir" && go build ./...); then pass; else fail; fi
step "go" "Test ($dir)"
if (cd "$dir" && go test ./... 2>&1 | tail -20); then pass; else fail; fi
BLOCK
done

for dir in "${RUST_ROOTS[@]}"; do
cat >> scripts/ci.sh << BLOCK
step "rust" "Build ($dir)"
if (cd "$dir" && cargo build 2>&1 | tail -5); then pass; else fail; fi
step "rust" "Test ($dir)"
if (cd "$dir" && cargo test 2>&1 | tail -10); then pass; else fail; fi
BLOCK
done

for dir in "${PY_ROOTS[@]}"; do
cat >> scripts/ci.sh << BLOCK
step "python" "Test ($dir)"
if command -v pytest >/dev/null; then
  if (cd "$dir" && pytest 2>&1 | tail -10); then pass; else fail; fi
else echo "  SKIP (no pytest)"; fi
BLOCK
done

for dir in "${JAVA_ROOTS[@]}"; do
cat >> scripts/ci.sh << BLOCK
step "java" "Test ($dir)"
if [ -f "$dir/pom.xml" ]; then
  if (cd "$dir" && mvn test -q 2>&1 | tail -10); then pass; else fail; fi
elif [ -f "$dir/build.gradle" ]; then
  if (cd "$dir" && ./gradlew test 2>&1 | tail -10); then pass; else fail; fi
fi
BLOCK
done

for dir in "${NODE_ROOTS[@]}"; do
cat >> scripts/ci.sh << BLOCK
if [ -d "$dir/node_modules" ]; then
  step "node" "TypeScript ($dir)"
  if (cd "$dir" && npx tsc --noEmit 2>/dev/null); then pass; else fail; fi
  step "node" "Test ($dir)"
  if grep -q vitest "$dir/package.json" 2>/dev/null; then
    if (cd "$dir" && npx vitest run 2>&1 | tail -5); then pass; else fail; fi
  elif grep -q jest "$dir/package.json" 2>/dev/null; then
    if (cd "$dir" && npx jest 2>&1 | tail -5); then pass; else fail; fi
  elif grep -q '"test"' "$dir/package.json" 2>/dev/null; then
    if (cd "$dir" && npm test 2>&1 | tail -5); then pass; else fail; fi
  fi
  step "node" "Build ($dir)"
  if grep -q vite "$dir/package.json" 2>/dev/null; then
    if (cd "$dir" && npx vite build 2>&1 | tail -3); then pass; else fail; fi
  elif grep -q '"build"' "$dir/package.json" 2>/dev/null; then
    if (cd "$dir" && npm run build 2>&1 | tail -3); then pass; else fail; fi
  else echo "  SKIP (no build script)"; fi
else
  echo ""; echo "[node] SKIP $dir (npm install needed)"
fi
BLOCK
done

if [ "$LINE_LIMIT" -gt 0 ]; then
cat >> scripts/ci.sh << BLOCK
step "lint" "File line limit ($LINE_LIMIT)"
OVER=\$(find . $EXCL_ARGS \\
  \( -name "*.go" -o -name "*.ts" -o -name "*.tsx" \\
     -o -name "*.py" -o -name "*.rs" -o -name "*.java" \) \\
  -exec sh -c 'l=\$(wc -l < "\$1"); [ "\$l" -gt $LINE_LIMIT ] && echo "\$l \$1"' _ {} \;)
if [ -z "\$OVER" ]; then pass
else echo "\$OVER"; fail; fi
BLOCK
fi

cat >> scripts/ci.sh << 'TAIL'
echo ""
echo "======================================="
if [ $FAIL -eq 0 ]; then echo "  CI PASSED"
else echo "  CI FAILED"; exit 1; fi
echo "======================================="
TAIL
chmod +x scripts/ci.sh

# -------------------------------------------------------
# Generate: scripts/deploy-local.sh
# -------------------------------------------------------
echo "Generating scripts/deploy-local.sh..."
cat > scripts/deploy-local.sh << 'HEAD'
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
HEAD

for dir in "${GO_ROOTS[@]}"; do
cat >> scripts/deploy-local.sh << BLOCK
echo "[build] Go binaries ($dir)..."
mkdir -p bin
for cmd in $dir/cmd/*/main.go; do
  [ -f "\$cmd" ] || continue
  name=\$(basename \$(dirname "\$cmd"))
  (cd "$dir" && go build -o "\$OLDPWD/bin/\$name" "./cmd/\$name")
  echo "  bin/\$name"
done
BLOCK
done

for dir in "${RUST_ROOTS[@]}"; do
cat >> scripts/deploy-local.sh << BLOCK
echo "[build] Rust release ($dir)..."
(cd "$dir" && cargo build --release)
BLOCK
done

for dir in "${NODE_ROOTS[@]}"; do
cat >> scripts/deploy-local.sh << BLOCK
echo "[build] Frontend ($dir)..."
if [ -d "$dir/node_modules" ]; then
  (cd "$dir" && npx vite build 2>&1 | tail -3) 2>/dev/null \\
    || (cd "$dir" && npm run build 2>&1 | tail -3) || true
else
  (cd "$dir" && npm install && npm run build 2>&1 | tail -3) || true
fi
BLOCK
done

$DOCKER && cat >> scripts/deploy-local.sh << 'BLOCK'
echo "[deploy] Docker..."
COMPOSE=$(find . -name "docker-compose.yml" | head -1)
if [ -n "$COMPOSE" ]; then
  docker-compose -f "$COMPOSE" down 2>/dev/null || true
  docker-compose -f "$COMPOSE" up -d
  echo "  Services started"
else echo "  No docker-compose.yml found"; fi
BLOCK

cat >> scripts/deploy-local.sh << 'TAIL'
echo ""
echo "======================================="
echo "  Deploy complete"
echo "======================================="
TAIL
chmod +x scripts/deploy-local.sh

# -------------------------------------------------------
# Generate: scripts/install-hooks.sh
# -------------------------------------------------------
echo "Generating scripts/install-hooks.sh..."
cat > scripts/install-hooks.sh << 'EOF'
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "Installing git hooks..."
for hook in pre-commit pre-push; do
  if [ -f "scripts/$hook" ]; then
    cp "scripts/$hook" ".git/hooks/$hook"
    chmod +x ".git/hooks/$hook"
    echo "  Installed: $hook"
  fi
done
echo "Done. Hooks active."
EOF
chmod +x scripts/install-hooks.sh

# Install hooks now
./scripts/install-hooks.sh

# Add Makefile targets if missing
if [ -f Makefile ] && ! grep -q "^ci:" Makefile; then
  cat >> Makefile << 'MK'

ci:
	@chmod +x scripts/ci.sh && ./scripts/ci.sh

deploy:
	@chmod +x scripts/deploy-local.sh && ./scripts/deploy-local.sh

check:
	@chmod +x scripts/pre-commit && ./scripts/pre-commit

install-hooks:
	@chmod +x scripts/install-hooks.sh && ./scripts/install-hooks.sh
MK
  echo "Added Makefile targets: ci, deploy, check, install-hooks"
fi

echo ""
echo "======================================="
echo "  cicd-init complete"
echo "======================================="
echo ""
echo "  ${#SERVICES[@]} service(s) detected"
echo ""
echo "Usage:"
echo "  make install-hooks  # one-time setup"
echo "  make ci             # full CI pipeline"
echo "  make deploy         # CI + build + deploy"
echo "  make check          # quick pre-commit checks"
echo ""
echo "Copy cicd-init.sh to any git repo and run it."
