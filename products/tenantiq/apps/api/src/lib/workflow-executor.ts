/**
 * Workflow executor — runs real logic for each workflow type.
 * Queries D1 for licenses, users, alerts to produce actionable results.
 */

import { getSkuCost, getSkuDisplayName } from './constants';
import { runComplianceCheck } from './workflow-compliance-check';

export interface WorkflowStepItem {
	name?: string;
	email?: string;
	detail?: string;
}

export interface WorkflowStep {
	name: string;
	status: 'success' | 'warning' | 'error';
	result: string;
	duration: number;
	items?: WorkflowStepItem[];
}

export interface WorkflowResult {
	steps: WorkflowStep[];
	summary: string;
}

type Executor = (db: D1Database, tenantId: string) => Promise<WorkflowResult>;

const executors: Record<string, Executor> = {
	license_optimization: runLicenseOptimization,
	security_remediation: runSecurityRemediation,
	user_cleanup: runUserCleanup,
	compliance_check: runComplianceCheck,
};

export async function executeWorkflow(
	db: D1Database,
	tenantId: string,
	workflowType: string
): Promise<WorkflowResult> {
	const executor = executors[workflowType];
	if (!executor) {
		return {
			steps: [{ name: 'Validate', status: 'error', result: `Unknown type: ${workflowType}`, duration: 0 }],
			summary: `Unsupported workflow type: ${workflowType}`,
		};
	}
	return executor(db, tenantId);
}

async function runLicenseOptimization(db: D1Database, tenantId: string): Promise<WorkflowResult> {
	const steps: WorkflowStep[] = [];
	const t0 = Date.now();

	const licenses = await db
		.prepare('SELECT sku_part_number, consumed_units, prepaid_units FROM licenses_cache WHERE tenant_id = ?')
		.bind(tenantId).all().catch(() => ({ results: [] as any[] }));
	steps.push({ name: 'Fetch licenses', status: 'success', result: `${licenses.results.length} SKUs loaded`, duration: Date.now() - t0 });

	const t1 = Date.now();
	let totalWaste = 0;
	const recommendations: string[] = [];
	for (const lic of licenses.results) {
		const enabled = Number(lic.enabled_units || lic.prepaid_units || 0);
		const consumed = Number(lic.consumed_units || 0);
		if (enabled === 0) continue;
		const unused = enabled - consumed;
		const wasteRatio = unused / enabled;
		if (wasteRatio > 0.1 && unused > 0) {
			const cost = getSkuCost(lic.sku_part_number as string);
			if (cost === 0) continue; // Skip free SKUs
			const monthlySavings = unused * cost;
			totalWaste += monthlySavings;
			const name = getSkuDisplayName(lic.sku_part_number as string);
			recommendations.push(`${name}: ${unused} unused of ${enabled} ($${monthlySavings}/mo)`);
		}
	}

	const recStatus = recommendations.length > 0 ? 'warning' : 'success';
	const recText = recommendations.length > 0
		? recommendations.slice(0, 5).join('; ')
		: 'No significant license waste detected';
	steps.push({ name: 'Analyze waste', status: recStatus, result: recText, duration: Date.now() - t1 });

	const summary = recommendations.length > 0
		? `Found ${recommendations.length} SKU(s) with >10% waste. Potential savings: $${totalWaste.toFixed(0)}/mo`
		: 'All licenses are well-utilized. No action needed.';
	return { steps, summary };
}

async function runSecurityRemediation(db: D1Database, tenantId: string): Promise<WorkflowResult> {
	const steps: WorkflowStep[] = [];
	const t0 = Date.now();

	const disabled = await db
		.prepare('SELECT display_name, user_principal_name FROM users_cache WHERE tenant_id = ? AND account_enabled = 0 LIMIT 50')
		.bind(tenantId).all().catch(() => ({ results: [] as any[] }));
	steps.push({
		name: 'Find disabled accounts',
		status: 'success',
		result: `${disabled.results.length} disabled account(s)`,
		duration: Date.now() - t0,
		items: disabled.results.map((r: any) => ({ name: r.display_name as string, email: r.user_principal_name as string })),
	});

	const t1 = Date.now();
	const cutoff = Math.floor(Date.now() / 1000) - 180 * 86400;
	const inactive = await db
		.prepare('SELECT display_name, user_principal_name, last_sign_in_at FROM users_cache WHERE tenant_id = ? AND account_enabled = 1 AND last_sign_in_at < ? AND last_sign_in_at IS NOT NULL LIMIT 50')
		.bind(tenantId, cutoff).all().catch(() => ({ results: [] as any[] }));
	steps.push({
		name: 'Find inactive users (180d+)',
		status: inactive.results.length > 0 ? 'warning' : 'success',
		result: `${inactive.results.length} inactive user(s) to review`,
		duration: Date.now() - t1,
		items: inactive.results.map((r: any) => ({
			name: r.display_name as string,
			email: r.user_principal_name as string,
			detail: r.last_sign_in_at ? `last sign-in ${new Date(Number(r.last_sign_in_at) * 1000).toISOString().slice(0, 10)}` : undefined,
		})),
	});

	const total = disabled.results.length + inactive.results.length;
	const summary = total > 0
		? `${total} account(s) need review: ${disabled.results.length} disabled, ${inactive.results.length} inactive 180d+`
		: 'No security remediation items found.';
	return { steps, summary };
}

async function runUserCleanup(db: D1Database, tenantId: string): Promise<WorkflowResult> {
	const steps: WorkflowStep[] = [];
	const t0 = Date.now();

	const cutoff90 = Math.floor(Date.now() / 1000) - 90 * 86400;
	const staleGuests = await db
		.prepare("SELECT display_name, user_principal_name, last_sign_in_at FROM users_cache WHERE tenant_id = ? AND user_principal_name LIKE '%#EXT#%' AND (last_sign_in_at IS NULL OR last_sign_in_at < ?) LIMIT 50")
		.bind(tenantId, cutoff90).all().catch(() => ({ results: [] as any[] }));
	steps.push({
		name: 'Find stale guests (90d+)',
		status: staleGuests.results.length > 0 ? 'warning' : 'success',
		result: `${staleGuests.results.length} stale guest(s)`,
		duration: Date.now() - t0,
		items: staleGuests.results.map((r: any) => ({
			name: r.display_name as string,
			email: r.user_principal_name as string,
			detail: r.last_sign_in_at ? `last sign-in ${new Date(Number(r.last_sign_in_at) * 1000).toISOString().slice(0, 10)}` : 'never signed in',
		})),
	});

	const t1 = Date.now();
	const neverSignedIn = await db
		.prepare('SELECT display_name, user_principal_name FROM users_cache WHERE tenant_id = ? AND account_enabled = 1 AND last_sign_in_at IS NULL LIMIT 50')
		.bind(tenantId).all().catch(() => ({ results: [] as any[] }));
	steps.push({
		name: 'Find never-signed-in accounts',
		status: neverSignedIn.results.length > 0 ? 'warning' : 'success',
		result: `${neverSignedIn.results.length} account(s) never signed in`,
		duration: Date.now() - t1,
		items: neverSignedIn.results.map((r: any) => ({
			name: r.display_name as string,
			email: r.user_principal_name as string,
		})),
	});

	const total = staleGuests.results.length + neverSignedIn.results.length;
	const summary = total > 0
		? `${total} account(s) for cleanup: ${staleGuests.results.length} stale guests, ${neverSignedIn.results.length} never signed in`
		: 'No user cleanup items found.';
	return { steps, summary };
}
