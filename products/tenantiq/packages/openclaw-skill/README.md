# TenantIQ OpenClaw Skill

Manage your Microsoft 365 tenants from any messaging platform using natural language commands.

## Features

- 🔐 **Security Management**: Check security status, view alerts, block users, enable MFA
- 💰 **License Optimization**: Find inactive users, identify waste, optimize costs
- 👥 **User Management**: Search users, manage guests, reset passwords
- 📊 **Compliance**: Check compliance status, manage groups, audit logs
- 🤖 **AI-Powered**: Natural language queries powered by Claude AI

## Supported Platforms

- WhatsApp
- Slack
- Microsoft Teams
- Discord
- Telegram
- iMessage (via BlueBubbles)
- And more...

## Installation

1. Install OpenClaw: https://openclaw.ai
2. Install TenantIQ skill:
   ```bash
   openclaw install tenantiq
   ```
3. Authenticate:
   ```
   tenantiq auth
   ```

## Commands

### Security
- `tenantiq security status` - Get security posture summary
- `tenantiq check alerts` - List active alerts
- `tenantiq show critical alerts` - Filter critical alerts
- `tenantiq mfa status` - Check MFA adoption
- `tenantiq risky users` - List users with risky sign-ins
- `tenantiq block user <email>` - Disable user account

### License Optimization
- `tenantiq license waste` - Calculate license waste
- `tenantiq inactive users` - Find inactive users
- `tenantiq unused licenses` - List unassigned licenses
- `tenantiq downgrade <user>` - Downgrade license

### User Management
- `tenantiq search user <name>` - Find users
- `tenantiq user details <email>` - Get user info
- `tenantiq guest users` - List guest accounts
- `tenantiq reset password <email>` - Force password reset

### Compliance
- `tenantiq compliance status` - Compliance overview
- `tenantiq groups without owners` - List orphaned groups
- `tenantiq audit trail <action>` - Search audit logs

### Tenant Management
- `tenantiq switch tenant <name>` - Change active tenant
- `tenantiq list tenants` - Show accessible tenants
- `tenantiq dashboard` - Get dashboard metrics

### AI Assistant
- `tenantiq ask <question>` - Ask natural language question
- `tenantiq recommend` - Get AI recommendations

## Configuration

Set your TenantIQ API endpoint and authentication:

```bash
openclaw config set tenantiq.api_url https://api.tenantiq.app
openclaw config set tenantiq.auth_token <your-token>
```

Or authenticate via OAuth:

```bash
tenantiq auth
```

## Examples

```
You: tenantiq security status
TenantIQ: 🔒 Security Status for Contoso Ltd

Secure Score: 68/100 (Medium)
Active Alerts: 12 (3 critical, 5 high, 4 medium)
MFA Adoption: 78% (target: 100%)
Risky Users: 2

Critical Issues:
• MFA not enforced for 5 admin accounts
• Legacy authentication enabled
• 2 users with impossible travel detected

Would you like me to help resolve any of these issues?
```

```
You: tenantiq license waste
TenantIQ: 💰 License Waste Analysis

Total Waste: $3,450/month ($41,400/year)

Breakdown:
• Inactive Users (90+ days): 15 users × $20/mo = $300/mo
• Unassigned Licenses: 8 E5 licenses × $57/mo = $456/mo
• Underutilized E5: 45 users could downgrade = $2,694/mo

Recommended Actions:
1. Decommission 15 inactive users
2. Assign or release 8 unassigned licenses
3. Downgrade 45 users from E5 to E3

Potential Savings: $41,400/year

Type "tenantiq optimize licenses" to start optimization workflow.
```

## Privacy & Security

- Your data never leaves your organization
- All communication is encrypted (TLS 1.3)
- OAuth2 authentication with least-privilege access
- Complete audit trail of all actions
- GDPR compliant

## Support

- Documentation: https://docs.tenantiq.app/openclaw
- Issues: https://github.com/tenantiq/openclaw-skill/issues
- Community: https://discord.gg/tenantiq

## License

MIT
