/**
 * OpenClaw Bridge — Prompt Builders
 *
 * Constructs AI agent prompts for tenant security and license analysis.
 */

import type { TenantSecurityContext, LicenseContext } from './types';

export function buildSecurityPosturePrompt(ctx: TenantSecurityContext): string {
	return `
Microsoft 365 Tenant Security Assessment
=========================================
Tenant: ${ctx.displayName}
Total Users: ${ctx.userCount}
Admins: ${ctx.adminCount}
Guests: ${ctx.guestCount}

SECURITY SIGNALS:
- MFA disabled: ${ctx.mfaDisabledCount} users
- Inactive users (90+ days): ${ctx.inactiveUserCount}
- Risky users flagged by Entra ID: ${ctx.riskyUsers.join(', ') || 'none'}

EXISTING ALERTS:
${ctx.alerts.map((a) => `- [${a.severity.toUpperCase()}] ${a.title}`).join('\n') || 'None'}

Please perform a full security assessment. Provide:
1. Overall risk score (0-100)
2. Critical findings (bullet list)
3. Prioritized remediation recommendations
4. Compliance gaps (SOC2, GDPR, ISO27001)
5. Estimated remediation hours
`;
}

export function buildLicenseWastePrompt(ctx: LicenseContext, totalCost: number): string {
	return `
Microsoft 365 License Optimization Analysis
============================================
Tenant: ${ctx.displayName}
Monthly Spend: $${totalCost.toFixed(2)}

LICENSE INVENTORY:
${ctx.licenses
	.map(
		(l) =>
			`- ${l.skuName}: ${l.assigned} assigned, ${l.active} active last 30d, $${l.cost}/user/mo`
	)
	.join('\n')}

INACTIVE USERS (no activity 90+ days):
${ctx.inactiveUsers
	.map((u) => `- ${u.name} (${u.daysSinceLogin}d inactive): ${u.licenses.join(', ')}`)
	.slice(0, 20)
	.join('\n')}

Provide:
1. Total wasted licenses count
2. Estimated monthly savings ($)
3. Specific actions (downgrade/remove per user group) with priority
4. License rightsizing recommendations
`;
}
