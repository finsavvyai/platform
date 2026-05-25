# ADR-001: Microservices Architecture

## Status
Accepted

## Date
2025-06-15

## Context
The SDLC platform needs to support multiple programming languages (Go, Python, Rust), different scaling requirements per component, and independent deployment cycles. A monolithic approach would couple the RAG pipeline (Python/ML-heavy) with the API gateway (Go/low-latency) creating deployment and scaling conflicts.

## Decision
Adopt a microservices architecture with the following services:
- **Gateway** (Go) — API routing, authentication, rate limiting, circuit breaking
- **RAG Service** (Python/FastAPI) — Document processing, embedding, vector search, LLM orchestration
- **Vector Core** (Rust) — High-performance vector operations
- **Admin UI** (Node.js) — Management dashboard

Communication: synchronous HTTP/gRPC between gateway and backends, async via Redis pub/sub for document processing.

## Consequences
- **Positive**: Independent scaling, polyglot support, fault isolation, team autonomy
- **Negative**: Distributed system complexity, eventual consistency, network latency, operational overhead
- **Mitigations**: Circuit breakers, structured logging with correlation IDs, centralized monitoring (Prometheus/Grafana), Helm chart for unified deployment

## Alternatives Considered
1. **Monolith** — Simpler but can't leverage language-specific strengths
2. **Modular Monolith** — Good compromise but limits independent scaling
3. **Serverless** — Cold start latency unacceptable for real-time RAG queries
