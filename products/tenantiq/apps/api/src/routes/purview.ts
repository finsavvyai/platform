/**
 * Purview API Routes — DLP policies, sensitivity labels, and overview.
 * Provides compliance intelligence for the Purview dashboard.
 */

import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';
import { getDb } from '../lib/db';
import { getTenantById } from '@tenantiq/db';
import { fetchDLPPolicies, analyzeDLPCompliance } from '../lib/purview/dlp-engine';
import { fetchSensitivityLabels, analyzeLabelAdoption } from '../lib/purview/labels-engine';
import type { AppEnv } from '../app/types';

const purview = new Hono<AppEnv>();

purview.use('*', authMiddleware);
purview.use('*', standardRateLimit);

/** GET /purview/dlp — DLP policy status and compliance score */
purview.get('/dlp', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const policies = await fetchDLPPolicies(graph);
		const compliance = analyzeDLPCompliance(policies);

		return c.json({
			policies,
			compliance,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Purview DLP fetch failed:', error);
		return c.json({
			error: 'Failed to fetch DLP data',
		}, 500);
	}
});

/** GET /purview/labels — Sensitivity label inventory and adoption */
purview.get('/labels', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const labels = await fetchSensitivityLabels(graph);
		const adoption = analyzeLabelAdoption(labels);

		return c.json({
			labels,
			adoption,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Purview labels fetch failed:', error);
		return c.json({
			error: 'Failed to fetch sensitivity labels',
		}, 500);
	}
});

/** GET /purview/overview — Combined purview dashboard data */
purview.get('/overview', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);

		const [policies, labels] = await Promise.all([
			fetchDLPPolicies(graph),
			fetchSensitivityLabels(graph),
		]);

		const dlpCompliance = analyzeDLPCompliance(policies);
		const labelAdoption = analyzeLabelAdoption(labels);

		const overallScore = Math.round(
			(dlpCompliance.score + labelAdoption.adoptionScore) / 2,
		);

		const recommendations = [
			...dlpCompliance.recommendations,
			...labelAdoption.recommendations,
		];

		return c.json({
			dlpScore: dlpCompliance.score,
			labelAdoptionScore: labelAdoption.adoptionScore,
			overallScore,
			policies,
			labels,
			recommendations,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Purview overview failed:', error);
		return c.json({
			error: 'Failed to load Purview overview',
		}, 500);
	}
});

export default purview;
