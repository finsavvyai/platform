# Access Control Policy

**Version**: 1.0 | **Effective**: 2026-04-03 | **Owner**: CISO

## Principles
- Least privilege: minimum access required for role
- Separation of duties: no single person can deploy + approve
- Defense in depth: multiple layers of access control

## Authentication Methods
| Method | Use Case | Token Lifetime |
|--------|----------|---------------|
| JWT Bearer | Dashboard users | 15 min access + 7 day refresh |
| API Key | Programmatic access | Until revoked |
| OAuth (GitHub/GitLab) | SSO login | Session-based |

## Role-Based Access Control
| Role | Permissions |
|------|------------|
| **Admin** | Full access, config changes, user management |
| **Analyst** | Screen, view alerts, resolve cases, view audit |
| **Viewer** | Read-only access to dashboards and reports |
| **API** | Screening, batch, alerts (scoped by API key) |

## Tenant Isolation
- All data queries filtered by tenant_id
- API keys scoped to single tenant
- Cross-tenant access impossible at database level

## Session Management
- Concurrent session limit: 5 per user (configurable)
- Automatic session expiry after inactivity
- Admin can revoke all sessions for any user
- JWT rotation on every refresh

## Access Reviews
- Quarterly review of all admin accounts
- Immediate revocation on role change or offboarding
- API key audit: unused keys flagged after 90 days

## Monitoring
- All authentication events logged to security audit trail
- Failed login alerts after 5 attempts (30 min lockout)
- Admin actions require additional confirmation
