#!/usr/bin/env bash
# enterprise.sh — static inventory of enterprise-grade capabilities.
#
# Greps the repo for the presence of files / route registrations that
# prove each capability ships. Does NOT hit the network — this is an
# evidence check, not an integration test (see live_site.sh for that).
#
# Each capability row prints one of:
#   ✓ SHIPPED — all required markers found
#   ~ PARTIAL — some markers found, others missing
#   ✗ MISSING — none of the required markers found
#
# The script fails (non-zero exit) only if there are MISSING items.
# PARTIAL items print a warning but don't block; they're meant to track
# capabilities mid-migration. Intended to run in CI and in the audit
# Makefile (`make audit-enterprise`).

set -u
set -o pipefail

ROOT="${PUSHCI_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

shipped=0
partial=0
missing=0

have() { [ -e "$1" ]; }
grep_q() { grep -rslq -- "$1" "$2" 2>/dev/null; }

row() {
  local label="$1" status="$2" detail="$3"
  case "$status" in
    shipped) printf "  ✓ %-40s %s\n"  "$label" "$detail"; shipped=$((shipped+1));;
    partial) printf "  ~ %-40s %s\n"  "$label" "$detail"; partial=$((partial+1));;
    missing) printf "  ✗ %-40s %s\n"  "$label" "$detail"; missing=$((missing+1));;
  esac
}

check_all() {
  local label="$1"; shift
  local -a missing_evidence=()
  for marker in "$@"; do
    # Marker format: "path::pattern" for grep, or just "path" for file.
    if [[ "$marker" == *"::"* ]]; then
      local p="${marker%%::*}" pat="${marker##*::}"
      grep_q "$pat" "$p" || missing_evidence+=("$marker")
    else
      have "$marker" || missing_evidence+=("$marker")
    fi
  done
  if [ ${#missing_evidence[@]} -eq 0 ]; then
    row "$label" shipped "($# markers)"
  elif [ ${#missing_evidence[@]} -lt $# ]; then
    row "$label" partial "missing: ${missing_evidence[*]}"
  else
    row "$label" missing "no markers found"
  fi
}

echo "== Enterprise capability inventory =="

# Identity ---------------------------------------------------------------
check_all "SAML 2.0 SSO" \
  "api/src/saml-routes.ts" \
  "api/src/index.ts::samlRoutes"

check_all "SCIM 2.0 provisioning" \
  "api/src/scim.ts" \
  "api/src/index.ts::scimRoutes"

check_all "MFA (TOTP)" \
  "api/src/mfa-routes.ts" \
  "api/src/security/totp.ts" \
  "api/src/index.ts::mfaRoutes" \
  "api/migrations/2026-04-22_mfa_and_audit_chain.sql::mfa_enrollments"

check_all "Service accounts" \
  "api/src/service-accounts.ts" \
  "api/src/service-accounts.ts::serviceAccountRoutes" \
  "api/migrations/2026-04-22_mfa_and_audit_chain.sql::service_accounts"

check_all "Fine-grained API token scopes" \
  "api/src/service-accounts.ts::requireScope" \
  "api/src/service-accounts.ts::SCOPES" \
  "api/migrations/2026-04-22_mfa_and_audit_chain.sql::api_tokens"

# Compliance -------------------------------------------------------------
check_all "Audit log (baseline)" \
  "api/src/audit-api.ts" \
  "api/src/db.ts::audit_logs"

check_all "Immutable audit (hash chain)" \
  "api/src/audit-chain.ts" \
  "api/src/audit-chain.ts::verifyChain" \
  "api/migrations/2026-04-22_mfa_and_audit_chain.sql::row_hash"

check_all "SIEM export" \
  "api/src/audit-siem.ts" \
  "api/src/audit-siem.ts::toSplunk" \
  "api/src/audit-siem.ts::toDatadog" \
  "api/migrations/2026-04-22_mfa_and_audit_chain.sql::siem_destinations"

check_all "Policy engine" \
  "api/src/policy-routes.ts"

# Scale ------------------------------------------------------------------
check_all "Self-hosted runners" \
  "internal/runner" \
  "api/src/cloud-runners.ts"

check_all "Managed runner fleet" \
  "api/src/managed-fleet.ts"

# Platform discovery -----------------------------------------------------
check_all "GitHub Actions runtime (act)" \
  "internal/actions"

check_all "Pipeline security scanning" \
  "cmd/pushci/cmd_scan.go" \
  "cmd/pushci/cmd_scan_sarif.go" \
  "internal/security"

check_all "Artifact registry" \
  "api/src/artifacts.ts"

# Supply chain -----------------------------------------------------------
check_all "Cosign-signed releases" \
  ".goreleaser.yml::cosign"

check_all "SBOM generation" \
  ".goreleaser.yml::sbom"

echo
echo "SUMMARY: shipped=$shipped partial=$partial missing=$missing"

if [ $missing -gt 0 ]; then
  echo "FAIL: $missing enterprise capabilities missing"
  exit 1
fi
exit 0
