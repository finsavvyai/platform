# ─────────────────────────────────────────────────────────
# Vault Policy — RAG Engine Service
# ─────────────────────────────────────────────────────────

# Database credentials
path "database/creds/rag-engine-role" {
  capabilities = ["read"]
}

# LLM API keys (OpenAI, Anthropic, etc.)
path "secret/data/sdlc/rag-engine/llm-keys" {
  capabilities = ["read"]
}

# Embedding service credentials
path "secret/data/sdlc/rag-engine/embeddings" {
  capabilities = ["read"]
}

# Vector store credentials
path "secret/data/sdlc/rag-engine/vector-store" {
  capabilities = ["read"]
}

# S3/R2 storage credentials for document access
path "secret/data/sdlc/rag-engine/storage" {
  capabilities = ["read"]
}

# Transit — encrypt/decrypt document content
path "transit/encrypt/document-data" {
  capabilities = ["update"]
}
path "transit/decrypt/document-data" {
  capabilities = ["update"]
}

# Token self-management
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
