import { describe, it, expect } from 'vitest';
import {
	severitySchema,
	alertCategorySchema,
	alertStatusSchema,
	alertFiltersSchema,
	alertUpdateSchema,
	tenantOnboardSchema,
	workflowCreateSchema,
	remediationRequestSchema,
	auditFiltersSchema
} from './schemas';

describe('Enum Schemas', () => {
	it('severitySchema validates correctly', () => {
		expect(severitySchema.safeParse('critical').success).toBe(true);
		expect(severitySchema.safeParse('high').success).toBe(true);
		expect(severitySchema.safeParse('medium').success).toBe(true);
		expect(severitySchema.safeParse('low').success).toBe(true);
		expect(severitySchema.safeParse('invalid').success).toBe(false);
		expect(severitySchema.safeParse('').success).toBe(false);
	});

	it('alertCategorySchema validates correctly', () => {
		expect(alertCategorySchema.safeParse('security').success).toBe(true);
		expect(alertCategorySchema.safeParse('optimization').success).toBe(true);
		expect(alertCategorySchema.safeParse('compliance').success).toBe(true);
		expect(alertCategorySchema.safeParse('operational').success).toBe(true);
		expect(alertCategorySchema.safeParse('other').success).toBe(false);
	});

	it('alertStatusSchema validates correctly', () => {
		expect(alertStatusSchema.safeParse('active').success).toBe(true);
		expect(alertStatusSchema.safeParse('acknowledged').success).toBe(true);
		expect(alertStatusSchema.safeParse('resolved').success).toBe(true);
		expect(alertStatusSchema.safeParse('dismissed').success).toBe(true);
		expect(alertStatusSchema.safeParse('deleted').success).toBe(false);
	});
});

describe('Alert Filters Schema', () => {
	it('should apply defaults for empty input', () => {
		const result = alertFiltersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.limit).toBe(50);
			expect(result.data.severity).toBeUndefined();
			expect(result.data.category).toBeUndefined();
			expect(result.data.status).toBeUndefined();
		}
	});

	it('should coerce string numbers', () => {
		const result = alertFiltersSchema.safeParse({ page: '3', limit: '25' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(3);
			expect(result.data.limit).toBe(25);
		}
	});

	it('should reject page < 1', () => {
		expect(alertFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
		expect(alertFiltersSchema.safeParse({ page: -1 }).success).toBe(false);
	});

	it('should reject limit > 100', () => {
		expect(alertFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
	});

	it('should accept valid filters', () => {
		const result = alertFiltersSchema.safeParse({
			severity: 'critical',
			category: 'security',
			status: 'active',
			page: 2,
			limit: 20
		});
		expect(result.success).toBe(true);
	});
});

describe('Alert Update Schema', () => {
	it('should accept valid status updates', () => {
		expect(alertUpdateSchema.safeParse({ status: 'acknowledged' }).success).toBe(true);
		expect(alertUpdateSchema.safeParse({ status: 'dismissed' }).success).toBe(true);
	});

	it('should reject invalid status values', () => {
		expect(alertUpdateSchema.safeParse({ status: 'active' }).success).toBe(false);
		expect(alertUpdateSchema.safeParse({ status: 'resolved' }).success).toBe(false);
	});
});

describe('Tenant Onboard Schema', () => {
	it('should accept valid tenant data', () => {
		const result = tenantOnboardSchema.safeParse({
			azureTenantId: 'abc-123-def',
			displayName: 'Test Corp'
		});
		expect(result.success).toBe(true);
	});

	it('should reject missing required fields', () => {
		expect(tenantOnboardSchema.safeParse({}).success).toBe(false);
		expect(tenantOnboardSchema.safeParse({ azureTenantId: 'abc' }).success).toBe(false);
		expect(tenantOnboardSchema.safeParse({ displayName: 'Test' }).success).toBe(false);
	});

	it('should reject empty strings', () => {
		expect(tenantOnboardSchema.safeParse({ azureTenantId: '', displayName: 'Test' }).success).toBe(false);
	});

	it('should accept optional domain', () => {
		const result = tenantOnboardSchema.safeParse({
			azureTenantId: 'abc',
			displayName: 'Test',
			domain: 'test.com'
		});
		expect(result.success).toBe(true);
	});
});

describe('Workflow Create Schema', () => {
	it('should accept a valid workflow', () => {
		const result = workflowCreateSchema.safeParse({
			name: 'Security Hardening',
			workflowType: 'remediation',
			triggerType: 'cron',
			steps: [{ action: 'enable_mfa', onFailure: 'skip' }]
		});
		expect(result.success).toBe(true);
	});

	it('should reject empty steps array', () => {
		const result = workflowCreateSchema.safeParse({
			name: 'Empty Workflow',
			workflowType: 'test',
			triggerType: 'manual',
			steps: []
		});
		expect(result.success).toBe(false);
	});

	it('should validate triggerType enum', () => {
		const base = {
			name: 'Test',
			workflowType: 'test',
			steps: [{ action: 'test', onFailure: 'skip' }]
		};

		expect(workflowCreateSchema.safeParse({ ...base, triggerType: 'cron' }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, triggerType: 'webhook' }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, triggerType: 'manual' }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, triggerType: 'conditional' }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, triggerType: 'invalid' }).success).toBe(false);
	});

	it('should validate onFailure enum in steps', () => {
		const base = { name: 'Test', workflowType: 'test', triggerType: 'manual' as const };

		expect(workflowCreateSchema.safeParse({ ...base, steps: [{ action: 'a', onFailure: 'skip' }] }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, steps: [{ action: 'a', onFailure: 'abort' }] }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, steps: [{ action: 'a', onFailure: 'retry' }] }).success).toBe(true);
		expect(workflowCreateSchema.safeParse({ ...base, steps: [{ action: 'a', onFailure: 'ignore' }] }).success).toBe(false);
	});

	it('should default requiresApproval to false', () => {
		const result = workflowCreateSchema.safeParse({
			name: 'Test',
			workflowType: 'test',
			triggerType: 'manual',
			steps: [{ action: 'test', onFailure: 'skip' }]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.requiresApproval).toBe(false);
		}
	});
});

describe('Remediation Request Schema', () => {
	it('should apply defaults', () => {
		const result = remediationRequestSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.dryRun).toBe(false);
			expect(result.data.confirm).toBe(false);
		}
	});

	it('should accept explicit values', () => {
		const result = remediationRequestSchema.safeParse({ dryRun: true, confirm: true });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.dryRun).toBe(true);
			expect(result.data.confirm).toBe(true);
		}
	});
});

describe('Audit Filters Schema', () => {
	it('should apply defaults', () => {
		const result = auditFiltersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.limit).toBe(50);
		}
	});

	it('should validate optional filters', () => {
		const result = auditFiltersSchema.safeParse({
			actor: 'admin@test.com',
			action: 'remediation.executed'
		});
		expect(result.success).toBe(true);
	});
});
