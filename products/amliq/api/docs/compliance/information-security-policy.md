# Information Security Policy

**Version**: 1.0 | **Effective**: 2026-04-03 | **Owner**: CISO

## Purpose
Protect the confidentiality, integrity, and availability of AMLIQ systems and customer data.

## Scope
All AMLIQ infrastructure, applications, data, and personnel.

## Data Classification
- **Restricted**: PII, screening results, API keys, encryption keys
- **Confidential**: Customer configurations, billing data, audit logs
- **Internal**: System logs, architecture docs, deployment configs
- **Public**: Marketing site, API documentation, pricing

## Access Control
- Least privilege principle for all access
- MFA required for all administrative access
- API keys scoped per tenant with role-based permissions
- Session tokens: 15-minute access, 7-day refresh with rotation

## Encryption
- **At rest**: AES-256-GCM for PII fields (entity names, DOBs, identifiers)
- **In transit**: TLS 1.3 for all API communications
- **Key management**: Per-tenant encryption keys, master key from environment

## Monitoring
- Security audit logging for all API access (method, path, tenant, IP, status)
- Auth rate limiting: 10 requests/minute per IP, 30-minute lockout
- Alerting on: failed auth spikes, unusual screening volumes, SLA breaches

## Incident Response
See `incident-response-playbook.md`

## Review
This policy is reviewed quarterly and after any security incident.
