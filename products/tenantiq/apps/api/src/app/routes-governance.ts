import type { Hono } from 'hono';
import { governanceRoutes as governance } from '../routes/governance';
import { configSnapshotRoutes as configSnapshots } from '../routes/config-snapshots';
import { configDriftRoutes as configDrifts } from '../routes/config-drifts';
import { driftSuppressionRoutes } from '../routes/drift-suppression';
import { snapshotScheduleRoutes } from '../routes/snapshot-schedule';
import { snapshotExportRoutes } from '../routes/snapshot-export';
import { configExportRoutes } from '../routes/config-export';
import { backupHealthRoutes } from '../routes/backup-health';
import { backupDataRoutes } from '../routes/backup-data';
import { guestReviewRoutes } from '../routes/guest-review';
import { groupCleanupRoutes } from '../routes/group-cleanup';
import { siteLifecycleRoutes } from '../routes/site-lifecycle';
import { brandingRoutes } from '../routes/branding';
import { unifiedSearchRoutes } from '../routes/unified-search';
import { shareRoutes } from '../routes/share';
import type { AppEnv } from './types';

export function registerGovernanceRoutes(app: Hono<AppEnv>) {
	app.route('/api/governance', governance);
	app.route('/api/governance/sites', siteLifecycleRoutes);
	app.route('/api/config-snapshots', configSnapshots);
	app.route('/api/config-snapshots', snapshotScheduleRoutes);
	app.route('/api/config-snapshots', snapshotExportRoutes);
	app.route('/api/config-drifts', configDrifts);
	app.route('/api/config-drifts/suppression-rules', driftSuppressionRoutes);
	app.route('/api/config', configExportRoutes);
	app.route('/api/backup-health', backupHealthRoutes);
	app.route('/api/backups', backupDataRoutes);
	app.route('/api/guest-review', guestReviewRoutes);
	app.route('/api/group-cleanup', groupCleanupRoutes);
	app.route('/api/branding', brandingRoutes);
	app.route('/api/search', unifiedSearchRoutes);
	app.route('/api/share', shareRoutes);
}
