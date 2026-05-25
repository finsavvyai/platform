# TenantIQ Admin & MSP Guide

## Platform Administration

### Managing Users

1. Navigate to **Enterprise > Team** to view all platform users.
2. Invite new users by clicking **Invite Member** and entering their email.
3. Assign roles:
   - **Admin** — full access including billing, team management, and remediation.
   - **Operator** — read security data, create workflows, trigger scans. No billing access.
   - **Viewer** — read-only access to dashboards and reports. No configuration changes.
4. Remove users by clicking the remove icon next to their name.

### Managing Organizations

Each MSP organization can manage multiple tenants under one account:

- Organization settings are in **Enterprise > Settings**.
- Configure organization name, contact info, and notification preferences.
- View subscription status and usage metrics.

### Subscription Management

1. Go to **Settings > Billing** to view your current plan.
2. Plans: **Free** (1 tenant, core features), **Pro** (5 tenants, all features), **Enterprise** (unlimited tenants, SSO, SLA).
3. Upgrade or downgrade at any time via the billing portal (LemonSqueezy).
4. Usage is tracked per skill and per tenant.

## Tenant Management

### Connecting a New Tenant

1. Click **Add Tenant** in the tenant switcher dropdown.
2. Authenticate as a Global Admin of the target Microsoft 365 tenant.
3. Grant admin consent for TenantIQ application permissions.
4. The tenant appears in your list after consent is granted.

### Syncing Data

- **Manual sync**: Click **Sync Now** on the tenant dashboard.
- **Automatic sync**: Runs hourly via Cloudflare Workers cron triggers.
- **Incremental sync**: Only changed data is pulled via Microsoft Graph delta queries.
- Monitor sync status and errors in **Analytics > Config History**.

### Monitoring Tenant Health

- **Health Check** page shows an overall health score based on:
  - MFA adoption rate
  - Inactive user percentage
  - Open critical/high alerts
  - CIS benchmark pass rate
- Set up alert notifications via email, Slack, or Teams in **Settings > Notifications**.

## Remediation

### Using Auto-Remediate

1. Navigate to **Security > CIS Benchmark**.
2. Find a failing control and click **Remediate**.
3. **Always use Dry Run first** to preview the changes.
4. Review the proposed changes in the dry-run output.
5. Click **Apply** to execute the remediation against the live tenant.

### Scheduling Remediation

- Use **Workflows** to schedule recurring remediation tasks.
- Configure a workflow with the control ID and execution schedule.
- Workflows run via Cloudflare queues with retry logic.

### Rollback

- Remediation actions that modify conditional access policies store the previous state.
- Navigate to **Config Snapshots** to view configuration before and after remediation.
- Use the **Restore** button on a snapshot to revert to a previous configuration state.

## Reports

### Executive Reports

1. Go to **Analytics > Executive Reports**.
2. Select report type: Security Posture, Compliance, License Optimization, or Custom.
3. Choose date range and target tenants.
4. Click **Generate** to create a PDF report.
5. Reports are stored in R2 and available for download for 90 days.

### Custom Report Builder

1. Select metrics to include (security score, alerts, licenses, compliance).
2. Apply filters (severity, date range, tenant).
3. Choose format: PDF, CSV, or JSON.
4. Schedule recurring generation with a cron expression.

### PDF Export

- Any data table supports CSV/PDF export via the Export menu.
- PDF reports include charts, tables, and executive summary.
- Branding and logo customization available on Enterprise plans.

## Best Practices

### Security Hardening Checklist

- [ ] Enable MFA for all admin accounts
- [ ] Review and minimize Global Admin count (target 2-4)
- [ ] Configure Conditional Access policies for risk-based authentication
- [ ] Enable audit log monitoring for admin actions
- [ ] Set up alert notifications for critical security events
- [ ] Run CIS benchmark scans weekly
- [ ] Review and remediate failing controls monthly
- [ ] Monitor sign-in logs for suspicious activity
- [ ] Rotate app credentials before expiry
- [ ] Enable sensitivity labels for data classification

### MSP Multi-Tenant Best Practices

- Use separate operator accounts per team member (no shared credentials).
- Run benchmark comparisons monthly to identify underperforming tenants.
- Set up webhook integrations with your PSA/ticketing system.
- Schedule executive reports for client stakeholders.
- Enable skills incrementally — start with Backup and Compliance, add Cost Optimization later.

## Support

- Email: support@tenantiq.app
- Priority support for Enterprise plans: enterprise@tenantiq.app
