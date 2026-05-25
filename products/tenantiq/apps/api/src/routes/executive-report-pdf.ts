import { getLicensesByTenant, getUsersByTenant, getTenantById } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { getDb } from '../lib/db';
import { generateReportHTML, type ReportData } from '../lib/pdf-generator';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

/**
 * Executive Report PDF Preview
 *
 * Returns branded HTML that the browser can print to PDF via window.print().
 */

const executiveReportPdf = new Hono<AppEnv>();

executiveReportPdf.use('*', authMiddleware);
executiveReportPdf.use('*', standardRateLimit);

/**
 * GET /api/executive-report/pdf-preview
 * Returns HTML suitable for PDF printing via window.print()
 */
executiveReportPdf.get('/pdf-preview', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const [tenant, users, licenses] = await Promise.all([
			getTenantById(db as any, tenantId),
			getUsersByTenant(db as any, tenantId),
			getLicensesByTenant(db as any, tenantId),
		]);

		const totalUsers = users.length;
		const activeUsers = users.filter((u) => {
			if (!u.lastSignIn) return false;
			return Date.now() - new Date(String(u.lastSignIn)).getTime() < 30 * 24 * 60 * 60 * 1000;
		}).length;
		const totalLicenses = licenses.reduce((s, l) => s + (l.total || 0), 0);
		const assignedLicenses = licenses.reduce((s, l) => s + (l.assigned || 0), 0);
		const monthlyCost = licenses.reduce(
			(s, l) => s + (Number(l.costPerUnit) || 0) * (l.assigned || 0),
			0,
		);

		const reportData: ReportData = {
			title: `${tenant?.displayName || 'Tenant'} Executive Report`,
			subtitle: 'Microsoft 365 Security, Compliance & Cost Summary',
			generatedAt: new Date().toISOString(),
			sections: [
				{
					heading: 'User Overview',
					content: `Summary of user activity and license utilization for ${tenant?.displayName || 'your tenant'}.`,
					metrics: [
						{ label: 'Total Users', value: String(totalUsers) },
						{ label: 'Active Users', value: String(activeUsers) },
						{ label: 'Total Licenses', value: String(totalLicenses) },
						{ label: 'Assigned', value: String(assignedLicenses) },
					],
				},
				{
					heading: 'Cost Summary',
					content: 'Monthly license spend and optimization opportunities.',
					metrics: [
						{ label: 'Monthly Cost', value: `$${monthlyCost.toLocaleString()}` },
						{
							label: 'Utilization',
							value:
								totalLicenses > 0
									? `${Math.round((assignedLicenses / totalLicenses) * 100)}%`
									: 'N/A',
						},
					],
				},
			],
		};

		const html = generateReportHTML(reportData);
		return c.html(html);
	} catch (error) {
		console.error('PDF preview failed:', error);
		return c.json(
			{ error: 'Internal Server Error', message: 'Failed to generate PDF preview' },
			500,
		);
	}
});

export { executiveReportPdf };
export default executiveReportPdf;
