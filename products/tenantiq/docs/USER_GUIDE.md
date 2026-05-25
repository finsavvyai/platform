# TenantIQ User Guide

## Getting Started

### 1. Sign In

1. Navigate to [app.tenantiq.app](https://app.tenantiq.app).
2. Click **Sign in with Microsoft** to authenticate with your Microsoft 365 account.
3. Grant the requested permissions so TenantIQ can read your tenant security configuration.
4. You will be redirected to the dashboard once sign-in completes.

### 2. Connect Your Tenant

1. After first sign-in, the **Onboarding Wizard** guides you through setup.
2. Click **Grant Admin Consent** to authorize TenantIQ for your Azure AD tenant.
3. Wait for the consent popup to close automatically.
4. Your tenant appears in the sidebar tenant switcher once connected.

### 3. Sync Data

1. Navigate to **Dashboard** and click **Sync Now** to pull users, licenses, and security data.
2. Syncs run automatically on a schedule after the first manual sync.
3. The sync status indicator in the sidebar shows the last sync time.

## Key Features

### Dashboard

The main dashboard shows an overview of your tenant health:

- **Secure Score** — derived from Microsoft Secure Score and local analysis.
- **Active Alerts** — grouped by severity (Critical, High, Medium, Low).
- **License Utilization** — assigned vs available licenses with estimated spend and waste.
- **User Breakdown** — active, inactive, disabled, and guest accounts.

### CIS Benchmark

Navigate to **Security > CIS Benchmark** to run compliance scans:

- Evaluates 100+ CIS Microsoft 365 controls automatically.
- Each control shows pass/fail status, severity, and remediation steps.
- Use **Auto-Remediate** (dry-run first) to fix failing controls.
- Track score history over time with the trend chart.

### Alerts

The **Alerts** page shows security and operational alerts:

- Filter by severity, type, or date range.
- Click an alert to see details and recommended actions.
- Acknowledge or resolve alerts to clear them from the active list.

### Licenses

View all Microsoft 365 license subscriptions:

- See assigned vs total units per SKU.
- Identify unused licenses contributing to waste.
- Get AI-powered optimization recommendations.

### AI Agent

Ask natural language questions about your tenant:

- "Which users haven't signed in for 90 days?"
- "What is my MFA adoption rate?"
- "Show me expiring app credentials."

The AI agent queries your tenant data and returns actionable insights.

### Executive Reports

Generate PDF reports for stakeholders:

- Security posture summary
- Compliance status
- License optimization recommendations
- Custom date ranges and filtering

## Skills Hub

Skills are modular capabilities you can enable per tenant:

- **Backup** — automated cloud backups of tenant configuration.
- **Compliance** — continuous compliance monitoring against frameworks.
- **Cost Optimization** — license waste detection and recommendations.

Enable skills from the **Skills Hub** page in the sidebar.

## Multi-Tenant Management

If you manage multiple tenants (MSP use case):

1. Use the **Tenant Switcher** in the sidebar to switch between tenants.
2. Each tenant has isolated data — no cross-tenant data leakage.
3. The **MSP Benchmark** page compares security scores across all tenants.

## FAQ

**Q: How often does TenantIQ sync data from Microsoft 365?**
A: After the initial manual sync, data syncs automatically every hour. You can trigger a manual sync at any time from the dashboard.

**Q: Does TenantIQ modify my Microsoft 365 configuration?**
A: Only when you explicitly use the Auto-Remediate feature. All remediations support dry-run mode so you can preview changes before applying them.

**Q: What permissions does TenantIQ need?**
A: TenantIQ requests read-only access to users, groups, policies, security events, and audit logs. Write access is only requested for remediation features (conditional access policies, user management).

**Q: Can I export my data?**
A: Yes. Use the Export menu on any data table to download as CSV or PDF. Executive reports can be generated and downloaded from the Reports page.

**Q: How do I cancel my subscription?**
A: Navigate to **Settings > Billing** and click **Manage Subscription**. You can downgrade or cancel at any time.

## Support

- Email: support@tenantiq.app
- Documentation: [docs.tenantiq.app](https://docs.tenantiq.app)
- Status page: [status.tenantiq.app](https://status.tenantiq.app)
