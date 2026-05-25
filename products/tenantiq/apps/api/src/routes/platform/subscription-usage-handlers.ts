import { nanoid } from 'nanoid';
import { getDb, schema } from '../../lib/db';
import { eq, and, desc, type SQL } from 'drizzle-orm';
import type { Context } from 'hono';
import type { AppEnv } from '../../index';

/** GET /platform/usage — Get usage metrics */
export async function getUsage(c: Context<AppEnv>) {
	const db = getDb(c.env);
	const organizationId = c.req.query('organizationId');
	const period = c.req.query('period');

	try {
		const conditions: SQL<unknown>[] = [];
		if (organizationId) {
			conditions.push(eq(schema.usageMetrics.organizationId, organizationId));
		}
		if (period) {
			conditions.push(eq(schema.usageMetrics.periodStart, `${period}-01`));
		}

		const usage = await db
			.select()
			.from(schema.usageMetrics)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(schema.usageMetrics.periodStart));

		return c.json({ usage });
	} catch (error) {
		console.error('Failed to fetch usage:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
}

/** POST /platform/usage — Record usage metrics */
export async function recordUsage(c: Context<AppEnv>) {
	const db = getDb(c.env);
	const { organizationId, periodStart, metrics } = await c.req.json();

	try {
		const existing = await db
			.select()
			.from(schema.usageMetrics)
			.where(
				and(
					eq(schema.usageMetrics.organizationId, organizationId),
					eq(schema.usageMetrics.periodStart, periodStart)
				)
			)
			.limit(1);

		const now = new Date().toISOString();
		const periodEnd = new Date(periodStart);
		periodEnd.setMonth(periodEnd.getMonth() + 1);

		if (existing.length > 0) {
			await db
				.update(schema.usageMetrics)
				.set(metrics)
				.where(eq(schema.usageMetrics.id, existing[0].id));
		} else {
			await db.insert(schema.usageMetrics).values({
				id: nanoid(),
				organizationId,
				periodStart,
				periodEnd: periodEnd.toISOString(),
				...metrics,
				createdAt: now,
			});
		}

		return c.json({ message: 'Usage recorded successfully' });
	} catch (error) {
		console.error('Failed to record usage:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
}
