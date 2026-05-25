# UPM Security Guidelines

This document provides comprehensive security guidelines for deploying and operating UPM.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication](#authentication)
3. [Authorization](#authorization)
4. [Data Protection](#data-protection)
5. [Network Security](#network-security)
6. [Secrets Management](#secrets-management)
7. [Compliance](#compliance)
8. [Security Checklist](#security-checklist)

---

## Security Architecture

### Defense in Depth

UPM implements multiple layers of security:

```
┌─────────────────────────────────────────────────────────────┐
│                      Edge Security                           │
│  - TLS 1.3                                                  │
│  - Web Application Firewall (WAF)                           │
│  - DDoS Protection                                         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Application Security                       │
│  - Authentication (JWT, SSO, LDAP)                          │
│  - Authorization (RBAC)                                     │
│  - Input Validation (Pydantic)                              │
│  - Rate Limiting                                            │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Data Security                           │
│  - Encryption at Rest (Fernet)                              │
│  - Encryption in Transit (TLS)                              │
│  - Secrets Management                                       │
│  - Audit Logging                                            │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Security                     │
│  - Network Policies                                         │
│  - Pod Security Policies                                    │
│  - Container Security                                       │
│  - Immutable Infrastructure                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication

### JWT Token Configuration

UPM uses JWT (JSON Web Tokens) for authentication:

```python
# Recommended production settings
JWT_CONFIG = {
    "algorithm": "RS256",  # Asymmetric encryption
    "access_token_expire_minutes": 15,
    "refresh_token_expire_days": 30,
    "issuer": "upm.production",
    "audience": "upm.api"
}
```

### Token Rotation

Implement automatic token rotation:

```python
# Refresh tokens should be:
# - Single-use (invalidate after use)
# - Stored securely (httpOnly cookies)
# - Rotated on each use
```

### Multi-Factor Authentication (MFA)

UPM supports TOTP-based MFA:

1. Enable in user settings
2. Scan QR code with authenticator app
3. Enter 6-digit code on login

### Session Management

- Session timeout: 15 minutes of inactivity
- Concurrent sessions: Maximum 3 per user
- IP binding: Optional, for high-security environments

---

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management |
| **Security Officer** | View all vulnerabilities, policy management |
| **Developer** | View own projects, trigger scans |
| **Auditor** | Read-only access to audit logs |
| **Viewer** | Read-only access to assigned projects |

### API Key Scopes

API keys support granular permissions:

```
read:projects    - View project information
write:projects   - Create/update projects
scan:vulnerabilities - Trigger scans
read:vulnerabilities - View scan results
manage:policies  - Modify security policies
admin:users      - User management
```

---

## Data Protection

### Encryption at Rest

Sensitive data is encrypted using Fernet (AES-128-CBC):

```python
# Encrypted fields:
- User passwords (PBKDF2-SHA256)
- API keys
- OAuth tokens
- LDAP bind credentials
- SSO private keys
```

### Encryption in Transit

All connections use TLS 1.3:

```yaml
# Minimum TLS configuration
ssl_protocols: TLSv1.3
ssl_ciphers: HIGH:!aNULL:!MD5
ssl_prefer_server_ciphers: on
```

### Data Classification

| Classification | Examples | Storage |
|----------------|----------|---------|
| **Public** | Documentation, public APIs | Unencrypted |
| **Internal** | Project names, dependency lists | Encrypted |
| **Confidential** | Vulnerability reports, scan results | Encrypted |
| **Restricted** | Credentials, tokens, secrets | Encrypted (HSM) |

### Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Audit logs | 7 years (compliance) |
| Scan results | 2 years |
| Analytics data | 1 year |
| User activity logs | 90 days |
| Temporary data | 24 hours |

---

## Network Security

### Network Policies

Default deny-all policy with explicit allows:

```yaml
# Only allow necessary traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: udp-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

### Allowed Traffic

| Source | Destination | Port | Purpose |
|--------|-------------|------|---------|
| API Pod | PostgreSQL | 5432 | Database queries |
| API Pod | Redis | 6379 | Cache/sessions |
| Worker | PostgreSQL | 5432 | Database queries |
| Worker | External APIs | 443 | Dependency lookups |
| Ingress | API Pod | 8040 | User requests |

### Security Headers

All responses include security headers:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## Secrets Management

### Recommended Approach

Use a dedicated secrets manager:

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id udp/prod

# HashiCorp Vault
vault kv get -field=database_url udp/prod

# Azure Key Vault
az keyvault secret show --vault-name udp-kv --name database-url
```

### Secret Rotation Schedule

| Secret | Rotation Frequency |
|--------|-------------------|
| Database passwords | Quarterly |
| API keys | Monthly |
| JWT signing keys | Annually |
| TLS certificates | Before expiration |
| OAuth client secrets | Quarterly |

### Kubernetes Secrets Best Practices

```bash
# Enable encryption at rest for etcd
# Ensure secrets are not in logs
kubectl create secret generic udp-secrets \
  --from-env-file=secrets.env \
  --dry-run=client -o yaml | \
  kubectl apply -f -

# Use external secrets operator
# (e.g., External Secrets Operator, HashiCorp Vault Provider)
```

---

## Compliance

### SOC 2 Type II

UPM supports SOC 2 controls:

- **Access Control**: RBAC, MFA, session management
- **Change Management**: GitOps, approval workflows
- **Incident Response**: Runbooks, escalation policies
- **Monitoring**: Audit logging, anomaly detection
- **Data Encryption**: At rest and in transit

### GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Right to access | User data export API |
| Right to deletion | Account deletion with data purge |
| Data portability | JSON export functionality |
| Consent management | Explicit opt-in for tracking |
| Data breach notification | Automated alerts within 72h |

### PCI DSS (if processing payment data)

- Use PA-DSS validated payment processor
- Never store cardholder data
- Implement strong access controls
- Regular vulnerability scanning
- Annual penetration testing

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in external secrets manager
- [ ] TLS certificates valid and configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] Output encoding enabled
- [ ] SQL injection protections in place
- [ ] XSS protections enabled
- [ ] CSRF protection enabled
- [ ] Dependencies scanned for vulnerabilities
- [ ] Security headers tested
- [ ] Authentication flow tested
- [ ] Authorization tested for all endpoints
- [ ] Audit logging enabled and functioning

### Post-Deployment

- [ ] Penetration testing completed
- [ ] Security audit reviewed
- [ ] Incident response team trained
- [ ] Security monitoring configured
- [ ] Alert rules tested
- [ ] Backup and recovery tested
- [ ] Disaster recovery drill completed
- [ ] Security documentation complete
- [ ] User security training delivered

### Ongoing

- [ ] Monthly dependency updates
- [ ] Quarterly secret rotation
- [ ] Quarterly security reviews
- [ ] Annual penetration testing
- [ ] Continuous monitoring for vulnerabilities
- [ ] Regular security training for team
- [ ] Threat modeling for new features
- [ ] Incident response drills

---

## Incident Response

### Security Incident Process

1. **Detection**
   - Automated alerts trigger
   - Anomaly detection identifies issues

2. **Containment**
   - Isolate affected systems
   - Preserve evidence
   - Prevent data exfiltration

3. **Eradication**
   - Identify root cause
   - Remove threat
   - Patch vulnerabilities

4. **Recovery**
   - Restore from clean backups
   - Monitor for recurrence
   - Document lessons learned

### Security Contacts

| Role | Contact | Responsibilities |
|------|---------|------------------|
| Security Lead | security@upm.internal | Incident coordination |
| CTO | cto@upm.internal | Escalation point |
| Legal | legal@upm.internal | Compliance matters |
| PR | pr@upm.internal | Public communication |

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
