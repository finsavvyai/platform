#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Vault Bootstrap Script — SDLC.ai Platform
# Initializes secrets engines, policies, auth methods,
# database dynamic credentials, and secret rotation.
# ─────────────────────────────────────────────────────────
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://vault.sdlc-platform.svc:8200}"
export VAULT_ADDR

echo "═══════════════════════════════════════════"
echo "  Vault Bootstrap — SDLC.ai Platform"
echo "═══════════════════════════════════════════"

# ── 1. Enable Secrets Engines ────────────────────────────
echo "» Enabling secrets engines..."

vault secrets enable -path=secret kv-v2 2>/dev/null || true
vault secrets enable -path=database database 2>/dev/null || true
vault secrets enable -path=transit transit 2>/dev/null || true
vault secrets enable -path=pki pki 2>/dev/null || true
vault secrets enable -path=pki_int pki 2>/dev/null || true

echo "  ✓ Secrets engines enabled"

# ── 2. Configure Database Secrets Engine ─────────────────
echo "» Configuring database dynamic credentials..."

vault write database/config/postgresql \
  plugin_name=postgresql-database-plugin \
  allowed_roles="gateway-role,rag-engine-role" \
  connection_url="postgresql://{{username}}:{{password}}@postgres.sdlc-platform.svc:5432/sdlc?sslmode=require" \
  username="${PG_ADMIN_USER}" \
  password="${PG_ADMIN_PASS}" \
  password_authentication="scram-sha-256"

# Gateway role — 1h TTL, max 24h
vault write database/roles/gateway-role \
  db_name=postgresql \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# RAG engine role — read-heavy, 1h TTL
vault write database/roles/rag-engine-role \
  db_name=postgresql \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
    GRANT INSERT ON documents, document_chunks TO \"{{name}}\";" \
  revocation_statements="REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

echo "  ✓ Database dynamic credentials configured"

# ── 3. Configure Transit Engine (Encryption as a Service) ─
echo "» Configuring transit encryption keys..."

vault write -f transit/keys/tenant-data \
  type=aes256-gcm96 \
  auto_rotate_period=720h   # 30-day rotation

vault write -f transit/keys/document-data \
  type=aes256-gcm96 \
  auto_rotate_period=720h

vault write -f transit/keys/api-key-hmac \
  type=hmac \
  auto_rotate_period=2160h  # 90-day rotation

echo "  ✓ Transit encryption keys configured"

# ── 4. Configure PKI for mTLS ────────────────────────────
echo "» Configuring PKI for internal mTLS..."

# Root CA — 10 year
vault write pki/root/generate/internal \
  common_name="SDLC Platform Root CA" \
  ttl=87600h \
  key_bits=4096

vault write pki/config/urls \
  issuing_certificates="${VAULT_ADDR}/v1/pki/ca" \
  crl_distribution_points="${VAULT_ADDR}/v1/pki/crl"

# Intermediate CA — 5 year
vault write -format=json pki_int/intermediate/generate/internal \
  common_name="SDLC Platform Intermediate CA" \
  key_bits=4096 | jq -r '.data.csr' > /tmp/pki_int.csr

vault write -format=json pki/root/sign-intermediate \
  csr=@/tmp/pki_int.csr \
  format=pem_bundle \
  ttl=43800h | jq -r '.data.certificate' > /tmp/intermediate.cert.pem

vault write pki_int/intermediate/set-signed \
  certificate=@/tmp/intermediate.cert.pem

# Role for issuing service certificates — 72h TTL
vault write pki_int/roles/gateway \
  allowed_domains="sdlc-platform.svc,sdlc-platform.svc.cluster.local" \
  allow_subdomains=true \
  max_ttl=72h \
  key_bits=2048 \
  require_cn=false

rm -f /tmp/pki_int.csr /tmp/intermediate.cert.pem
echo "  ✓ PKI configured"

# ── 5. Write Application Secrets ─────────────────────────
echo "» Seeding application secrets..."

vault kv put secret/sdlc/gateway/jwt \
  signing_key="${JWT_SIGNING_KEY:-$(openssl rand -base64 64)}" \
  issuer="sdlc.cc" \
  audience="sdlc-api" \
  access_ttl="3600" \
  refresh_ttl="604800"

vault kv put secret/sdlc/gateway/redis \
  host="redis-master.sdlc-platform.svc" \
  port="6379" \
  password="${REDIS_PASSWORD}" \
  tls_enabled="true"

vault kv put secret/sdlc/gateway/storage \
  provider="cloudflare-r2" \
  account_id="${CF_ACCOUNT_ID}" \
  access_key="${CF_R2_ACCESS_KEY}" \
  secret_key="${CF_R2_SECRET_KEY}" \
  bucket="sdlc-documents"

vault kv put secret/sdlc/rag-engine/llm-keys \
  openai_key="${OPENAI_API_KEY}" \
  anthropic_key="${ANTHROPIC_API_KEY:-}" \
  default_provider="openai"

vault kv put secret/sdlc/rag-engine/embeddings \
  provider="openai" \
  model="text-embedding-3-small" \
  api_key="${OPENAI_API_KEY}"

echo "  ✓ Application secrets seeded"

# ── 6. Apply Policies ────────────────────────────────────
echo "» Applying service policies..."

vault policy write gateway-policy /vault/policies/gateway-policy.hcl
vault policy write rag-engine-policy /vault/policies/rag-engine-policy.hcl

echo "  ✓ Policies applied"

# ── 7. Configure Kubernetes Auth ─────────────────────────
echo "» Configuring Kubernetes authentication..."

vault auth enable kubernetes 2>/dev/null || true

vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# Gateway service account → gateway-policy
vault write auth/kubernetes/role/gateway \
  bound_service_account_names="gateway-sa" \
  bound_service_account_namespaces="sdlc-platform" \
  policies="gateway-policy" \
  ttl="1h" \
  max_ttl="4h"

# RAG engine service account → rag-engine-policy
vault write auth/kubernetes/role/rag-engine \
  bound_service_account_names="rag-engine-sa" \
  bound_service_account_namespaces="sdlc-platform" \
  policies="rag-engine-policy" \
  ttl="1h" \
  max_ttl="4h"

echo "  ✓ Kubernetes auth configured"

# ── 8. Enable Audit Logging ──────────────────────────────
echo "» Enabling audit logging..."

vault audit enable file file_path=/vault/logs/audit.log 2>/dev/null || true

echo "  ✓ Audit logging enabled"

echo ""
echo "═══════════════════════════════════════════"
echo "  Vault bootstrap complete"
echo "═══════════════════════════════════════════"
echo ""
echo "  Secrets engines: kv-v2, database, transit, pki"
echo "  Dynamic DB creds: gateway-role, rag-engine-role"
echo "  Transit keys: tenant-data, document-data, api-key-hmac"
echo "  PKI: root CA + intermediate CA + gateway role"
echo "  Auth: Kubernetes (gateway, rag-engine)"
echo "  Audit: file-based (/vault/logs/audit.log)"
echo ""
