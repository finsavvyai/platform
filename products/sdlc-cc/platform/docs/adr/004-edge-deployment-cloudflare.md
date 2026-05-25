# ADR-004: Edge Deployment with Cloudflare

## Status
Accepted

## Date
2025-09-01

## Context
Enterprise customers are globally distributed. API latency must be minimized for real-time interactions. DDoS protection and WAF capabilities are required at the edge.

## Decision
Use Cloudflare's edge infrastructure:
- **Workers**: Edge compute for request routing, authentication token validation, rate limiting
- **R2**: Object storage for document files (S3-compatible, zero egress fees)
- **KV**: Edge key-value store for session data and feature flags
- **WAF**: Web Application Firewall rules for OWASP Top 10 protection
- **DNS**: Cloudflare DNS with health-check-based failover

Origin infrastructure remains on AWS EKS for compute-heavy workloads (RAG processing, vector search).

## Consequences
- **Positive**: Sub-50ms edge latency globally, built-in DDoS protection, reduced origin load
- **Negative**: Cloudflare vendor dependency at edge layer, Workers runtime limitations
- **Mitigations**: Edge logic is thin (routing/auth only), core logic stays provider-agnostic on K8s

## Alternatives Considered
1. **AWS CloudFront + Lambda@Edge** — Higher latency, more complex pricing
2. **Fastly Compute** — Smaller network, Wasm-only runtime
3. **Multi-CDN** — Complexity not justified at current scale
