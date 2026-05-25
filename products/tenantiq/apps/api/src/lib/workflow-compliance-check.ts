/** Compliance-check workflow executor — extracted from workflow-executor.ts
 *  to keep the parent file under the 200-line portfolio cap. */

import type { WorkflowResult, WorkflowStep } from './workflow-executor';

export async function runComplianceCheck(db: D1Database, tenantId: string): Promise<WorkflowResult> {
	const steps: WorkflowStep[] = [];
	const t0 = Date.now();

	const activeAlerts = await db
		.prepare("SELECT COUNT(*) as cnt FROM security_alerts WHERE tenant_id = ? AND status = 'active'")
		.bind(tenantId).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
	const alertCount = Number(activeAlerts?.cnt ?? 0);
	steps.push({ name: 'Count active alerts', status: alertCount > 5 ? 'warning' : 'success', result: `${alertCount} active alert(s)`, duration: Date.now() - t0 });

	const t1 = Date.now();
	const highCrit = await db
		.prepare("SELECT COUNT(*) as cnt FROM security_alerts WHERE tenant_id = ? AND status = 'active' AND severity IN ('high', 'critical')")
		.bind(tenantId).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
	const highCount = Number(highCrit?.cnt ?? 0);
	steps.push({ name: 'Check high/critical alerts', status: highCount > 0 ? 'error' : 'success', result: `${highCount} high/critical alert(s)`, duration: Date.now() - t1 });

	const t2 = Date.now();
	const userCount = await db
		.prepare('SELECT COUNT(*) as cnt FROM users_cache WHERE tenant_id = ?')
		.bind(tenantId).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
	const disabledCount = await db
		.prepare('SELECT COUNT(*) as cnt FROM users_cache WHERE tenant_id = ? AND account_enabled = 0')
		.bind(tenantId).first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
	const users = Number(userCount?.cnt ?? 0);
	const disabled = Number(disabledCount?.cnt ?? 0);
	const healthPct = users > 0 ? Math.round(((users - disabled) / users) * 100) : 100;
	steps.push({ name: 'User health check', status: healthPct < 80 ? 'warning' : 'success', result: `${users} users, ${disabled} disabled (${healthPct}% active)`, duration: Date.now() - t2 });

	const overallStatus = highCount > 0 ? 'Issues found' : alertCount > 5 ? 'Needs attention' : 'Compliant';
	const summary = `${overallStatus}: ${alertCount} active alerts (${highCount} high/critical), ${users} users (${healthPct}% active)`;
	return { steps, summary };
}
