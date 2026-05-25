#!/bin/bash
set -euo pipefail

# Generate types-only SDK clients from the OpenAPI spec.
# Output lands in services/gateway/internal/sdk-generated/{go,py,ts}/ — used
# as a CI contract gate, NOT as the public SDK. Hand-authored SDKs in
# packages/sdk-{go,py,ts}/ remain the published surface.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="$GATEWAY_DIR/api"
OUTPUT_DIR="$GATEWAY_DIR/internal/sdk-generated"
MERGED_SPEC="$OUTPUT_DIR/openapi-merged.yaml"
OPENAPI_GENERATOR_VERSION="7.10.0"

# shellcheck disable=SC2034
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing tool: $1. ${2:-}"
}

check_deps() {
  require python3 "Install Python 3 (used for spec merge)."
  require oapi-codegen "Install via: go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest"
  require npx "Install Node.js 18+ (npx required for openapi-generator-cli)."
  require java "Install JDK 11+ (openapi-generator-cli runtime)."
  log "All dependencies found."
}

merge_specs() {
  local base="$API_DIR/openapi.yaml" ext="$API_DIR/openapi-extensions.yaml"
  log "Merging OpenAPI specifications..."
  mkdir -p "$OUTPUT_DIR"
  python3 - "$base" "$ext" "$MERGED_SPEC" <<'PY'
import sys, yaml
base, ext, out = sys.argv[1], sys.argv[2], sys.argv[3]
with open(base) as f: a = yaml.safe_load(f)
with open(ext) as f: b = yaml.safe_load(f)
a.setdefault("paths", {}).update(b.get("paths") or {})
a.setdefault("components", {})
for k, v in (b.get("components") or {}).items():
    a["components"].setdefault(k, {}).update(v or {})
with open(out, "w") as f: yaml.safe_dump(a, f, sort_keys=False)
PY
  log "Merged spec written: $MERGED_SPEC"
}

run_openapi_generator() {
  npx --yes "@openapitools/openapi-generator-cli@$OPENAPI_GENERATOR_VERSION" "$@"
}

generate_go() {
  local out="$OUTPUT_DIR/go"
  log "Generating Go SDK -> $out"
  mkdir -p "$out"
  oapi-codegen --package=sdlcgen --generate=types,client \
    --output="$out/client.gen.go" "$MERGED_SPEC"
  oapi-codegen --package=sdlcgen --generate=chi-server \
    --output="$out/server.gen.go" "$MERGED_SPEC"
}

generate_python() {
  local out="$OUTPUT_DIR/py"
  log "Generating Python SDK -> $out"
  rm -rf "$out" && mkdir -p "$out"
  run_openapi_generator generate -i "$MERGED_SPEC" -g python -o "$out" \
    --package-name=sdlc_ai \
    --additional-properties=packageVersion=1.0.0 \
    --skip-validate-spec
}

generate_typescript() {
  local out="$OUTPUT_DIR/ts"
  log "Generating TypeScript SDK -> $out"
  rm -rf "$out" && mkdir -p "$out"
  run_openapi_generator generate -i "$MERGED_SPEC" -g typescript-fetch -o "$out" \
    --additional-properties=npmVersion=1.0.0 \
    --skip-validate-spec
}

generate_docs() {
  local out="$GATEWAY_DIR/docs/api"
  log "Generating API documentation -> $out"
  mkdir -p "$out"
  run_openapi_generator generate -i "$MERGED_SPEC" -g html -o "$out" --skip-validate-spec
}

validate() {
  log "Validating merged spec..."
  run_openapi_generator validate -i "$MERGED_SPEC"
}

main() {
  log "Starting SDK generation..."
  check_deps && merge_specs && validate \
    && generate_go && generate_python && generate_typescript && generate_docs
  log "Done. Output: $OUTPUT_DIR/{go,py,ts} + docs at $GATEWAY_DIR/docs/api"
}

case "${1:-all}" in
  go)         check_deps; merge_specs; generate_go ;;
  python|py)  check_deps; merge_specs; generate_python ;;
  typescript|ts) check_deps; merge_specs; generate_typescript ;;
  validate)   check_deps; merge_specs; validate ;;
  docs)       check_deps; merge_specs; generate_docs ;;
  all)        main ;;
  *)
    cat <<USAGE
Usage: $0 {all|go|python|typescript|validate|docs}
  all          Generate Go + Python + TypeScript + HTML docs
  go           Go SDK only (oapi-codegen)
  python       Python SDK only (openapi-generator)
  typescript   TypeScript SDK only (openapi-generator)
  validate     Validate the merged spec
  docs         HTML API docs only
Output base: $OUTPUT_DIR
USAGE
    exit 1 ;;
esac
