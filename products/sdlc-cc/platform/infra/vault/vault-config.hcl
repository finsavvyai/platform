# ─────────────────────────────────────────────────────────
# HashiCorp Vault Configuration — SDLC.ai Platform
# ─────────────────────────────────────────────────────────

# Storage backend — use Raft for HA in production
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-0"

  retry_join {
    leader_api_addr = "https://vault-0.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-1.vault-internal:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-2.vault-internal:8200"
  }
}

# Listener — TLS in production
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = false

  tls_cert_file = "/vault/tls/tls.crt"
  tls_key_file  = "/vault/tls/tls.key"

  # Telemetry
  telemetry {
    unauthenticated_metrics_access = true
  }
}

# API address
api_addr     = "https://vault.sdlc-platform.svc:8200"
cluster_addr = "https://vault.sdlc-platform.svc:8201"

# Telemetry — Prometheus metrics
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname         = true
}

# Seal — use auto-unseal in production (AWS KMS example)
# seal "awskms" {
#   region     = "us-west-2"
#   kms_key_id = "alias/vault-unseal"
# }

# UI
ui = true

# Audit logging
audit {
  type = "file"
  options {
    file_path = "/vault/logs/audit.log"
  }
}

# Performance
max_lease_ttl     = "768h"  # 32 days
default_lease_ttl = "8h"
