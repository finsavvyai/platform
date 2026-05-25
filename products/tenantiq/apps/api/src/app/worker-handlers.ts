import { runComplianceScan } from '../cron/compliance-scan';
import { runSecurityScan } from '../cron/security-scan';
import { runUserSync } from '../cron/user-sync';
import { runScheduledRemediations } from '../cron/scheduled-remediation';
import { runWebhookRetries } from '../cron/webhook-retry';
import { runWorkflowTriggerCheck } from '../cron/workflow-trigger';
import { runGuestReview } from '../cron/guest-review';
import { runGroupCleanup } from '../cron/group-cleanup';
import { runNightlyBackup } from '../cron/nightly-backup';
import { runDriftDetection } from '../cron/drift-detection';
import { runScheduledSnapshots } from '../cron/scheduled-snapshots';
import { runStorageScan } from '../cron/storage-scan';
import { runTenantHealthCheck } from '../cron/tenant-health';
import { runSsoCertMonitor } from '../cron/sso-cert-monitor';
import { runConnectWiseSync } from '../cron/connectwise-sync';
import { runPSASync } from '../cron/psa-sync';
import { runAccountPurge } from '../cron/account-purge';
import { runAutonomousAuditor } from '../cron/autonomous-auditor';
import { runAutoFixScanner } from '../cron/auto-fix-scanner';
import { logger as appLogger } from '../lib/logger';
import { sendNotification } from '../queues/notification-sender';
import { executeRemediation } from '../queues/remediation-executor';
import { executeAutoFix } from '../queues/auto-fix-handler';
import { processScanResult } from '../queues/scan-processor';
import type { Env } from './types';

export async function scheduledHandler(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
	switch (event.cron) {
		case '0 */6 * * *':
			ctx.waitUntil(runUserSync(env));
			ctx.waitUntil(runAutonomousAuditor(env));
			break;
		case '0 * * * *':
			ctx.waitUntil(runSecurityScan(env));
			ctx.waitUntil(runConnectWiseSync(env, true));
			ctx.waitUntil(runPSASync(env, ['datto', 'kaseya'], true));
			ctx.waitUntil(runAutoFixScanner(env));
			break;
		case '0 2 * * *':
			ctx.waitUntil(runNightlyBackup(env));
			ctx.waitUntil(runScheduledSnapshots(env));
			break;
		case '0 3 * * *':
			ctx.waitUntil(runComplianceScan(env));
			ctx.waitUntil(import('../cron/scheduled-scans').then(m => m.runScheduledScans(env)));
			ctx.waitUntil(runGuestReview(env));
			ctx.waitUntil(runGroupCleanup(env));
			ctx.waitUntil(runDriftDetection(env));
			ctx.waitUntil(runAccountPurge(env));
			break;
		case '0 3 * * 0':
			ctx.waitUntil(runStorageScan(env));
			break;
		case '*/15 * * * *':
			ctx.waitUntil(runWorkflowTriggerCheck(env));
			ctx.waitUntil(runTenantHealthCheck(env));
			ctx.waitUntil(runConnectWiseSync(env, false));
			ctx.waitUntil(runPSASync(env, ['datto', 'kaseya'], false));
			break;
		case '*/5 * * * *':
			ctx.waitUntil(runWebhookRetries(env));
			ctx.waitUntil(runScheduledRemediations(env));
			break;
		case '0 4 * * *': // Daily at 4am UTC — SSO cert expiry monitor
			ctx.waitUntil(runSsoCertMonitor(env));
			break;
	}
}

export async function queueHandler(batch: MessageBatch, env: Env) {
	const queueLogger = appLogger.child({ queue: batch.queue });

	switch (batch.queue) {
		case 'scan-results':
			for (const message of batch.messages) {
				try {
					await processScanResult(message.body, env);
					message.ack();
				} catch (err) {
					queueLogger.error('Scan processing failed', err);
					message.retry();
				}
			}
			return;
		case 'remediation-jobs':
			for (const message of batch.messages) {
				try {
					const body = message.body as { type?: string };
					if (body?.type === 'auto-fix') {
						await executeAutoFix(message.body, env);
					} else {
						await executeRemediation(message.body, env);
					}
					message.ack();
				} catch (err) {
					queueLogger.error('Remediation failed', err);
					message.retry();
				}
			}
			return;
		case 'notifications':
			for (const message of batch.messages) {
				try {
					await sendNotification(message.body, env);
					message.ack();
				} catch (err) {
					queueLogger.error('Notification failed', err);
					message.retry();
				}
			}
	}
}
