import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../connection';
import { workflows, workflowRuns } from '../schema-d1';

type DB = Database;

export async function getWorkflowsByTenant(db: DB, tenantId: string) {
	return db
		.select()
		.from(workflows)
		.where(eq(workflows.tenantId, tenantId))
		.orderBy(desc(workflows.createdAt));
}

export async function getWorkflowById(db: DB, workflowId: string) {
	const result = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
	return result[0] ?? null;
}

export async function createWorkflow(db: DB, data: typeof workflows.$inferInsert) {
	const result = await db.insert(workflows).values(data).returning();
	return result[0];
}

export async function updateWorkflow(
	db: DB,
	workflowId: string,
	data: Partial<typeof workflows.$inferInsert>,
) {
	return db.update(workflows).set(data).where(eq(workflows.id, workflowId)).returning();
}

export async function getWorkflowRunsByWorkflow(
	db: DB,
	workflowId: string,
	filters?: { limit?: number; offset?: number },
) {
	return db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.workflowId, workflowId))
		.orderBy(desc(workflowRuns.startedAt))
		.limit(filters?.limit ?? 20)
		.offset(filters?.offset ?? 0)
		.catch(() => [] as Awaited<ReturnType<typeof db.select>>);
}

export async function createWorkflowRun(db: DB, data: typeof workflowRuns.$inferInsert) {
	const result = await db.insert(workflowRuns).values(data).returning();
	return result[0];
}

export async function updateWorkflowRun(
	db: DB,
	runId: string,
	data: Partial<typeof workflowRuns.$inferInsert>,
) {
	return db.update(workflowRuns).set(data).where(eq(workflowRuns.id, runId)).returning();
}

/** D1 workflows table uses `type` for kind-of-workflow; trigger is embedded in `conditions`
 *  JSON. For now, return all enabled workflows of the given type. Callers filter further. */
export async function getEnabledWorkflowsByTrigger(db: DB, tenantId: string, triggerType: string) {
	return db
		.select()
		.from(workflows)
		.where(
			and(
				eq(workflows.tenantId, tenantId),
				eq(workflows.enabled, 1),
				eq(workflows.type, triggerType),
			),
		);
}

export async function getWorkflowRunById(db: DB, runId: string) {
	const result = await db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.id, runId))
		.limit(1)
		.catch(() => [] as Awaited<ReturnType<typeof db.select>>);
	return result[0] ?? null;
}
