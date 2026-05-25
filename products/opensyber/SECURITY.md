# Security Policy

OpenSyber is a security-first AI agent hosting platform. We take security issues seriously and appreciate responsible disclosure.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in OpenSyber, please report it privately.

### How to Report

**Email**: security@opensyber.cloud

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact and affected components
- Your suggested fix (optional)
- Whether you'd like public credit

### What to Expect

- **Acknowledgement**: Within 24 hours
- **Initial assessment**: Within 72 hours
- **Status updates**: Weekly until resolved
- **Fix timeline**:
  - Critical: 7 days
  - High: 30 days
  - Medium: 90 days
  - Low: Next release cycle

### Safe Harbor

We will not pursue legal action against researchers who:
- Make a good faith effort to follow this policy
- Avoid privacy violations, data destruction, or service disruption
- Report findings promptly and give us reasonable time to respond
- Do not exploit the vulnerability beyond what is necessary to demonstrate it

## Out of Scope

- Social engineering attacks
- Physical attacks against infrastructure
- Denial of service (DoS) attacks
- Attacks requiring physical access to a user's device
- Issues in third-party dependencies that are already reported upstream
- Missing security headers without a proven exploit

## Security Controls

OpenSyber implements defense in depth:

- **Edge**: Cloudflare Workers with rate limiting (10 req/min on AI endpoints, 100 req/min general)
- **Auth**: Auth.js with HMAC-SHA256 JWT, 4 OAuth providers, optional SAML SSO
- **Session**: TokenForge device-bound ECDSA P-256 sessions (non-extractable keys)
- **Authorization**: Fine-grained RBAC with `requirePermission()` middleware on all routes
- **Input validation**: Zod schemas on all API request bodies and query params
- **Audit logging**: All auth events, admin actions, and sensitive mutations logged via platform-audit
- **Secrets**: Never stored in code, committed files, or CLI arguments (env vars + Cloudflare secrets only)
- **SAST/DAST**: Every PR runs dependency scan, secret scan, and license compliance check
- **Retry safety**: Failed webhook deliveries stored in DLQ with exponential backoff

## Hall of Fame

We publicly credit researchers who report valid vulnerabilities (with their permission).

---

Thank you for helping keep OpenSyber and our users safe.
