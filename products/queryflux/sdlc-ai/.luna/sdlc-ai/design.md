# SDLC.ai Platform - Technical Design Specification

**Project:** SDLC.ai - Secure Data Learning Platform v3
**Version:** 1.0.0
**Date:** January 10, 2026
**Status:** Design Complete
**Architect:** Luna Design Agent

---

## Executive Summary

This document provides a comprehensive technical design for the SDLC.ai platform, transforming the requirements into actionable architecture, component specifications, and implementation guidelines. The design follows enterprise best practices for security, scalability, and maintainability while enabling rapid iteration and deployment.

### Design Principles

1. **Security First:** Zero-trust architecture with encryption, audit logging, and policy enforcement at every layer
2. **Privacy by Design:** DLP and PII detection/redaction built into core workflows
3. **Performance Optimized:** Sub-200ms API latency, sub-500ms vector search, sub-3s RAG queries
4. **Cloud Native:** Serverless-first with Cloudflare Workers, auto-scaling, and multi-region capability
5. **Developer Experience:** Comprehensive APIs, SDKs, and documentation
6. **Compliance Ready:** GDPR, HIPAA, PCI-DSS, FINRA compliance built-in

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Design](#component-design)
3. [Data Architecture](#data-architecture)
4. [API Design](#api-design)
5. [Security Architecture](#security-architecture)
6. [Deployment Architecture](#deployment-architecture)
7. [Integration Architecture](#integration-architecture)
8. [Monitoring & Observability](#monitoring--observability)
9. [Implementation Guidelines](#implementation-guidelines)
10. [Technology Stack Details](#technology-stack-details)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Web App  │  │ Mobile   │  │   CLI    │  │  SDK Clients     │   │
│  │ (Next.js)│  │   App    │  │  Tool    │  │ (Go/Py/TS/Node)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                         HTTPS/TLS 1.3 + JWT
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Edge Layer (Cloudflare)                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Cloudflare Workers (Edge Functions)                       │    │
│  │  • DDoS Protection  • WAF  • Rate Limiting  • SSL/TLS      │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer (Go)                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Gateway Service (Port 8080)                               │    │
│  │  • JWT Validation     • Request Routing   • mTLS           │    │
│  │  • Rate Limiting      • Audit Logging     • CORS           │    │
│  │  • OPA Policy Eval    • Circuit Breaker   • Load Balancing │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   RAG Service    │    │   LLM Gateway    │    │   DLP Service    │
│  (Python/Rust)   │    │      (Go)        │    │    (Python)      │
│  Port: 8001      │    │   Port: 8002     │    │   Port: 8003     │
├──────────────────┤    ├──────────────────┤    ├──────────────────┤
│ • Document Proc  │    │ • Provider Route │    │ • PII Detection  │
│ • Text Chunking  │    │ • Token Tracking │    │ • Redaction      │
│ • Embeddings     │◄───┤ • Prompt Builder │───►│ • Tokenization   │
│ • Vector Search  │    │ • Response Cache │    │ • Risk Scoring   │
│ • Hybrid Search  │    │ • Fallback Logic │    │ • Pattern Engine │
└──────────────────┘    └──────────────────┘    └──────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Supporting Services Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ OPA Service  │  │ Auth Service │  │ Document Processor      │  │
│  │ (Port 8181)  │  │ (Port 8004)  │  │ Service (Port 8005)     │  │
│  │ • Policy Eval│  │ • User Mgmt  │  │ • File Upload           │  │
│  │ • Rule Engine│  │ • MFA        │  │ • Text Extraction       │  │
│  └──────────────┘  └──────────────┘  │ • Format Conversion     │  │
│                                       └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data & Storage Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ PostgreSQL   │  │    Redis     │  │   Cloudflare Storage     │ │
│  │ + pgvector   │  │              │  │                          │ │
│  │              │  │ • Sessions   │  │ • R2 (Object Storage)    │ │
│  │ • Core Data  │  │ • Cache      │  │ • KV (Key-Value)         │ │
│  │ • Vectors    │  │ • Rate Limit │  │ • Vectorize (Vectors)    │ │
│  │ • Audit Logs │  │ • Blacklist  │  │ • D1 (Edge SQL)          │ │
│  │ • Multi-Tenant│ │ • PubSub     │  │ • Queues (Async Jobs)    │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Observability & Monitoring Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Prometheus   │  │   Grafana    │  │  OpenTelemetry          │ │
│  │ (Metrics)    │  │ (Dashboards) │  │  (Distributed Tracing)  │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ ELK/Loki     │  │ AlertManager │  │  Jaeger                 │ │
│  │ (Logs)       │  │ (Alerting)   │  │  (Trace Visualization)  │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      External Integrations                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ LLM Providers│  │  Embedding   │  │  Notification Services  │ │
│  │              │  │  Providers   │  │                         │ │
│  │ • OpenAI     │  │ • OpenAI     │  │ • Email (SendGrid)      │ │
│  │ • Anthropic  │  │ • Cohere     │  │ • SMS (Twilio)          │ │
│  │ • Google     │  │ • Hugging    │  │ • Webhooks              │ │
│  │ • AWS Bedrock│  │   Face       │  │ • Slack/Teams           │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture Layers

| Layer | Purpose | Technologies | Scale |
|-------|---------|--------------|-------|
| **Client** | User interfaces and SDK clients | Next.js, React, Go/Python/TS SDKs | Unlimited clients |
| **Edge** | DDoS, WAF, SSL termination | Cloudflare Workers | Global CDN |
| **Gateway** | API gateway, auth, routing | Go, chi router, JWT | 10K req/sec/instance |
| **Services** | Business logic microservices | Go, Python, Rust | Auto-scaling |
| **Data** | Persistent and cache storage | PostgreSQL, Redis, Cloudflare | Multi-tenant isolated |
| **Observability** | Monitoring, logging, tracing | Prometheus, Grafana, OTEL | Real-time metrics |

---

## Component Design

### 1. API Gateway Service (Go)

**Purpose:** Central entry point for all API requests with authentication, authorization, rate limiting, and request routing.

#### Responsibilities

- JWT token validation and user context extraction
- mTLS certificate validation for service-to-service communication
- OPA policy evaluation for authorization
- Rate limiting enforcement (per user, per tenant, per API key)
- Request routing to downstream services
- Circuit breaker pattern for fault tolerance
- Comprehensive audit logging
- CORS handling
- Request/response transformation

#### Technology Stack

```go
// Core Technologies
- Language: Go 1.21+
- HTTP Framework: chi router v5
- JWT: lestrrat-go/jwx v2
- mTLS: crypto/tls (Go stdlib)
- Rate Limiting: golang.org/x/time/rate
- Circuit Breaker: sony/gobreaker
- Tracing: OpenTelemetry Go SDK
- Metrics: Prometheus client_golang

// Key Dependencies
- pgx/v5: PostgreSQL driver
- go-redis/v9: Redis client
- zap: Structured logging
- validator/v10: Request validation
```

#### Component Structure

```
services/gateway/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/
│   ├── domain/
│   │   ├── models/                 # Domain models
│   │   └── services/               # Business logic
│   │       ├── auth_service.go
│   │       ├── jwt_service.go
│   │       └── audit_service.go
│   ├── infrastructure/
│   │   ├── database/               # Database access
│   │   │   ├── postgres.go
│   │   │   └── repository/
│   │   ├── cache/                  # Redis cache
│   │   │   └── redis.go
│   │   ├── http/                   # HTTP server
│   │   │   ├── server.go
│   │   │   ├── routes.go
│   │   │   └── middleware/
│   │   │       ├── auth.go
│   │   │       ├── rate_limit.go
│   │   │       ├── circuit_breaker.go
│   │   │       └── audit_log.go
│   │   └── clients/                # Service clients
│   │       ├── rag_client.go
│   │       ├── llm_client.go
│   │       └── dlp_client.go
│   └── config/
│       └── config.go               # Configuration management
├── pkg/
│   ├── errors/                     # Error types
│   ├── logger/                     # Logging utilities
│   └── metrics/                    # Metrics helpers
└── tests/
    ├── unit/
    └── integration/
```

#### Key Interfaces

```go
// AuthService handles authentication and authorization
type AuthService interface {
    ValidateToken(ctx context.Context, token string) (*UserContext, error)
    RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
    RevokeToken(ctx context.Context, token string) error
}

// PolicyService evaluates access policies
type PolicyService interface {
    EvaluatePolicy(ctx context.Context, req *PolicyRequest) (*PolicyDecision, error)
    LoadPolicies(ctx context.Context) error
}

// AuditService logs security events
type AuditService interface {
    LogRequest(ctx context.Context, event *AuditEvent) error
    LogSecurityEvent(ctx context.Context, event *SecurityEvent) error
}

// RateLimiter enforces rate limits
type RateLimiter interface {
    Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error)
    Reset(ctx context.Context, key string) error
}
```

#### Configuration

```yaml
# config/gateway.yaml
server:
  host: "0.0.0.0"
  port: 8080
  read_timeout: 30s
  write_timeout: 30s
  idle_timeout: 120s
  max_header_bytes: 1048576  # 1MB

auth:
  jwt:
    algorithm: RS256
    public_key_path: /certs/jwt-public.pem
    access_token_ttl: 1h
    refresh_token_ttl: 720h
  mtls:
    enabled: true
    ca_cert_path: /certs/ca.pem
    cert_path: /certs/server-cert.pem
    key_path: /certs/server-key.pem

rate_limiting:
  default_user_limit: 100        # requests per minute
  default_tenant_limit: 1000     # requests per minute
  burst: 10

circuit_breaker:
  max_requests: 3
  interval: 60s
  timeout: 30s

services:
  rag:
    url: http://rag-service:8001
    timeout: 5s
  llm:
    url: http://llm-gateway:8002
    timeout: 10s
  dlp:
    url: http://dlp-service:8003
    timeout: 3s

database:
  host: postgres
  port: 5432
  database: sdlc_platform
  username: ${DB_USERNAME}
  password: ${DB_PASSWORD}
  ssl_mode: require
  max_open_conns: 100
  max_idle_conns: 10
  conn_max_lifetime: 1h

redis:
  host: redis
  port: 6379
  password: ${REDIS_PASSWORD}
  db: 0
  pool_size: 100

logging:
  level: info
  format: json
  output: stdout

metrics:
  enabled: true
  port: 9090
  path: /metrics
```

#### API Endpoints

```
# Health & Status
GET  /health                        # Health check
GET  /ready                         # Readiness check
GET  /metrics                       # Prometheus metrics

# Authentication
POST /api/v1/auth/register          # User registration
POST /api/v1/auth/login             # User login
POST /api/v1/auth/logout            # User logout
POST /api/v1/auth/refresh           # Token refresh
POST /api/v1/auth/mfa/setup         # MFA setup
POST /api/v1/auth/mfa/verify        # MFA verification
GET  /api/v1/auth/me                # Current user

# Documents (proxied to RAG service)
POST /api/v1/documents              # Upload document
GET  /api/v1/documents              # List documents
GET  /api/v1/documents/:id          # Get document
DELETE /api/v1/documents/:id        # Delete document
POST /api/v1/documents/search       # Semantic search

# Queries (proxied to LLM Gateway)
POST /api/v1/queries                # RAG query
GET  /api/v1/queries/:id            # Get query result
GET  /api/v1/queries                # List queries

# DLP (proxied to DLP service)
POST /api/v1/dlp/scan               # Scan content
GET  /api/v1/dlp/scans              # List scans
GET  /api/v1/dlp/patterns           # List PII patterns
POST /api/v1/dlp/patterns           # Create custom pattern

# Admin
GET  /api/v1/admin/users            # List users
POST /api/v1/admin/users            # Create user
PUT  /api/v1/admin/users/:id        # Update user
DELETE /api/v1/admin/users/:id      # Delete user
GET  /api/v1/admin/tenants          # List tenants
GET  /api/v1/admin/audit            # Audit logs
GET  /api/v1/admin/metrics          # Usage metrics

# API Keys
POST /api/v1/keys                   # Create API key
GET  /api/v1/keys                   # List API keys
DELETE /api/v1/keys/:id             # Revoke API key
```

---

### 2. RAG Service (Python/Rust)

**Purpose:** Retrieval-Augmented Generation pipeline for document processing, embedding generation, vector search, and context retrieval.

#### Responsibilities

- Document ingestion and text extraction (PDF, DOCX, TXT, HTML, Markdown)
- Text chunking with configurable strategies
- Embedding generation via multiple providers (OpenAI, Cohere, Hugging Face)
- Vector storage and indexing (pgvector or Vectorize)
- Semantic search with cosine similarity
- Hybrid search (semantic + keyword BM25)
- Document reprocessing pipeline
- Embedding cache management

#### Technology Stack

```python
# Core Technologies
- Language: Python 3.11+
- Framework: FastAPI
- Vector Engine: Rust module (via PyO3)
- Embeddings: OpenAI, Cohere, sentence-transformers
- Document Processing: pypdf, python-docx, beautifulsoup4
- Text Chunking: langchain, tiktoken
- Vector DB: pgvector (PostgreSQL extension)
- Async: asyncio, aiohttp

# Key Dependencies
- fastapi: Web framework
- pydantic: Data validation
- sqlalchemy: ORM
- asyncpg: PostgreSQL async driver
- redis-py: Redis client
- sentence-transformers: Local embeddings
- tiktoken: Token counting
- langchain: Document loaders and chunking
```

#### Component Structure

```
services/rag/
├── app/
│   ├── main.py                     # FastAPI application
│   ├── config.py                   # Configuration
│   ├── models/
│   │   ├── document.py
│   │   ├── chunk.py
│   │   └── query.py
│   ├── services/
│   │   ├── document_service.py
│   │   ├── embedding_service.py
│   │   ├── chunking_service.py
│   │   ├── vector_search_service.py
│   │   └── hybrid_search_service.py
│   ├── repositories/
│   │   ├── document_repository.py
│   │   └── vector_repository.py
│   ├── routes/
│   │   ├── documents.py
│   │   ├── search.py
│   │   └── health.py
│   ├── middleware/
│   │   ├── auth.py
│   │   ├── error_handler.py
│   │   └── logging.py
│   └── utils/
│       ├── text_extraction.py
│       ├── token_counter.py
│       └── cache.py
├── vector_engine/                  # Rust module
│   ├── src/
│   │   ├── lib.rs
│   │   ├── hnsw.rs
│   │   └── search.rs
│   └── Cargo.toml
├── tests/
│   ├── unit/
│   └── integration/
└── requirements.txt
```

#### Key Classes

```python
# DocumentService handles document ingestion
class DocumentService:
    async def upload_document(
        self,
        file: UploadFile,
        tenant_id: UUID,
        metadata: Dict[str, Any]
    ) -> Document:
        """Upload and process document"""
        pass

    async def extract_text(self, file_path: str, format: str) -> str:
        """Extract text from document"""
        pass

    async def chunk_document(
        self,
        text: str,
        strategy: ChunkingStrategy
    ) -> List[Chunk]:
        """Chunk document using specified strategy"""
        pass

# EmbeddingService generates embeddings
class EmbeddingService:
    async def generate_embeddings(
        self,
        texts: List[str],
        provider: str = "openai"
    ) -> List[List[float]]:
        """Generate embeddings for texts"""
        pass

    async def batch_embed(
        self,
        chunks: List[Chunk],
        batch_size: int = 100
    ) -> List[Vector]:
        """Batch embed chunks"""
        pass

# VectorSearchService performs similarity search
class VectorSearchService:
    async def search(
        self,
        query_vector: List[float],
        tenant_id: UUID,
        top_k: int = 10,
        threshold: float = 0.7
    ) -> List[SearchResult]:
        """Semantic search using vector similarity"""
        pass

    async def hybrid_search(
        self,
        query_text: str,
        query_vector: List[float],
        tenant_id: UUID,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[SearchResult]:
        """Hybrid search combining semantic and keyword"""
        pass
```

#### Configuration

```python
# config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    workers: int = 4

    # Database
    database_url: str
    vector_dimensions: int = 1536  # OpenAI ada-002

    # Embedding Providers
    openai_api_key: str
    cohere_api_key: str
    huggingface_api_key: str
    default_embedding_provider: str = "openai"

    # Document Processing
    max_file_size_mb: int = 100
    supported_formats: List[str] = ["pdf", "docx", "txt", "html", "md"]

    # Chunking
    default_chunk_size: int = 512
    default_chunk_overlap: int = 50
    max_chunk_size: int = 2048

    # Vector Search
    default_top_k: int = 10
    default_similarity_threshold: float = 0.7
    use_hnsw_index: bool = True
    hnsw_ef_construction: int = 200
    hnsw_m: int = 16

    # Cache
    redis_url: str
    cache_ttl_seconds: int = 3600

    # Performance
    embedding_batch_size: int = 100
    max_concurrent_embeddings: int = 10

    class Config:
        env_file = ".env"
```

#### API Endpoints

```
# Health
GET  /health                        # Health check
GET  /ready                         # Readiness check

# Documents
POST /documents                     # Upload document
GET  /documents                     # List documents
GET  /documents/:id                 # Get document
DELETE /documents/:id               # Delete document
POST /documents/:id/reprocess       # Reprocess document

# Search
POST /search                        # Semantic search
POST /search/hybrid                 # Hybrid search
POST /search/similar                # Find similar documents

# Embeddings
POST /embeddings                    # Generate embeddings
GET  /embeddings/providers          # List providers

# Configuration
GET  /config/chunking               # Get chunking config
PUT  /config/chunking               # Update chunking config
GET  /config/embedding              # Get embedding config
PUT  /config/embedding              # Update embedding config
```

---

### 3. LLM Gateway Service (Go)

**Purpose:** LLM provider abstraction layer with routing, token management, prompt building, response caching, and fallback logic.

#### Responsibilities

- Multi-provider LLM integration (OpenAI, Anthropic, Google, AWS Bedrock)
- Provider-agnostic API abstraction
- Token usage tracking and budget enforcement
- Prompt template management
- RAG context injection
- Response caching for cost optimization
- Provider fallback and retry logic
- Streaming response support
- Rate limiting per provider

#### Technology Stack

```go
// Core Technologies
- Language: Go 1.21+
- HTTP Framework: chi router v5
- Provider SDKs: openai-go, anthropic-go, google-cloud-go
- Caching: go-redis/v9
- Streaming: Server-Sent Events (SSE)
- Metrics: Prometheus client_golang

// Key Dependencies
- pgx/v5: PostgreSQL driver
- go-redis/v9: Redis client
- zap: Structured logging
- validator/v10: Request validation
- tiktoken-go: Token counting
```

#### Component Structure

```
services/llm-gateway/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── domain/
│   │   ├── models/
│   │   │   ├── query.go
│   │   │   ├── provider.go
│   │   │   └── response.go
│   │   └── services/
│   │       ├── llm_service.go
│   │       ├── prompt_service.go
│   │       ├── token_service.go
│   │       └── cache_service.go
│   ├── infrastructure/
│   │   ├── providers/
│   │   │   ├── openai.go
│   │   │   ├── anthropic.go
│   │   │   ├── google.go
│   │   │   ├── bedrock.go
│   │   │   └── factory.go
│   │   ├── http/
│   │   │   ├── server.go
│   │   │   ├── routes.go
│   │   │   └── handlers/
│   │   │       ├── query_handler.go
│   │   │       └── stream_handler.go
│   │   └── cache/
│   │       └── response_cache.go
│   └── config/
│       └── config.go
└── tests/
```

#### Key Interfaces

```go
// LLMProvider interface for provider abstraction
type LLMProvider interface {
    Query(ctx context.Context, req *QueryRequest) (*QueryResponse, error)
    StreamQuery(ctx context.Context, req *QueryRequest) (<-chan *StreamChunk, error)
    CountTokens(ctx context.Context, text string) (int, error)
    GetModelInfo(ctx context.Context, model string) (*ModelInfo, error)
}

// PromptBuilder constructs prompts with RAG context
type PromptBuilder interface {
    BuildPrompt(ctx context.Context, req *PromptRequest) (string, error)
    InjectContext(prompt string, context []string) string
    ApplyTemplate(template string, vars map[string]interface{}) (string, error)
}

// TokenManager tracks and enforces token budgets
type TokenManager interface {
    TrackUsage(ctx context.Context, tenantID uuid.UUID, usage *TokenUsage) error
    CheckBudget(ctx context.Context, tenantID uuid.UUID) (*Budget, error)
    EnforceBudget(ctx context.Context, tenantID uuid.UUID, estimatedTokens int) error
}

// ResponseCache caches LLM responses
type ResponseCache interface {
    Get(ctx context.Context, key string) (*QueryResponse, error)
    Set(ctx context.Context, key string, response *QueryResponse, ttl time.Duration) error
    Invalidate(ctx context.Context, pattern string) error
}
```

#### Configuration

```yaml
# config/llm-gateway.yaml
server:
  host: "0.0.0.0"
  port: 8002
  read_timeout: 30s
  write_timeout: 120s  # Longer for streaming

providers:
  openai:
    enabled: true
    api_key: ${OPENAI_API_KEY}
    base_url: https://api.openai.com/v1
    models:
      - gpt-4-turbo
      - gpt-3.5-turbo
    default_model: gpt-4-turbo
    max_tokens: 4096
    temperature: 0.7
    timeout: 60s
    rate_limit: 60  # requests per minute

  anthropic:
    enabled: true
    api_key: ${ANTHROPIC_API_KEY}
    models:
      - claude-3-opus
      - claude-3-sonnet
    default_model: claude-3-sonnet
    max_tokens: 4096
    temperature: 0.7
    timeout: 60s

  google:
    enabled: false
    project_id: ${GOOGLE_PROJECT_ID}
    location: us-central1
    models:
      - gemini-pro

  bedrock:
    enabled: false
    region: us-east-1
    models:
      - anthropic.claude-v2

routing:
  default_provider: openai
  fallback_providers:
    - anthropic
    - google
  retry_attempts: 3
  retry_delay: 2s

token_management:
  enabled: true
  default_monthly_budget: 1000000  # tokens
  budget_warning_threshold: 0.8
  budget_enforcement: true

caching:
  enabled: true
  ttl: 3600s  # 1 hour
  max_cache_size_mb: 1000

rag:
  max_context_length: 8000  # tokens
  context_window_overlap: 200
  include_citations: true
```

#### API Endpoints

```
# Health
GET  /health
GET  /ready

# Queries
POST /queries                       # RAG query
POST /queries/stream                # Streaming query
GET  /queries/:id                   # Get query result
GET  /queries                       # List queries

# Providers
GET  /providers                     # List available providers
GET  /providers/:name/models        # List provider models
POST /providers/:name/test          # Test provider connection

# Token Management
GET  /tokens/usage                  # Get usage stats
GET  /tokens/budget                 # Get budget info
PUT  /tokens/budget                 # Update budget

# Cache
DELETE /cache                       # Clear cache
GET  /cache/stats                   # Cache statistics
```

---

### 4. DLP Service (Python)

**Purpose:** Data Loss Prevention service for PII detection, redaction, tokenization, and risk assessment.

#### Responsibilities

- PII detection using pattern matching and NLP
- Entity recognition (SSN, credit cards, emails, phones, addresses, names)
- Redaction strategies (mask, hash, tokenize, remove)
- Reversible tokenization for authorized access
- Custom pattern engine for domain-specific data
- Risk scoring and classification
- Compliance-specific rules (GDPR, HIPAA, PCI-DSS)
- Audit logging of all detections

#### Technology Stack

```python
# Core Technologies
- Language: Python 3.11+
- Framework: FastAPI
- PII Detection: Presidio (Microsoft)
- NLP: spaCy, transformers
- Pattern Matching: regex, phonenumbers
- Tokenization: cryptography (Fernet)
- Database: asyncpg

# Key Dependencies
- presidio-analyzer: PII detection
- presidio-anonymizer: PII anonymization
- spacy: NLP
- transformers: NER models
- cryptography: Encryption
- pydantic: Data validation
```

#### Component Structure

```
services/dlp/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── models/
│   │   ├── scan.py
│   │   ├── pattern.py
│   │   └── result.py
│   ├── services/
│   │   ├── detection_service.py
│   │   ├── redaction_service.py
│   │   ├── tokenization_service.py
│   │   ├── pattern_engine.py
│   │   └── risk_scoring_service.py
│   ├── analyzers/
│   │   ├── ssn_analyzer.py
│   │   ├── credit_card_analyzer.py
│   │   ├── email_analyzer.py
│   │   └── custom_analyzer.py
│   ├── routes/
│   │   ├── scan.py
│   │   ├── patterns.py
│   │   └── health.py
│   └── utils/
│       ├── encryption.py
│       └── validation.py
└── tests/
```

#### Key Classes

```python
# DetectionService handles PII detection
class DetectionService:
    async def scan_text(
        self,
        text: str,
        tenant_id: UUID,
        entities: List[str] = None
    ) -> ScanResult:
        """Scan text for PII entities"""
        pass

    async def batch_scan(
        self,
        texts: List[str],
        tenant_id: UUID
    ) -> List[ScanResult]:
        """Batch scan multiple texts"""
        pass

    async def analyze_risk(
        self,
        scan_result: ScanResult
    ) -> RiskAssessment:
        """Assess risk level of detected PII"""
        pass

# RedactionService handles PII redaction
class RedactionService:
    async def redact(
        self,
        text: str,
        entities: List[DetectedEntity],
        strategy: RedactionStrategy = RedactionStrategy.MASK
    ) -> str:
        """Redact PII from text"""
        pass

    async def mask_entities(
        self,
        text: str,
        entities: List[DetectedEntity]
    ) -> str:
        """Mask entities with asterisks"""
        pass

    async def hash_entities(
        self,
        text: str,
        entities: List[DetectedEntity]
    ) -> str:
        """Hash entities with SHA-256"""
        pass

# TokenizationService handles reversible tokenization
class TokenizationService:
    async def tokenize(
        self,
        value: str,
        tenant_id: UUID
    ) -> str:
        """Tokenize sensitive value"""
        pass

    async def detokenize(
        self,
        token: str,
        tenant_id: UUID,
        requester_id: UUID
    ) -> Optional[str]:
        """Detokenize value (requires authorization)"""
        pass

# PatternEngine manages custom patterns
class PatternEngine:
    async def add_pattern(
        self,
        pattern: CustomPattern,
        tenant_id: UUID
    ) -> UUID:
        """Add custom detection pattern"""
        pass

    async def test_pattern(
        self,
        pattern: CustomPattern,
        test_text: str
    ) -> List[Match]:
        """Test pattern against sample text"""
        pass
```

#### Configuration

```python
# config.py
class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8003

    # Detection
    default_entities: List[str] = [
        "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER",
        "CREDIT_CARD", "US_SSN", "US_PASSPORT",
        "IP_ADDRESS", "IBAN_CODE", "CRYPTO"
    ]
    confidence_threshold: float = 0.7
    use_ml_models: bool = True

    # Redaction
    default_strategy: str = "mask"
    mask_character: str = "*"
    preserve_length: bool = True

    # Tokenization
    encryption_key: str  # Fernet key
    token_prefix: str = "TKN_"
    token_expiry_days: int = 365

    # Risk Scoring
    risk_factors: Dict[str, float] = {
        "CREDIT_CARD": 1.0,
        "US_SSN": 1.0,
        "PHONE_NUMBER": 0.5,
        "EMAIL_ADDRESS": 0.3
    }

    # Performance
    max_text_length: int = 1000000  # 1MB
    batch_size: int = 100

    # Models
    spacy_model: str = "en_core_web_lg"
    ner_model: str = "dslim/bert-base-NER"

    class Config:
        env_file = ".env"
```

#### API Endpoints

```
# Health
GET  /health
GET  /ready

# Scanning
POST /scan                          # Scan text
POST /scan/batch                    # Batch scan
POST /scan/document                 # Scan document

# Redaction
POST /redact                        # Redact PII
POST /redact/preview                # Preview redaction

# Tokenization
POST /tokenize                      # Tokenize value
POST /detokenize                    # Detokenize value

# Patterns
GET  /patterns                      # List patterns
POST /patterns                      # Create custom pattern
PUT  /patterns/:id                  # Update pattern
DELETE /patterns/:id                # Delete pattern
POST /patterns/test                 # Test pattern

# Risk Assessment
POST /assess                        # Assess risk
GET  /risk/entities                 # Entity risk scores
```

---

## Data Architecture

### Database Schema Design

#### Core Tables

```sql
-- Tenants table (multi-tenancy)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',

    -- Resource limits
    max_users INTEGER DEFAULT 10,
    max_documents INTEGER DEFAULT 1000,
    max_storage_gb INTEGER DEFAULT 100,
    monthly_token_budget INTEGER DEFAULT 1000000,

    -- Compliance
    data_residency VARCHAR(10),  -- US, EU, UK
    compliance_frameworks TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',  -- admin, user, viewer
    status VARCHAR(50) DEFAULT 'active',  -- active, suspended, locked

    -- MFA
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    mfa_backup_codes TEXT[],

    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip INET,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,

    CONSTRAINT users_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see users in their tenant
CREATE POLICY tenant_isolation ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Document info
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    file_size_bytes BIGINT,
    storage_path TEXT,  -- R2 or local path
    checksum VARCHAR(64),  -- SHA-256

    -- Processing
    status VARCHAR(50) DEFAULT 'uploaded',  -- uploaded, processing, completed, failed
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    error_message TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',

    -- Classification
    classification VARCHAR(50),  -- public, internal, confidential, restricted
    contains_pii BOOLEAN DEFAULT FALSE,
    dlp_risk_score NUMERIC(3,2),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Document chunks table (for RAG)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Chunk info
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,

    -- Vector embedding
    embedding vector(1536),  -- pgvector extension
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_tenant ON document_chunks(tenant_id);

-- Vector similarity search index (HNSW)
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Queries table (RAG queries)
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Query info
    query_text TEXT NOT NULL,
    query_vector vector(1536),

    -- Context
    retrieved_chunks UUID[],  -- Array of chunk IDs
    context_token_count INTEGER,

    -- LLM
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    prompt TEXT,
    response TEXT,

    -- Usage
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd NUMERIC(10,6),

    -- Performance
    retrieval_latency_ms INTEGER,
    llm_latency_ms INTEGER,
    total_latency_ms INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_queries_tenant ON queries(tenant_id);
CREATE INDEX idx_queries_user ON queries(user_id);
CREATE INDEX idx_queries_created ON queries(created_at DESC);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

-- Token usage table
CREATE TABLE token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Provider
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,

    -- Usage
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost_usd NUMERIC(10,6),

    -- Reference
    query_id UUID REFERENCES queries(id) ON DELETE SET NULL,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_usage_tenant ON token_usage(tenant_id);
CREATE INDEX idx_token_usage_user ON token_usage(user_id);
CREATE INDEX idx_token_usage_created ON token_usage(created_at DESC);

-- Partition by month for performance
CREATE TABLE token_usage_y2026m01 PARTITION OF token_usage
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- DLP scans table
CREATE TABLE dlp_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Scan info
    content_hash VARCHAR(64),  -- SHA-256 of content
    content_preview TEXT,  -- First 500 chars

    -- Results
    entities_found JSONB DEFAULT '[]',  -- Array of detected entities
    risk_score NUMERIC(3,2),
    risk_level VARCHAR(20),  -- low, medium, high, critical

    -- Action taken
    redaction_applied BOOLEAN DEFAULT FALSE,
    redaction_strategy VARCHAR(50),

    -- Reference
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    query_id UUID REFERENCES queries(id) ON DELETE SET NULL,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dlp_scans_tenant ON dlp_scans(tenant_id);
CREATE INDEX idx_dlp_scans_risk ON dlp_scans(risk_level);
CREATE INDEX idx_dlp_scans_created ON dlp_scans(created_at DESC);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event
    event_type VARCHAR(100) NOT NULL,  -- auth.login, document.upload, etc.
    action VARCHAR(50) NOT NULL,  -- create, read, update, delete
    resource_type VARCHAR(100),
    resource_id UUID,

    -- Details
    ip_address INET,
    user_agent TEXT,
    request_id UUID,

    -- Result
    status VARCHAR(20),  -- success, failure
    error_message TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Compliance
    compliance_tags TEXT[] DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Partition by month for performance
CREATE TABLE audit_logs_y2026m01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Key info
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(20),  -- First 8 chars for identification

    -- Permissions
    scopes TEXT[] DEFAULT '{}',

    -- Limits
    rate_limit INTEGER DEFAULT 1000,  -- per hour

    -- Status
    status VARCHAR(50) DEFAULT 'active',
    last_used_at TIMESTAMP,

    -- Expiry
    expires_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- Policies table (OPA policies)
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    -- Policy info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy_type VARCHAR(50) NOT NULL,  -- access, data, compliance

    -- Content
    policy_rego TEXT NOT NULL,  -- OPA Rego code
    policy_version INTEGER DEFAULT 1,

    -- Status
    status VARCHAR(50) DEFAULT 'draft',  -- draft, active, archived

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Compliance
    compliance_framework VARCHAR(50),  -- GDPR, HIPAA, PCI-DSS

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_type ON policies(policy_type);
CREATE INDEX idx_policies_status ON policies(status);
```

### Vector Search Functions

```sql
-- Function: Semantic search with RLS
CREATE OR REPLACE FUNCTION search_documents_with_vector(
    query_vector vector(1536),
    tenant_id_param UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.document_id,
        dc.content,
        1 - (dc.embedding <=> query_vector) AS similarity,
        dc.metadata
    FROM document_chunks dc
    INNER JOIN documents d ON dc.document_id = d.id
    WHERE
        dc.tenant_id = tenant_id_param
        AND d.status = 'completed'
        AND d.deleted_at IS NULL
        AND (1 - (dc.embedding <=> query_vector)) >= similarity_threshold
    ORDER BY dc.embedding <=> query_vector
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Hybrid search (semantic + keyword)
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_text TEXT,
    query_vector vector(1536),
    tenant_id_param UUID,
    semantic_weight FLOAT DEFAULT 0.7,
    keyword_weight FLOAT DEFAULT 0.3,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    semantic_score FLOAT,
    keyword_score FLOAT,
    combined_score FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH semantic AS (
        SELECT
            dc.id AS chunk_id,
            dc.document_id,
            dc.content,
            dc.metadata,
            1 - (dc.embedding <=> query_vector) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON dc.document_id = d.id
        WHERE
            dc.tenant_id = tenant_id_param
            AND d.status = 'completed'
            AND d.deleted_at IS NULL
    ),
    keyword AS (
        SELECT
            dc.id AS chunk_id,
            ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', query_text)) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON dc.document_id = d.id
        WHERE
            dc.tenant_id = tenant_id_param
            AND d.status = 'completed'
            AND d.deleted_at IS NULL
            AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        s.chunk_id,
        s.document_id,
        s.content,
        s.score AS semantic_score,
        COALESCE(k.score, 0) AS keyword_score,
        (s.score * semantic_weight + COALESCE(k.score, 0) * keyword_weight) AS combined_score,
        s.metadata
    FROM semantic s
    LEFT JOIN keyword k ON s.chunk_id = k.chunk_id
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## API Design

### REST API Conventions

#### HTTP Methods

- `GET` - Retrieve resources (idempotent, cacheable)
- `POST` - Create resources or perform actions
- `PUT` - Update entire resource (idempotent)
- `PATCH` - Partial update (idempotent)
- `DELETE` - Remove resource (idempotent)

#### Status Codes

```
2xx Success
200 OK                  - Request succeeded
201 Created             - Resource created
202 Accepted            - Async operation started
204 No Content          - Success with no response body

4xx Client Errors
400 Bad Request         - Invalid request syntax
401 Unauthorized        - Missing or invalid authentication
403 Forbidden           - Authenticated but not authorized
404 Not Found           - Resource doesn't exist
409 Conflict            - Resource conflict (duplicate)
422 Unprocessable       - Validation error
429 Too Many Requests   - Rate limit exceeded

5xx Server Errors
500 Internal Server     - Unexpected server error
502 Bad Gateway         - Upstream service error
503 Service Unavailable - Service temporarily down
504 Gateway Timeout     - Upstream timeout
```

#### Request/Response Format

**Request Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>
X-Tenant-ID: <uuid>  (optional, extracted from JWT)
```

**Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "request_id": "uuid",
    "timestamp": "2026-01-10T12:00:00Z",
    "version": "v1"
  }
}
```

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "metadata": {
    "request_id": "uuid",
    "timestamp": "2026-01-10T12:00:00Z"
  }
}
```

### API Versioning

- URL Path versioning: `/api/v1/...`, `/api/v2/...`
- Support N and N-1 versions simultaneously
- Deprecation notices in response headers:
  ```
  X-API-Deprecation: This endpoint is deprecated, use /api/v2/... instead
  X-API-Sunset: 2026-12-31T00:00:00Z
  ```

### Pagination

```
GET /api/v1/documents?page=2&limit=50&sort=-created_at

Response:
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total_items": 1250,
    "total_pages": 25,
    "has_next": true,
    "has_prev": true,
    "next_url": "/api/v1/documents?page=3&limit=50",
    "prev_url": "/api/v1/documents?page=1&limit=50"
  }
}
```

### Filtering & Searching

```
GET /api/v1/documents?status=completed&tags=contract,legal&created_after=2026-01-01

Query Parameters:
- status: filter by status
- tags: filter by tags (comma-separated)
- created_after: filter by date
- search: full-text search
- sort: sort field (prefix with - for descending)
```

### Rate Limiting

Headers:
```
X-RateLimit-Limit: 1000          # Requests per window
X-RateLimit-Remaining: 950       # Remaining requests
X-RateLimit-Reset: 1641024000    # Unix timestamp
Retry-After: 60                  # Seconds until retry (when 429)
```

---

## Security Architecture

### Zero-Trust Security Model

```
┌───────────────────────────────────────────────────────────┐
│                    Security Layers                         │
├───────────────────────────────────────────────────────────┤
│ Layer 1: Network Security                                  │
│ • TLS 1.3 encryption                                       │
│ • DDoS protection (Cloudflare)                            │
│ • WAF rules                                                │
│ • IP allowlist/blocklist                                   │
├───────────────────────────────────────────────────────────┤
│ Layer 2: Authentication                                    │
│ • JWT with RSA-256 signatures                              │
│ • Token expiration (1h access, 30d refresh)               │
│ • Token blacklist on logout                                │
│ • MFA (TOTP, SMS, Email)                                   │
│ • Device fingerprinting                                    │
├───────────────────────────────────────────────────────────┤
│ Layer 3: Authorization                                     │
│ • Role-Based Access Control (RBAC)                        │
│ • Attribute-Based Access Control (ABAC) via OPA           │
│ • Policy-as-Code (Rego)                                    │
│ • Tenant isolation (RLS)                                   │
├───────────────────────────────────────────────────────────┤
│ Layer 4: Data Protection                                   │
│ • Encryption at rest (AES-256-GCM)                        │
│ • Encryption in transit (TLS 1.3)                         │
│ • PII detection and redaction (DLP)                        │
│ • Tenant-specific encryption keys                          │
├───────────────────────────────────────────────────────────┤
│ Layer 5: Audit & Monitoring                                │
│ • Comprehensive audit logging                              │
│ • Real-time security monitoring                            │
│ • Anomaly detection                                        │
│ • Compliance reporting                                     │
└───────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌────────┐                                    ┌────────────┐
│ Client │                                    │  Gateway   │
└────┬───┘                                    └─────┬──────┘
     │                                              │
     │  1. POST /auth/login                        │
     │  { email, password }                        │
     ├─────────────────────────────────────────────►
     │                                              │
     │                                              │  2. Validate credentials
     │                                              │     Hash password (Argon2)
     │                                              │     Check against DB
     │                                              │
     │                                              │  3. Generate JWT
     │                                              │     Sign with RSA private key
     │                                              │     Include: user_id, tenant_id,
     │                                              │              role, permissions
     │                                              │
     │  4. Return tokens                           │
     │  { access_token, refresh_token }            │
     ◄─────────────────────────────────────────────┤
     │                                              │
     │                                              │
     │  5. Authenticated request                   │
     │  Authorization: Bearer <access_token>       │
     ├─────────────────────────────────────────────►
     │                                              │
     │                                              │  6. Validate JWT
     │                                              │     Verify signature
     │                                              │     Check expiration
     │                                              │     Check blacklist
     │                                              │
     │                                              │  7. Extract context
     │                                              │     user_id, tenant_id,
     │                                              │     role, permissions
     │                                              │
     │                                              │  8. Evaluate policy
     │                                              │     OPA policy check
     │                                              │
     │                                              │  9. Route request
     │                                              │     to service
     │                                              │
     │  10. Response                                │
     ◄─────────────────────────────────────────────┤
```

### Encryption Strategy

**At Rest:**
```
┌─────────────────────────────────────────────┐
│  Application Layer Encryption               │
│  • PII fields: AES-256-GCM                  │
│  • Tenant-specific keys in KMS             │
│  • Key rotation every 90 days              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Database Encryption                        │
│  • PostgreSQL TDE (Transparent)            │
│  • Encrypted backups                        │
│  • Encrypted WAL files                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Storage Encryption                         │
│  • R2 server-side encryption               │
│  • Volume encryption (LUKS)                │
└─────────────────────────────────────────────┘
```

**In Transit:**
```
All connections use TLS 1.3:
• Client ↔ Edge (Cloudflare)
• Edge ↔ Gateway
• Gateway ↔ Services (mTLS)
• Services ↔ Database (TLS)
• Services ↔ Redis (TLS)
• Services ↔ External APIs (TLS)
```

### Policy-Based Authorization (OPA)

**Example Policy (Rego):**
```rego
package sdlc.authz

# Allow if user is admin
allow {
    input.user.role == "admin"
}

# Allow document access if user owns it or is in same tenant
allow {
    input.resource.type == "document"
    input.action == "read"
    input.resource.tenant_id == input.user.tenant_id
}

# Allow document modification only if user owns it
allow {
    input.resource.type == "document"
    input.action in ["update", "delete"]
    input.resource.user_id == input.user.id
}

# Deny PII access unless user has data_access permission
deny {
    input.resource.contains_pii == true
    not has_permission(input.user, "data.pii.access")
}

# Helper function
has_permission(user, permission) {
    user.permissions[_] == permission
}
```

---

## Deployment Architecture

### Multi-Environment Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Development                           │
│  • Local Docker Compose                                 │
│  • Hot reload enabled                                   │
│  • Debug logging                                        │
│  • Sample data seeding                                  │
│  • No security constraints                              │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│                    Staging                              │
│  • Kubernetes cluster (single region)                  │
│  • Production-like configuration                        │
│  • 10% production data volume                          │
│  • Automated testing                                    │
│  • Manual QA validation                                │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│                   Production                            │
│  • Multi-region Kubernetes                             │
│  • Blue-green deployment                                │
│  • Auto-scaling                                         │
│  • Full monitoring & alerting                          │
│  • 99.9% SLA                                            │
└────────────────────────────────────────────────────────┘
```

### Cloudflare Workers Deployment

```
┌─────────────────────────────────────────────┐
│        Cloudflare Global Network             │
│  ┌─────────────────────────────────────┐    │
│  │  Edge Locations (300+)              │    │
│  │  • Workers (serverless functions)   │    │
│  │  • KV (key-value store)             │    │
│  │  • R2 (object storage)              │    │
│  │  • D1 (SQL database)                │    │
│  │  • Vectorize (vector DB)            │    │
│  │  • Queues (async jobs)              │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         Origin Servers (Fallback)            │
│  • API Gateway (Go)                         │
│  • RAG Service (Python)                     │
│  • LLM Gateway (Go)                         │
│  • DLP Service (Python)                     │
└─────────────────────────────────────────────┘
```

### Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf

# Cloudflare Workers
resource "cloudflare_worker_script" "gateway" {
  name    = "sdlc-gateway-${var.environment}"
  content = file("../dist/gateway.js")

  kv_namespace_binding {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.cache.id
  }

  r2_bucket_binding {
    name        = "DOCUMENTS"
    bucket_name = cloudflare_r2_bucket.documents.name
  }

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }

  secret_text_binding {
    name = "JWT_SECRET"
    text = var.jwt_secret
  }
}

# D1 Database
resource "cloudflare_d1_database" "main" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-db-${var.environment}"
}

# R2 Buckets
resource "cloudflare_r2_bucket" "documents" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-documents-${var.environment}"
  location   = var.region
}

resource "cloudflare_r2_bucket" "embeddings" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-embeddings-${var.environment}"
  location   = var.region
}

# KV Namespaces
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "sdlc-cache-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "sdlc-sessions-${var.environment}"
}

# Vectorize Index
resource "cloudflare_vectorize_index" "embeddings" {
  account_id  = var.cloudflare_account_id
  name        = "sdlc-vectors-${var.environment}"
  dimensions  = 1536  # OpenAI ada-002
  metric      = "cosine"
  description = "Document embeddings for RAG"
}

# Queue
resource "cloudflare_queue" "document_processing" {
  account_id = var.cloudflare_account_id
  name       = "sdlc-doc-processing-${var.environment}"
}
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run unit tests
        run: |
          make test-go
          make test-python
          make test-rust

      - name: Run integration tests
        run: make test-integration

      - name: Security scan
        run: |
          make security-scan-go
          make security-scan-python

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Gateway
        run: cd services/gateway && go build -o dist/gateway

      - name: Build RAG Service
        run: cd services/rag && docker build -t rag:${{ github.sha }}

      - name: Build LLM Gateway
        run: cd services/llm-gateway && go build -o dist/llm-gateway

      - name: Build DLP Service
        run: cd services/dlp && docker build -t dlp:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Cloudflare Workers
        run: wrangler deploy --env staging

      - name: Run smoke tests
        run: make smoke-test-staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Blue-Green Deployment
        run: |
          # Deploy to green environment
          wrangler deploy --env production-green

          # Run health checks
          make health-check-production-green

          # Switch traffic to green
          wrangler routes update --env production-green

          # Monitor for 10 minutes
          sleep 600

          # Check error rate
          ERROR_RATE=$(make check-error-rate)
          if [ $ERROR_RATE -gt 1 ]; then
            echo "Error rate too high, rolling back"
            wrangler routes update --env production-blue
            exit 1
          fi

          echo "Deployment successful"
```

---

## Monitoring & Observability

### Metrics Collection

**Prometheus Metrics:**
```go
// HTTP metrics
var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
        },
        []string{"method", "endpoint"},
    )

    // Business metrics
    documentsUploaded = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "documents_uploaded_total",
            Help: "Total number of documents uploaded",
        },
        []string{"tenant_id", "format"},
    )

    ragQueriesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rag_queries_total",
            Help: "Total number of RAG queries",
        },
        []string{"tenant_id", "provider", "model"},
    )

    tokenUsageTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "token_usage_total",
            Help: "Total tokens used",
        },
        []string{"tenant_id", "provider", "model", "type"},  // type: input/output
    )

    dlpScansTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "dlp_scans_total",
            Help: "Total DLP scans performed",
        },
        []string{"tenant_id", "risk_level"},
    )
)
```

### Logging Strategy

**Structured Logging (JSON):**
```json
{
  "timestamp": "2026-01-10T12:00:00.000Z",
  "level": "info",
  "service": "gateway",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440002",
  "method": "POST",
  "path": "/api/v1/documents",
  "status": 201,
  "latency_ms": 245,
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "message": "Document uploaded successfully",
  "metadata": {
    "document_id": "550e8400-e29b-41d4-a716-446655440003",
    "filename": "contract.pdf",
    "size_bytes": 1048576
  }
}
```

### Distributed Tracing

**OpenTelemetry Spans:**
```
Trace: POST /api/v1/queries (total: 2847ms)
  ├─ Span: gateway.authenticate (12ms)
  │  ├─ Span: jwt.validate (8ms)
  │  └─ Span: redis.check_blacklist (3ms)
  │
  ├─ Span: gateway.authorize (15ms)
  │  └─ Span: opa.evaluate_policy (14ms)
  │
  ├─ Span: rag.search (523ms)
  │  ├─ Span: embedding.generate (145ms)
  │  │  └─ Span: openai.create_embedding (140ms)
  │  │
  │  └─ Span: vector_search.query (375ms)
  │     ├─ Span: postgres.vector_search (350ms)
  │     └─ Span: postprocess_results (22ms)
  │
  ├─ Span: dlp.scan (287ms)
  │  ├─ Span: presidio.analyze (245ms)
  │  └─ Span: redact_pii (40ms)
  │
  └─ Span: llm.query (2005ms)
     ├─ Span: prompt.build (12ms)
     ├─ Span: openai.chat_completion (1985ms)
     └─ Span: response.parse (8ms)
```

### Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: availability
    interval: 30s
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.endpoint }}"

  - name: performance
    interval: 30s
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency (p95 > 1s) on {{ $labels.endpoint }}"

      - alert: SlowVectorSearch
        expr: histogram_quantile(0.95, rate(vector_search_duration_seconds_bucket[5m])) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow vector search (p95 > 500ms)"

  - name: business
    interval: 1m
    rules:
      - alert: TokenBudgetExceeded
        expr: token_usage_total > ignoring(type) tenant_token_budget
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} exceeded token budget"

      - alert: HighPIIDetectionRate
        expr: rate(dlp_scans_total{risk_level=~"high|critical"}[1h]) > 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High PII detection rate for tenant {{ $labels.tenant_id }}"
```

### Grafana Dashboards

**1. System Overview Dashboard**
- Service health status (up/down indicators)
- Request rate (requests/sec)
- Error rate (errors/sec)
- Latency (p50, p95, p99)
- Resource utilization (CPU, memory, disk)

**2. RAG Performance Dashboard**
- Document processing rate
- Embedding generation latency
- Vector search latency
- Query success rate
- Top queries by latency

**3. LLM Usage Dashboard**
- Queries per provider
- Token usage (input/output)
- Cost per tenant
- Token budget utilization
- Provider latency comparison

**4. Security Dashboard**
- Authentication attempts (success/failure)
- Failed login rate
- Account lockouts
- DLP scan results
- High-risk entity detections
- Policy violations

**5. Business Metrics Dashboard**
- Active tenants
- Active users
- Documents uploaded (per tenant)
- Queries executed (per tenant)
- Storage used (per tenant)
- API key usage

---

## Implementation Guidelines

### Development Workflow

1. **Setup Development Environment**
   ```bash
   # Clone repository
   git clone https://github.com/sdlc-ai/platform.git
   cd platform

   # Copy environment template
   cp .env.example .env
   # Edit .env with your credentials

   # Start infrastructure
   docker-compose -f .config/docker/docker-compose.dev.yml up -d

   # Run database migrations
   make migrate-up

   # Seed development data
   make seed-dev

   # Start all services
   npm run dev
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/add-hybrid-search
   ```

3. **Implement Feature with TDD**
   ```bash
   # Write tests first
   # services/rag/tests/test_hybrid_search.py

   # Run tests (should fail)
   make test-rag

   # Implement feature
   # services/rag/app/services/hybrid_search_service.py

   # Run tests (should pass)
   make test-rag
   ```

4. **Run Linting and Security Scans**
   ```bash
   make lint
   make security-scan
   ```

5. **Commit with Conventional Commits**
   ```bash
   git commit -m "feat(rag): add hybrid search combining semantic and keyword"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/add-hybrid-search
   # Create PR in GitHub with description and testing notes
   ```

7. **Code Review and Merge**
   - Automated CI checks run
   - Peer review and approval
   - Merge to main triggers deployment to staging

### Code Style Guidelines

**Go:**
```go
// Use gofmt, golangci-lint
// Follow Effective Go guidelines
// Use meaningful variable names
// Add comments for exported functions

// Good
func (s *DocumentService) UploadDocument(ctx context.Context, req *UploadRequest) (*Document, error) {
    // Validate request
    if err := req.Validate(); err != nil {
        return nil, fmt.Errorf("invalid request: %w", err)
    }

    // Business logic...
}

// Bad
func Upload(r *Request) (*Doc, error) {
    // ...
}
```

**Python:**
```python
# Use black, ruff, mypy
# Follow PEP 8
# Type hints required
# Docstrings for public functions

# Good
async def upload_document(
    file: UploadFile,
    tenant_id: UUID,
    metadata: Dict[str, Any]
) -> Document:
    """
    Upload and process a document.

    Args:
        file: The file to upload
        tenant_id: The tenant ID
        metadata: Additional metadata

    Returns:
        The created document

    Raises:
        ValueError: If file is invalid
        DocumentProcessingError: If processing fails
    """
    # Implementation...

# Bad
def upload(f, t, m):
    # ...
```

### Testing Strategy

**Unit Tests:**
- Test individual functions and classes in isolation
- Mock external dependencies
- Aim for >80% code coverage
- Fast execution (<5 minutes)

**Integration Tests:**
- Test service interactions
- Use real databases (test database)
- Test API endpoints end-to-end
- Moderate execution time (<15 minutes)

**End-to-End Tests:**
- Test complete user journeys
- Use Playwright or similar
- Run against staging environment
- Slower execution (<30 minutes)

**Performance Tests:**
- Load testing with k6 or Locust
- Test scalability and bottlenecks
- Establish baseline metrics
- Run before major releases

### Error Handling

**Go:**
```go
// Wrap errors with context
func (s *Service) DoSomething(ctx context.Context) error {
    result, err := s.repo.Fetch(ctx)
    if err != nil {
        return fmt.Errorf("failed to fetch data: %w", err)
    }

    // Use error types for specific handling
    if errors.Is(err, ErrNotFound) {
        return ErrResourceNotFound
    }

    return nil
}
```

**Python:**
```python
# Use custom exceptions
class DocumentProcessingError(Exception):
    """Raised when document processing fails"""
    pass

async def process_document(file: UploadFile) -> Document:
    try:
        text = await extract_text(file)
    except ExtractionError as e:
        logger.error(f"Text extraction failed: {e}")
        raise DocumentProcessingError(f"Failed to extract text: {e}") from e
```

### Security Best Practices

1. **Never log sensitive data**
   - Mask PII in logs
   - Redact passwords, API keys, tokens
   - Use structured logging with sensitive field filtering

2. **Validate all inputs**
   - Use validation libraries (validator in Go, pydantic in Python)
   - Whitelist approach (allow known good, deny rest)
   - Sanitize user inputs

3. **Use parameterized queries**
   ```sql
   -- Good
   SELECT * FROM users WHERE email = $1

   -- Bad (SQL injection)
   SELECT * FROM users WHERE email = '{email}'
   ```

4. **Implement rate limiting**
   - Per user, per tenant, per API key
   - Different limits for different endpoints
   - Return 429 with Retry-After header

5. **Audit sensitive operations**
   - Log all authentication attempts
   - Log all data access
   - Log all configuration changes
   - Include request context (user, IP, timestamp)

---

## Technology Stack Details

### Go Services (Gateway, LLM Gateway)

**Dependencies:**
```go
// go.mod
module github.com/sdlc-ai/platform

go 1.21

require (
    github.com/go-chi/chi/v5 v5.0.11
    github.com/go-chi/cors v1.2.1
    github.com/golang-jwt/jwt/v5 v5.2.0
    github.com/jackc/pgx/v5 v5.5.1
    github.com/redis/go-redis/v9 v9.4.0
    github.com/google/uuid v1.5.0
    github.com/open-policy-agent/opa v0.60.0
    go.uber.org/zap v1.26.0
    github.com/prometheus/client_golang v1.18.0
    go.opentelemetry.io/otel v1.21.0
)
```

**Dockerfile:**
```dockerfile
# Multi-stage build
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o gateway cmd/server/main.go

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/

COPY --from=builder /app/gateway .
COPY --from=builder /app/config ./config
COPY --from=builder /app/certs ./certs

EXPOSE 8080
CMD ["./gateway"]
```

### Python Services (RAG, DLP)

**Dependencies:**
```python
# requirements.txt
fastapi==0.108.0
uvicorn[standard]==0.25.0
pydantic==2.5.3
pydantic-settings==2.1.0
asyncpg==0.29.0
redis==5.0.1
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
presidio-analyzer==2.2.354
presidio-anonymizer==2.2.354
spacy==3.7.2
transformers==4.36.2
langchain==0.1.0
tiktoken==0.5.2
openai==1.7.1
cohere==4.37
sentence-transformers==2.2.2
pypdf==3.17.4
python-docx==1.1.0
beautifulsoup4==4.12.2
prometheus-client==0.19.0
opentelemetry-api==1.21.0
```

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_lg

COPY . .

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Database (PostgreSQL + pgvector)

**Docker Compose:**
```yaml
version: '3.8'

services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_DB: sdlc_platform
      POSTGRES_USER: sdlc_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    command: postgres -c max_connections=200 -c shared_buffers=4GB

volumes:
  postgres_data:
```

### Redis (Cache & Session Store)

**Docker Compose:**
```yaml
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Summary

This technical design specification provides a comprehensive blueprint for implementing the SDLC.ai platform. Key takeaways:

1. **Microservices Architecture:** Loosely coupled services (Gateway, RAG, LLM Gateway, DLP) with clear responsibilities
2. **Multi-Tenant by Design:** Tenant isolation at database (RLS), application, and API levels
3. **Security First:** Zero-trust architecture with authentication, authorization, encryption, and audit logging at every layer
4. **Cloud Native:** Designed for Cloudflare Workers with fallback to traditional cloud infrastructure
5. **Observability:** Comprehensive monitoring, logging, and tracing with Prometheus, Grafana, and OpenTelemetry
6. **Developer Experience:** Well-documented APIs, SDKs, and development workflows

### Next Steps

1. **Review and Approve Design:** Stakeholder review of architecture and component designs
2. **Create Implementation Plan:** Break down design into ordered, actionable tasks
3. **Set Up Infrastructure:** Provision cloud resources using Terraform
4. **Implement Core Services:** Build services following specifications
5. **Integration Testing:** Validate service interactions
6. **Security Audit:** External security assessment
7. **Performance Testing:** Load testing and optimization
8. **Production Deployment:** Blue-green deployment to production

Use the next Luna command to generate an implementation plan:
```bash
/luna-plan
```

---

*END OF DESIGN SPECIFICATION*
