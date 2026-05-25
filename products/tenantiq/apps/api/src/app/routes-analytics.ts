import type { Hono } from 'hono';
import savingsLeaderboard from '../routes/savings-leaderboard';
import { savingsReportRoutes } from '../routes/savings-report';
import licenseAutopilot from '../routes/license-autopilot';
import executiveReport from '../routes/executive-report';
import executiveReportPdf from '../routes/executive-report-pdf';
import usageHeatmap from '../routes/usage-heatmap';
import { mspRoutes } from '../routes/msp';
import { mspBenchmarkRoutes } from '../routes/msp-benchmark';
import { mspProfitRoutes } from '../routes/msp-profit';
import { reportBuilderRoutes } from '../routes/report-builder';
import { storageAnalyticsRoutes } from '../routes/storage-analytics';
import type { AppEnv } from './types';

export function registerAnalyticsRoutes(app: Hono<AppEnv>) {
	// cost-optimization routes moved to routes-tenant.ts to inherit tokenforgeMiddleware.
	app.route('/api/savings', savingsLeaderboard);
	app.route('/api/savings-report', savingsReportRoutes);
	app.route('/api/license-autopilot', licenseAutopilot);
	app.route('/api/executive-report', executiveReport);
	app.route('/api/executive-report', executiveReportPdf);
	app.route('/api/usage-heatmap', usageHeatmap);
	app.route('/api/msp', mspRoutes);
	app.route('/api/msp-benchmark', mspBenchmarkRoutes);
	app.route('/api/msp-profit', mspProfitRoutes);
	app.route('/api/report-builder', reportBuilderRoutes);
	app.route('/api/storage-analytics', storageAnalyticsRoutes);
}
