# UPM Enterprise Service Level Agreement (SLA)

**Effective Date**: February 14, 2024
**Version**: 2.0
**Provider**: Universal Dependency Platform, Inc.

---

## 1. Service Commitment

UPM guarantees that the UPM Enterprise Service will achieve the following Service Level Objectives (SLOs):

### 1.1 Availability Uptime

| Tier | Monthly Uptime | Quarterly Uptime | Annual Uptime | Downtime Allowance |
|------|---------------|-----------------|---------------|-------------------|
| **Critical** | 99.95% | 99.9% | 99.9% | 43 min/month |
| **Business** | 99.9% | 99.85% | 99.85% | 43 min/month |
| **Standard** | 99.5% | 99% | 99% | 3.6 hours/month |

### 1.2 API Performance

| Endpoint | p50 Latency | p95 Latency | p99 Latency |
|----------|-------------|-------------|-------------|
| Scan API | <100ms | <500ms | <1s |
| Analysis API | <200ms | <1s | <2s |
| Remediation API | <500ms | <2s | <5s |
| Dashboard API | <100ms | <300ms | <500ms |
| WebSocket | <50ms | <200ms | <500ms |

### 1.3 Data Freshness

| Data Type | Freshness Guarantee |
|-----------|-------------------|
| Vulnerability Database | <1 hour from NVD/OSV publication |
| License Information | <24 hours from registry update |
| Package Metadata | <1 hour from registry fetch |
| Analysis Results | Real-time |

### 1.4 Support Response Times

| Severity Level | Response Time | Resolution Time |
|----------------|---------------|-----------------|
| **P1 - Critical** | 15 minutes | 4 hours |
| **P2 - High** | 1 hour | 8 hours |
| **P3 - Medium** | 4 hours | 24 hours |
| **P4 - Low** | 24 hours | 72 hours |

---

## 2. Service Credits

### 2.1 Credit Calculation

If UPM fails to meet the SLOs, you will receive service credits as follows:

| Monthly Uptime | Service Credit |
|----------------|----------------|
| <99.9% but ≥99.0% | 10% of monthly fee |
| <99.0% but ≥95.0% | 25% of monthly fee |
| <95.0% but ≥90.0% | 50% of monthly fee |
| <90.0% | 100% of monthly fee |

### 2.2 Performance Credits

For API performance failures:

| Metric | Failure Threshold | Credit |
|--------|-------------------|--------|
| API Latency | >2x SLO for >5% of requests | 5% |
| API Error Rate | >0.1% for >10 minutes | 10% |
| Data Freshness | >2x SLA for >1 hour | 5% |

### 2.3 Credit Application

- Credits are applied to future invoices
- Maximum credits per month: 100% of monthly fee
- Credits must be claimed within 30 days
- Credits do not cover consequential damages

---

## 3. Exclusions

The SLA does not apply to service unavailability or degradation caused by:

1. **Force Majeure**: Natural disasters, war, government actions
2. **Customer Actions**: Misconfiguration, abuse, exceeding limits
3. **Third Parties**: Cloud provider outages (AWS, GCP, Azure)
4. **Scheduled Maintenance**: With 7-day advance notice
5. **Beta Features**: Experimental features not in GA
6. **Customer Network**: Connectivity issues on customer side

---

## 4. Service Scope

### 4.1 Covered Services

| Service | SLA Coverage |
|---------|--------------|
| API Endpoints | ✅ Full |
| Web Dashboard | ✅ Full |
| Database Storage | ✅ Full |
| Vulnerability Feeds | ✅ Full |
| Remediation Engine | ✅ Full |
| IDE Plugins | ⚠️ Best Effort |
| CLI Tools | ⚠️ Best Effort |

### 4.2 Maintenance Windows

- **Scheduled Maintenance**: Up to 4 hours per month
- **Notice Period**: 7 days for scheduled, 24 hours for emergency
- **Maintenance Window**: 2:00 AM - 6:00 AM UTC (Sunday)
- **Zero-Downtime**: Rolling deployments for all updates

---

## 5. Monitoring & Reporting

### 5.1 Public Status

- **Status Page**: https://status.upm.io
- **Update Frequency**: Real-time during incidents
- **Historical Data**: 90-day retention

### 5.2 Private Dashboards

Enterprise customers receive:
- Custom Grafana dashboards
- Real-time metrics streaming
- Monthly performance reports
- Quarterly business reviews

### 5.3 Incident Logging

All incidents are documented with:
- Root Cause Analysis (RCA)
- Timeline of events
- Resolution steps
- Prevention measures

---

## 6. Disaster Recovery

### 6.1 RPO/RTO Targets

| Tier | RPO (Recovery Point) | RTO (Recovery Time) |
|------|---------------------|---------------------|
| **Critical** | 15 minutes | 1 hour |
| **Business** | 1 hour | 4 hours |
| **Standard** | 24 hours | 24 hours |

### 6.2 Backup Schedule

- **Database**: Continuous WAL archiving + daily full backups
- **Retention**: 30 days on-premise, 1 year in cold storage
- **Storage**: Geo-redundant (3 regions)
- **Testing**: Monthly restoration drills

### 6.3 Failover Procedure

1. Automatic health checks every 30 seconds
2. Automatic failover within 60 seconds
3. DNS failover for user traffic
4. Connection draining for in-flight requests

---

## 7. Security Guarantees

### 7.1 Data Protection

- **Encryption at Rest**: AES-256 for all customer data
- **Encryption in Transit**: TLS 1.3 for all connections
- **Key Management**: HSM-backed key storage
- **Data Isolation**: Tenant-specific encryption keys

### 7.2 Compliance Certifications

UPM maintains:
- SOC 2 Type II
- ISO 27001
- GDPR Compliance
- HIPAA Ready (BAA available)
- FedRAMP Authorized (in process)

### 7.3 Penetration Testing

- **Frequency**: Quarterly by independent firm
- **Disclosure**: Summary report available on request
- **Remediation**: Critical findings within 48 hours

---

## 8. Support Tiers

### 8.1 Standard Support (Included)

| Feature | Availability |
|---------|--------------|
| Email Support | 24×7 |
| Knowledge Base | 24×7 |
| Community Forum | 24×7 |
| Chat Support | Business hours |
| Phone Support | ❌ Not included |

### 8.2 Premium Support (Add-on)

| Feature | Availability |
|---------|--------------|
| Dedicated CSM | Business hours |
| Phone Support | 24×7 |
| Slack/Teams Integration | 24×7 |
| Custom Training | Quarterly |
| Architecture Review | Annual |
| Onsite Support | Available |

### 8.3 Dedicated Support (Enterprise)

| Feature | Availability |
|---------|--------------|
| Dedicated TAM | Full-time |
| 24×7 Phone | Yes |
| 24×7 Slack/Teams | Yes |
| Custom Training | Monthly |
| Architecture Review | Quarterly |
| Onsite Support | Included |
| Feature Roadmap Input | Yes |

---

## 9. Service Modifications

### 9.1 Service Changes

UPM reserves the right to:
- Add new features without notice
- Modify non-core features with 30-day notice
- Deprecate features with 90-day notice
- Change pricing with 60-day notice

### 9.2 Customer Changes

Customers may:
- Upgrade/downgrade plans at any time
- Cancel with 30-day notice
- Export data on termination
- Receive historical data for 90 days post-termination

---

## 10. Legal Terms

### 10.1 Limitation of Liability

UPM's total liability is limited to:
- **Direct Damages**: 12 months of fees paid
- **Indirect Damages**: Excluded (including lost profits, data loss)

### 10.2 Warranty Disclaimer

Except as expressly stated in this SLA:
- Services provided "AS IS" and "AS AVAILABLE"
- No warranties of merchantability or fitness
- No guarantee of error-free operation

### 10.3 Indemnification

UPM indemnifies customers for:
- Intellectual property infringement claims
- Data breach resulting from UPM negligence
- Third-party claims arising from service provision

---

## 11. Definitions

**"Downtime"**: Any period when the service is unavailable to perform normal operations

**"Scheduled Maintenance"**: Planned maintenance windows announced in advance

**"Error Rate"**: Percentage of API requests returning 5xx status codes

**"Latency"**: Time from request receipt to response delivery

**"RPO"**: Recovery Point Objective - maximum acceptable data loss

**"RTO"**: Recovery Time Objective - maximum acceptable downtime

---

## 12. Contact Information

**SLA Inquiries**: sla@upm.io
**Support Portal**: https://support.upm.io
**Status Page**: https://status.upm.io
**Emergency**: +1 (888) UPM-SECURE (option 1)

---

*This SLA is part of the UPM Enterprise Agreement and is legally binding upon acceptance of the agreement.*

*Last Updated: February 14, 2024*
