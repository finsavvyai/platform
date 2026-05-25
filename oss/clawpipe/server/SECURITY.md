# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x (latest) | ✅ Active security fixes |
| < 1.0 | ❌ No longer supported |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email us at **security@finsavvyai.com** with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce (proof-of-concept code if available)
3. Affected versions
4. Any suggested mitigations

We will acknowledge receipt within **48 hours** and provide a detailed response within **7 days** including our assessment and planned fix timeline.

If the issue is confirmed, we will:

1. Prepare a fix and release it as a patch version
2. Credit you in the `CHANGELOG.md` (unless you prefer to remain anonymous)
3. Publish a security advisory on GitHub

## Security Baseline

This project enforces the following security controls:

- **Authentication**: Explicit auth modes — `none`, `dev`, `service`, `jwt`. No implicit fallback.
- **Input validation**: All request bodies are size-limited (default 10 MB) and schema-validated.
- **Secrets**: No secrets in source code. All credentials via environment variables only.
- **Dependencies**: Automated vulnerability scanning on every CI run (`pip-audit`).
- **CORS**: Configurable allow-list; wildcard `*` only permitted in development mode.
- **Rate limiting**: Per-IP rate limits enforced at the gateway layer.
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` on all responses.
- **Webhook signatures**: HMAC-SHA256 signature validation required for all inbound webhooks.

## Out of Scope

The following are **not** considered security vulnerabilities for this project:

- Issues requiring physical access to the machine running the service
- Social engineering attacks
- Vulnerabilities in dependencies that are not exploitable in this project's usage
- Rate-limiting bypass via distributed IPs (DoS at scale — report to your cloud provider)

## Disclosure Policy

We follow a **90-day coordinated disclosure** policy. After 90 days from our initial response, you may publish your findings regardless of patch status (though we aim to fix critical issues in under 14 days).
