#!/usr/bin/env bash
# validate.sh - Validate the merged OpenAPI spec
# Checks YAML syntax, required fields, and prints a summary.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_FILE="${SCRIPT_DIR}/openapi-merged.yaml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC}: $1"; }
fail() { echo -e "${RED}FAIL${NC}: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}WARN${NC}: $1"; }

ERRORS=0

echo "================================================"
echo " FinSavvy AI - OpenAPI Spec Validation"
echo "================================================"
echo ""

# --- Check file exists ---
if [ ! -f "$SPEC_FILE" ]; then
  fail "Spec file not found: ${SPEC_FILE}"
  exit 1
fi
pass "Spec file exists"

# --- Check valid YAML syntax ---
if command -v python3 &>/dev/null; then
  if python3 -c "
import yaml, sys
try:
    with open('${SPEC_FILE}') as f:
        yaml.safe_load(f)
    sys.exit(0)
except Exception as e:
    print(f'  YAML parse error: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
    pass "Valid YAML syntax"
  else
    fail "Invalid YAML syntax"
  fi
else
  warn "python3 not found, skipping YAML parse check"
fi

# --- Check required top-level fields ---
check_field() {
  local field="$1"
  if grep -qE "^${field}:" "$SPEC_FILE"; then
    pass "Required field present: ${field}"
  else
    fail "Missing required field: ${field}"
  fi
}

check_field "openapi"
check_field "info"
check_field "paths"
check_field "components"

# --- Check info sub-fields ---
if grep -q "title:" "$SPEC_FILE"; then
  pass "info.title present"
else
  fail "Missing info.title"
fi

if grep -q "version:" "$SPEC_FILE"; then
  pass "info.version present"
else
  fail "Missing info.version"
fi

# --- Check servers ---
if grep -q "servers:" "$SPEC_FILE"; then
  pass "servers block present"
else
  fail "Missing servers block"
fi

# --- Check security schemes ---
if grep -q "securitySchemes:" "$SPEC_FILE"; then
  pass "securitySchemes present"
else
  fail "Missing securitySchemes"
fi

if grep -q "bearerAuth:" "$SPEC_FILE"; then
  pass "bearerAuth scheme defined"
else
  fail "Missing bearerAuth scheme"
fi

if grep -q "apiKeyAuth:" "$SPEC_FILE"; then
  pass "apiKeyAuth scheme defined"
else
  fail "Missing apiKeyAuth scheme"
fi

# --- Check operationIds are camelCase ---
OPERATION_IDS=$(grep -oP 'operationId:\s*\K\S+' "$SPEC_FILE" 2>/dev/null || \
  grep -oE 'operationId: [a-zA-Z0-9]+' "$SPEC_FILE" | sed 's/operationId: //')

NON_CAMEL=0
for op in $OPERATION_IDS; do
  if echo "$op" | grep -qE '^[a-z][a-zA-Z0-9]*$'; then
    : # valid camelCase
  else
    warn "Non-camelCase operationId: ${op}"
    NON_CAMEL=$((NON_CAMEL + 1))
  fi
done

if [ "$NON_CAMEL" -eq 0 ]; then
  pass "All operationIds are camelCase"
fi

echo ""
echo "================================================"
echo " Summary"
echo "================================================"

# Count endpoints
ENDPOINT_COUNT=$(grep -cE '^\s{2}/[a-z]' "$SPEC_FILE" || echo 0)
echo "  Endpoints (path entries):  ${ENDPOINT_COUNT}"

# Count operations (HTTP methods)
OP_COUNT=$(grep -cE '^\s{4}(get|post|put|patch|delete):' "$SPEC_FILE" || echo 0)
echo "  Operations (HTTP methods): ${OP_COUNT}"

# Count schemas
SCHEMA_COUNT=$(grep -cE '^\s{4}[A-Z][a-zA-Z]+:$' "$SPEC_FILE" || echo 0)
echo "  Schemas:                   ${SCHEMA_COUNT}"

# Count tags
TAG_COUNT=$(grep -cE '^\s{2}- name:' "$SPEC_FILE" || echo 0)
echo "  Tags:                      ${TAG_COUNT}"

# Count operationIds
OP_ID_COUNT=$(echo "$OPERATION_IDS" | wc -w | tr -d ' ')
echo "  Operation IDs:             ${OP_ID_COUNT}"

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}Validation FAILED with ${ERRORS} error(s)${NC}"
  exit 1
else
  echo -e "${GREEN}Validation PASSED${NC}"
  exit 0
fi
