/**
 * Onboarding Advisor — AI prompt generation for onboarding recommendations
 */

import type { OnboardingRequest, ProvisioningPlan } from './types.js';

/**
 * Generate AI prompt for onboarding recommendations
 */
export function generateOnboardingPrompt(
	request: OnboardingRequest,
	plan: ProvisioningPlan
): string {
	return `You are helping onboard a new employee to a Microsoft 365 environment.

**New Employee:**
- Name: ${request.userName}
- Email: ${request.email}
- Role: ${request.role}
- Department: ${request.department}
- Start Date: ${request.startDate}
${request.manager ? `- Manager: ${request.manager}` : ''}
${request.similarUserEmail ? `- Similar to: ${request.similarUserEmail}` : ''}

**Generated Provisioning Plan:**

**Licenses (${plan.licenses.length}):**
${plan.licenses.map((l) => `- ${l.skuName} (${l.priority}) - ${l.reason}`).join('\n')}

**Groups (${plan.groups.length}):**
${plan.groups.map((g) => `- ${g.groupName} (${g.priority}) - ${g.reason}`).join('\n')}

**Applications (${plan.applications.length}):**
${plan.applications.map((a) => `- ${a.appName} (${a.priority}) - ${a.reason}`).join('\n')}

**Security Settings (${plan.securitySettings.length}):**
${plan.securitySettings.map((s) => `- ${s.setting}: ${s.value} (${s.priority}) - ${s.reason}`).join('\n')}

**Estimated Cost:** $${plan.estimatedCost.monthly}/month ($${plan.estimatedCost.annual}/year)

**Timeline:** ${plan.timeline.length} steps, ~28 minutes total

Please provide:
1. **Validation**: Are there any missing requirements for this role?
2. **Optimization**: Any opportunities to reduce cost without impacting productivity?
3. **Risk Assessment**: Potential security or compliance concerns?
4. **Recommendations**: Additional tools or access this employee might need?
5. **Onboarding Checklist**: Day 1, Week 1, Month 1 tasks for the new employee

Be specific and actionable. Consider industry best practices for ${request.department} roles.`;
}
