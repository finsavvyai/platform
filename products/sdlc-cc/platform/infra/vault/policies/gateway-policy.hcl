# ─────────────────────────────────────────────────────────
# Vault Policy — Gateway Service
# Least-privilege access to secrets required by the gateway
# ─────────────────────────────────────────────────────────

# Database credentials — read-only, rotated automatically
path "database/creds/gateway-role" {
  capabilities = ["read"]
}

# JWT signing keys
path "secret/data/sdlc/gateway/jwt" {
  capabilities = ["read"]
}

# API encryption keys
path "secret/data/sdlc/gateway/encryption" {
  capabilities = ["read"]
}

# Redis credentials
path "secret/data/sdlc/gateway/redis" {
  capabilities = ["read"]
}

# S3/R2 storage credentials
path "secret/data/sdlc/gateway/storage" {
  capabilities = ["read"]
}

# SMTP credentials for notifications
path "secret/data/sdlc/gateway/smtp" {
  capabilities = ["read"]
}

# OPA policy engine credentials
path "secret/data/sdlc/gateway/opa" {
  capabilities = ["read"]
}

# PKI — issue TLS certificates for mTLS
path "pki_int/issue/gateway" {
  capabilities = ["create", "update"]
}

# Transit — encrypt/decrypt tenant data
path "transit/encrypt/tenant-data" {
  capabilities = ["update"]
}
path "transit/decrypt/tenant-data" {
  capabilities = ["update"]
}

# Token self-management
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
