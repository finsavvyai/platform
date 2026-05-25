/**
 * Onboarding Advisor — Provisioning plan generation
 */

import type {
	ApprovalRequirement,
	OnboardingRequest,
	ProvisioningPlan,
	TimelineStep,
} from './types.js';
import { ROLE_TEMPLATES } from './role-templates.js';

/**
 * Generate intelligent provisioning plan
 */
export function generateProvisioningPlan(
	request: OnboardingRequest,
	peerData?: Partial<ProvisioningPlan>
): ProvisioningPlan {
	// Start with role-based template
	const roleKey = request.role.toLowerCase().replace(/\s+/g, '_');
	const template = ROLE_TEMPLATES[roleKey] || ROLE_TEMPLATES.developer;

	// Merge with peer analysis if available
	const licenses = [...(template.licenses || [])];
	const groups = [...(template.groups || [])];
	const applications = [...(template.applications || [])];
	const securitySettings = [...(template.securitySettings || [])];

	if (peerData) {
		// Add peer-based recommendations
		if (peerData.licenses) {
			for (const peerLicense of peerData.licenses) {
				if (!licenses.find((l) => l.skuId === peerLicense.skuId)) {
					licenses.push(peerLicense);
				}
			}
		}
		if (peerData.groups) {
			for (const peerGroup of peerData.groups) {
				if (!groups.find((g) => g.groupName === peerGroup.groupName)) {
					groups.push(peerGroup);
				}
			}
		}
	}

	// Calculate estimated cost
	const monthlyCost = licenses.reduce((sum, l) => sum + l.cost, 0);

	// Generate timeline
	const timeline = buildTimeline();

	// Determine approvals needed
	const approvals = buildApprovals(request, monthlyCost);

	// Generate reasoning
	const reasoning = buildReasoning(request, licenses, groups, monthlyCost, !!peerData);

	return {
		user: {
			displayName: request.userName,
			email: request.email,
			department: request.department,
			jobTitle: request.role,
		},
		licenses,
		groups,
		applications,
		securitySettings,
		estimatedCost: {
			monthly: monthlyCost,
			annual: monthlyCost * 12,
		},
		timeline,
		approvals,
		reasoning,
	};
}

function buildTimeline(): TimelineStep[] {
	return [
		{
			step: 1,
			action: 'Create user account in Azure AD',
			estimatedTime: '5 minutes',
			dependencies: [],
		},
		{
			step: 2,
			action: 'Assign licenses',
			estimatedTime: '2 minutes',
			dependencies: [1],
		},
		{
			step: 3,
			action: 'Add to security groups',
			estimatedTime: '3 minutes',
			dependencies: [1],
		},
		{
			step: 4,
			action: 'Configure MFA and security settings',
			estimatedTime: '5 minutes',
			dependencies: [2],
		},
		{
			step: 5,
			action: 'Provision applications',
			estimatedTime: '10 minutes',
			dependencies: [3],
		},
		{
			step: 6,
			action: 'Send welcome email with credentials',
			estimatedTime: '2 minutes',
			dependencies: [4, 5],
		},
		{
			step: 7,
			action: 'Schedule security training',
			estimatedTime: '1 minute',
			dependencies: [6],
		},
	];
}

function buildApprovals(
	request: OnboardingRequest,
	monthlyCost: number
): ApprovalRequirement[] {
	const approvals: ApprovalRequirement[] = [];
	if (request.manager) {
		approvals.push({
			approver: request.manager,
			reason: 'Manager approval for team access',
			required: true,
		});
	}
	if (monthlyCost > 50) {
		approvals.push({
			approver: 'IT Director',
			reason: 'High-cost license approval',
			required: true,
		});
	}
	return approvals;
}

function buildReasoning(
	request: OnboardingRequest,
	licenses: ProvisioningPlan['licenses'],
	groups: ProvisioningPlan['groups'],
	monthlyCost: number,
	hasPeerData: boolean
): string {
	return `
Based on the role "${request.role}" in the ${request.department} department, this provisioning plan includes:

1. **Licenses**: ${licenses.filter((l) => l.priority === 'required').length} required, ${licenses.filter((l) => l.priority === 'recommended').length} recommended
   - Primary license provides core productivity tools
   ${hasPeerData ? '- Additional licenses based on peer analysis' : ''}

2. **Groups**: ${groups.filter((g) => g.priority === 'required').length} required for role-based access
   - Ensures appropriate permissions from day one
   - Follows principle of least privilege

3. **Security**: MFA and conditional access policies enforced
   - Protects company data and user account
   - Complies with security policies

4. **Timeline**: Estimated 28 minutes total provisioning time
   - Automated where possible
   - Manual steps clearly documented

5. **Cost**: $${monthlyCost.toFixed(2)}/month ($${(monthlyCost * 12).toFixed(2)}/year)
   - Optimized for role requirements
   - No unnecessary licenses
`.trim();
}
