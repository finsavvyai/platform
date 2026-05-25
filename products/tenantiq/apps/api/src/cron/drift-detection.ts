/**
 * Drift Detection Cron
 *
 * Compares the latest two config snapshots for each active tenant,
 * classifies drifts by severity, and creates alerts for critical/high changes.
 */

import type { Env } from '../app/types';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { trackSyncJob } from '../lib/sync-job-tracker';
import { getSnapshotManifest, getSnapshotCategory } from '../lib/snapshots/capture';
import { diffSnapshots } from '../lib/snapshots/diff';
import type { CategoryDiff, DiffEntry } from '../lib/snapshots/diff';
import { broadcastToTenant } from '../lib/broadcast';
import { isPathSuppressed, loadSuppressionRules } from '../lib/snapshots/suppression';

type DriftSeverity = 'critical' | 'high' | 'medium' | 'low';

interface DriftReport {
	tenantId: string;
	timestamp: string;
	totalChanges: number;
	drifts: DriftItem[];
}

interface DriftItem {
	category: string;
	path: string;
	type: DiffEntry['type'];
	severity: DriftSeverity;
}

const SECURITY_PATHS = ['conditionalAccess', 'authMethods', 'securityDefaults', 'mfa'];
const ACCESS_PATHS = ['accessPolicies', 'permissions', 'roles', 'appConsent'];
const GROUP_PATHS = ['groupMembership', 'members', 'owners'];

/** Classify a diff entry by severity based on the changed path */
function classifySeverity(categoryId: string, path: string): DriftSeverity {
	const lowerPath = `${categoryId}.${path}`.toLowerCase();
	if (SECURITY_PATHS.some((p) => lowerPath.includes(p))) return 'critical';
	if (ACCESS_PATHS.some((p) => lowerPath.includes(p))) return 'high';
	if (GROUP_PATHS.some((p) => lowerPath.includes(p))) return 'medium';
	return 'low';
}

/** Build a drift report from category diffs */
function buildDriftReport(tenantId: string, categoryDiffs: CategoryDiff[]): DriftReport {
	const drifts: DriftItem[] = [];

	for (const catDiff of categoryDiffs) {
		for (const change of catDiff.changes) {
			drifts.push({
				category: catDiff.categoryId,
				path: change.path,
				type: change.type,
				severity: classifySeverity(catDiff.categoryId, change.path),
			});
		}
	}

	return {
		tenantId,
		timestamp: new Date().toISOString(),
		totalChanges: drifts.length,
		drifts,
	};
}

/** Process drift detection for a single tenant */
async function detectTenantDrift(env: Env, tenantId: string): Promise<DriftReport | null> {
	const db = env.DB;

	// Get latest two snapshots
	const snapshots = await db.prepare(
		'SELECT id FROM config_snapshots WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 2',
	).bind(tenantId).all<{ id: string }>();

	const results = snapshots.results ?? [];
	if (results.length < 2) return null;

	const [newer, older] = results;
	const [m1, m2] = await Promise.all([
		getSnapshotManifest(env.KV, tenantId, newer.id),
		getSnapshotManifest(env.KV, tenantId, older.id),
	]);

	if (!m1 || !m2) return null;

	const allCats = [...new Set([...m1.categories, ...m2.categories])];
	const [newCats, oldCats] = await Promise.all([
		Promise.all(allCats.map((cat) =>
			getSnapshotCategory(env.KV, tenantId, newer.id, cat)
				.then((d) => ({ categoryId: cat, name: cat, data: d?.data ?? null })),
		)),
		Promise.all(allCats.map((cat) =>
			getSnapshotCategory(env.KV, tenantId, older.id, cat)
				.then((d) => ({ categoryId: cat, name: cat, data: d?.data ?? null })),
		)),
	]);

	const categoryDiffs = diffSnapshots(oldCats, newCats);
	if (categoryDiffs.length === 0) return null;

	// Filter out suppressed paths
	const rules = await loadSuppressionRules(env.DB, tenantId);
	if (rules.length > 0) {
		for (const catDiff of categoryDiffs) {
			catDiff.changes = catDiff.changes.filter(
				(change) => !isPathSuppressed(catDiff.categoryId, change.path, rules),
			);
		}
	}

	const filteredDiffs = categoryDiffs.filter((d) => d.changes.length > 0);
	if (filteredDiffs.length === 0) return null;

	return buildDriftReport(tenantId, filteredDiffs);
}

/** Create alerts for critical/high severity drifts */
async function createDriftAlerts(env: Env, report: DriftReport): Promise<number> {
	const db = getDb(env);
	const alertable = report.drifts.filter((d) => d.severity === 'critical' || d.severity === 'high');
	if (alertable.length === 0) return 0;

	const description = alertable
		.map((d) => `[${d.severity.toUpperCase()}] ${d.category}: ${d.path} (${d.type})`)
		.join('; ');

	await db.insert(schema.alerts).values({
		id: crypto.randomUUID(),
		tenantId: report.tenantId,
		severity: alertable.some((d) => d.severity === 'critical') ? 'critical' : 'high',
		type: 'drift',
		title: `Config drift detected: ${alertable.length} security-relevant changes`,
		description: description.slice(0, 500),
		source: 'intelligence_engine',
		status: 'active',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	});

	return alertable.length;
}

/** Run drift detection for all active tenants */
export async function runDriftDetection(env: Env): Promise<void> {
	console.log('[DriftDetection] Starting drift detection scan');

	const db = getDb(env);
	const tenants = await db.select().from(schema.organizations).where(eq(schema.organizations.status, 'active'));

	let processed = 0;
	let alertsCreated = 0;

	for (const tenant of tenants) {
		try {
			await trackSyncJob(env.DB, {
				type: 'drift_detection',
				tenantId: tenant.id,
				orgId: tenant.id,
			}, async () => {
				const report = await detectTenantDrift(env, tenant.id);
				if (!report) return { itemsProcessed: 0, itemsFailed: 0 };

				await env.KV.put(`drift:${tenant.id}:latest`, JSON.stringify(report), {
					expirationTtl: 30 * 24 * 60 * 60,
				});

				const newAlerts = await createDriftAlerts(env, report);
				alertsCreated += newAlerts;
				processed++;

				if (newAlerts > 0) {
					await broadcastToTenant(env, tenant.id, {
						type: 'drift',
						resource: 'M365 configuration',
						totalChanges: report.totalChanges,
						alertCount: newAlerts
					});
				}

				return { itemsProcessed: report.totalChanges, itemsFailed: 0 };
			});
		} catch (err) {
			console.error(`[DriftDetection] Failed for tenant ${tenant.id}:`, err);
		}
	}

	console.log(`[DriftDetection] Complete: ${processed} tenants, ${alertsCreated} alerts`);
}
