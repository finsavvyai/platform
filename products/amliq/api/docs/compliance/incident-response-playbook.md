# Incident Response Playbook

**Version**: 1.0 | **Effective**: 2026-04-03 | **Owner**: Security Team

## Severity Levels
| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| P1 - Critical | Data breach, system compromise | 15 minutes | Customer PII exposed |
| P2 - High | Service degradation, auth bypass | 1 hour | Screening engine down |
| P3 - Medium | Partial outage, performance issue | 4 hours | Single list sync failing |
| P4 - Low | Minor issue, no customer impact | 24 hours | Logging gap |

## Response Phases

### 1. Detection
- Security audit logs monitored continuously
- Automated alerts for: auth failures >10/min, error rate >5%, latency p99 >1s
- Customer-reported issues via support channels

### 2. Containment
- Isolate affected tenant(s)
- Revoke compromised API keys
- Enable enhanced logging on affected systems
- Block suspicious IP addresses

### 3. Eradication
- Identify root cause via security logs and audit trail
- Apply fix and verify in staging
- Deploy to production with rollback plan ready

### 4. Recovery
- Restore service and verify all screening layers operational
- Re-enable affected tenants
- Verify data integrity via audit trail hash chain

### 5. Post-Incident
- Incident report within 72 hours
- Root cause analysis
- Update runbooks and monitoring
- Customer notification (if data breach, within 72 hours per GDPR)

## Communication
- Internal: Slack #security-incidents
- Customers: Status page + direct email for affected tenants
- Regulators: As required by jurisdiction (72h for GDPR breach)
