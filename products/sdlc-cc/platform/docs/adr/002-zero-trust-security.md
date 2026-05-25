# ADR-002: Zero-Trust Security Model

## Status
Accepted

## Date
2025-07-01

## Context
The platform handles sensitive enterprise data (financial, healthcare, legal). Customers require SOC2 Type II, HIPAA, and GDPR compliance. Traditional perimeter-based security is insufficient for a multi-tenant cloud-native platform.

## Decision
Implement zero-trust security throughout the stack:
- **Authentication**: JWT with short-lived access tokens (15 min) + refresh tokens, MFA support
- **Authorization**: OPA (Open Policy Agent) for fine-grained RBAC/ABAC policies
- **Network**: Kubernetes NetworkPolicies with default-deny, mTLS between services
- **Data**: Tenant isolation via PostgreSQL Row-Level Security, encryption at rest (AES-256) and in transit (TLS 1.3)
- **API**: Rate limiting per tenant tier, API key scoping, DLP scanning via Presidio
- **Audit**: Immutable audit log for all data access and mutations

## Consequences
- **Positive**: Compliance-ready, strong tenant isolation, defense-in-depth
- **Negative**: Added latency from policy evaluation, complexity in local development
- **Mitigations**: OPA policy caching, development mode bypasses with feature flags

## Alternatives Considered
1. **Role-based only** — Too coarse for multi-tenant data isolation
2. **Service mesh (Istio)** — Considered but adds significant operational complexity at current scale
