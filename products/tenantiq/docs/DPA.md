# Data Processing Agreement (DPA)

**Effective Date**: [DATE]
**Between**: TenantIQ Inc. ("Processor") and the Customer ("Controller")

## 1. Definitions

- **Personal Data**: Any data relating to an identified or identifiable natural person.
- **Processing**: Any operation performed on Personal Data (collection, storage, retrieval,
  deletion).
- **Sub-processor**: A third party engaged by the Processor to process Personal Data.
- **Data Subject**: The individual whose Personal Data is processed.
- **Applicable Law**: GDPR (EU), CCPA (California), and any other applicable data protection
  legislation.

## 2. Scope and Purpose

The Processor processes Personal Data solely to provide the TenantIQ service:
Microsoft 365 security monitoring, compliance assessment, and cost optimization
on behalf of the Controller's managed tenants.

Data processed includes:
- Microsoft 365 user profiles (name, email, UPN, department)
- License assignment and usage data
- Security configuration and compliance status
- Sign-in logs and audit events (metadata only)
- Email security headers and threat indicators (no email content)

## 3. Processing Details

| Element | Detail |
|---------|--------|
| **Data subjects** | Controller's employees and Microsoft 365 users |
| **Categories** | User identity, license, security config, audit metadata |
| **Purpose** | Security monitoring, compliance, cost optimization |
| **Duration** | For the term of the service agreement |
| **Location** | Cloudflare global network (edge locations) |

## 4. Security Measures

The Processor implements the following technical and organizational measures:

- **Encryption at rest**: AES-256-GCM (Cloudflare D1, KV, R2)
- **Encryption in transit**: TLS 1.3 for all API communication
- **Access control**: Clerk JWT authentication, RBAC (admin/operator/viewer)
- **Multi-tenant isolation**: All queries scoped by organization ID
- **Audit logging**: Auth events, admin actions, data mutations logged
- **Vulnerability management**: Automated dependency scanning, SAST in CI
- **Incident response**: 72-hour breach notification (see Section 7)
- **Data minimization**: Only data necessary for service functionality is collected

## 5. Sub-processors

Current sub-processors:

| Sub-processor | Purpose | Location |
|---------------|---------|----------|
| Cloudflare Inc. | Infrastructure (Workers, D1, KV, R2, Pages) | Global |
| Clerk Inc. | Authentication and user management | US |
| Anthropic PBC | AI-powered security analysis | US |
| Resend Inc. | Transactional email delivery | US |
| Sentry Inc. | Error monitoring (no PII in payloads) | US |
| Microsoft Corp. | Graph API (Controller's own data) | Per tenant config |

The Processor will notify the Controller at least 30 days before adding a new
sub-processor. The Controller may object within 14 days.

## 6. Data Subject Rights

The Processor assists the Controller in fulfilling data subject requests:

- **Access**: Export all stored data for a user via API
- **Rectification**: Data synced from Microsoft Graph; corrections made at source
- **Erasure**: Delete cached user data on request; automatic after tenant disconnect
- **Portability**: JSON export of all tenant data
- **Restriction**: Pause processing for specific users or tenants

Response time: Within 10 business days of receiving a verified request.

## 7. Data Breach Notification

In the event of a Personal Data breach, the Processor will:

1. Notify the Controller within **72 hours** of becoming aware
2. Provide details: nature of breach, categories and number of records affected,
   likely consequences, measures taken
3. Cooperate with the Controller's investigation and regulatory notifications
4. Document all breaches in an internal register

## 8. Data Retention and Deletion

- Active data retained for the duration of the service agreement
- Cached Microsoft 365 data refreshed on sync schedule (6-hour default)
- Upon termination: all Controller data deleted within **30 days**
- Controller may request immediate deletion and receive written confirmation
- Backups containing Controller data purged within **90 days** of termination

## 9. Audits

The Controller may audit the Processor's compliance with this DPA:

- Annual audit right with 30 days written notice
- Processor will provide SOC 2 Type II report (when available)
- Processor will respond to security questionnaires within 10 business days

## 10. Term and Termination

This DPA is effective for the duration of the service agreement. It survives
termination until all Personal Data is deleted per Section 8.

## 11. Governing Law

This DPA is governed by the law specified in the main service agreement.
For EU data subjects, GDPR provisions take precedence.

---

**Processor**: TenantIQ Inc.
**Signature**: ___________________________
**Date**: ___________________________

**Controller**: [Customer Name]
**Signature**: ___________________________
**Date**: ___________________________
