/**
 * Bulk User Operations Routes
 *
 * Execute batch operations (license assignment, disable, password reset, etc.)
 * and CSV-based user imports. Operations are queued to REMEDIATION_QUEUE.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const VALID_OPS = ['assign_license', 'remove_license', 'disable', 'reset_password', 'add_to_group'] as const;
type BulkOp = (typeof VALID_OPS)[number];
const MAX_BATCH_SIZE = 100;
const CSV_COLUMNS = ['email', 'displayName', 'department', 'jobTitle', 'licenses'] as const;

interface BatchRecord {
	batchId: string;
	tenantId: string;
	operation: BulkOp;
	userIds: string[];
	params?: Record<string, string>;
	total: number;
	completed: number;
	failed: number;
	status: 'queued' | 'running' | 'completed' | 'partial_failure';
	createdAt: string;
	createdBy: string;
}

interface CsvRow {
	email: string;
	displayName: string;
	department: string;
	jobTitle: string;
	licenses: string;
}

/** Split a CSV line respecting quoted fields (RFC 4180) */
function splitCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
			else if (ch === '"') { inQuotes = false; }
			else { current += ch; }
		} else {
			if (ch === '"') { inQuotes = true; }
			else if (ch === ',') { fields.push(current.trim()); current = ''; }
			else { current += ch; }
		}
	}
	fields.push(current.trim());
	return fields;
}

function parseCsv(raw: string): { rows: CsvRow[]; errors: { row: number; error: string }[] } {
	const lines = raw.trim().split('\n');
	if (lines.length < 2) return { rows: [], errors: [{ row: 0, error: 'CSV must have header and at least one data row' }] };

	const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
	const missing = CSV_COLUMNS.filter((col) => !header.includes(col.toLowerCase()));
	if (missing.length) return { rows: [], errors: [{ row: 0, error: `Missing columns: ${missing.join(', ')}` }] };

	const rows: CsvRow[] = [];
	const errors: { row: number; error: string }[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = splitCsvLine(lines[i]);
		if (values.length < CSV_COLUMNS.length) {
			errors.push({ row: i, error: 'Insufficient columns' });
			continue;
		}
		const emailIdx = header.indexOf('email');
		const email = values[emailIdx];
		if (!email || !email.includes('@')) {
			errors.push({ row: i, error: `Invalid email: ${email}` });
			continue;
		}
		rows.push({
			email: values[header.indexOf('email')],
			displayName: values[header.indexOf('displayname')],
			department: values[header.indexOf('department')],
			jobTitle: values[header.indexOf('jobtitle')],
			licenses: values[header.indexOf('licenses')],
		});
	}

	return { rows, errors };
}

const bulk = new Hono<AppEnv>();

bulk.use('*', authMiddleware);
bulk.use('*', standardRateLimit);

/** POST /api/users/bulk — execute bulk operation */
bulk.post('/bulk', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{
		operation: BulkOp;
		userIds: string[];
		params?: { skuId?: string; groupId?: string };
	}>();

	if (!body.operation || !VALID_OPS.includes(body.operation)) {
		return c.json({ error: 'Bad Request', message: `operation must be one of: ${VALID_OPS.join(', ')}` }, 400);
	}
	if (!body.userIds?.length) {
		return c.json({ error: 'Bad Request', message: 'userIds array is required' }, 400);
	}
	if (body.userIds.length > MAX_BATCH_SIZE) {
		return c.json({ error: 'Bad Request', message: `Maximum ${MAX_BATCH_SIZE} users per batch` }, 400);
	}

	if (['assign_license', 'remove_license'].includes(body.operation) && !body.params?.skuId) {
		return c.json({ error: 'Bad Request', message: 'params.skuId required for license operations' }, 400);
	}
	if (body.operation === 'add_to_group' && !body.params?.groupId) {
		return c.json({ error: 'Bad Request', message: 'params.groupId required for add_to_group' }, 400);
	}

	const batchId = crypto.randomUUID();
	const record: BatchRecord = {
		batchId, tenantId, operation: body.operation, userIds: body.userIds,
		params: body.params as Record<string, string>, total: body.userIds.length,
		completed: 0, failed: 0, status: 'queued',
		createdAt: new Date().toISOString(), createdBy: c.get('userId') ?? '',
	};

	await c.env.KV.put(`batch:${tenantId}:${batchId}`, JSON.stringify(record));
	await c.env.REMEDIATION_QUEUE.send({
		type: 'bulk_user_operation', batchId, tenantId,
		operation: body.operation, userIds: body.userIds, params: body.params,
	});

	return c.json({ batchId, operationCount: body.userIds.length, status: 'queued' }, 202);
});

/** GET /api/users/bulk/:batchId — check batch progress */
bulk.get('/bulk/:batchId', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const batchId = c.req.param('batchId');

	const raw = await c.env.KV.get(`batch:${tenantId}:${batchId}`);
	if (!raw) return c.json({ error: 'Not Found', message: 'Batch not found' }, 404);

	const record: BatchRecord = JSON.parse(raw);
	return c.json({
		batchId: record.batchId, total: record.total,
		completed: record.completed, failed: record.failed, status: record.status,
	});
});

/** POST /api/users/import — CSV import for bulk user creation */
bulk.post('/import', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{ csv: string }>();

	if (!body.csv) {
		return c.json({ error: 'Bad Request', message: 'csv field is required' }, 400);
	}

	const { rows, errors } = parseCsv(body.csv);
	const importId = crypto.randomUUID();

	if (rows.length > 0) {
		await c.env.KV.put(`import:${tenantId}:${importId}`, JSON.stringify({ importId, rows, status: 'queued' }));
		await c.env.REMEDIATION_QUEUE.send({
			type: 'bulk_user_import', importId, tenantId, users: rows,
		});
	}

	return c.json({
		importId, rowCount: rows.length + errors.length,
		validRows: rows.length, invalidRows: errors,
	}, rows.length > 0 ? 202 : 400);
});

export { bulk as userBulkRoutes };
export default bulk;
