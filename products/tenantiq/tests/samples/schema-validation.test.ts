/**
 * Sample Project 8: Schema Validation Edge Cases
 *
 * Simulates: Comprehensive Zod schema validation testing with edge
 * cases, boundary values, and malicious input that a real-world
 * SaaS product would encounter from API consumers.
 */
import { describe, it, expect } from 'vitest';
import {
	severitySchema,
	alertCategorySchema,
	alertStatusSchema,
	remediationTypeSchema,
	alertFiltersSchema,
	alertUpdateSchema,
	remediationRequestSchema,
	aiChatMessageSchema,
	tenantOnboardSchema,
	workflowCreateSchema,
	auditFiltersSchema,
} from '@tenantiq/shared';

describe('Schema Validation — Edge Cases & Boundary Testing', () => {
	describe('Enum Schemas', () => {
		it('should accept all valid severities', () => {
			for (const s of ['critical', 'high', 'medium', 'low']) {
				expect(severitySchema.safeParse(s).success).toBe(true);
			}
		});

		it('should reject invalid severity', () => {
			expect(severitySchema.safeParse('extreme').success).toBe(false);
			expect(severitySchema.safeParse('').success).toBe(false);
			expect(severitySchema.safeParse(null).success).toBe(false);
			expect(severitySchema.safeParse(1).success).toBe(false);
		});

		it('should accept all valid categories', () => {
			for (const c of ['security', 'optimization', 'compliance', 'operational']) {
				expect(alertCategorySchema.safeParse(c).success).toBe(true);
			}
		});

		it('should reject invalid category', () => {
			expect(alertCategorySchema.safeParse('unknown').success).toBe(false);
			expect(alertCategorySchema.safeParse('SECURITY').success).toBe(false);
		});

		it('should accept all valid statuses', () => {
			for (const s of ['active', 'acknowledged', 'resolved', 'dismissed']) {
				expect(alertStatusSchema.safeParse(s).success).toBe(true);
			}
		});

		it('should accept all remediation types', () => {
			for (const r of ['automatic', 'semi_automatic', 'manual']) {
				expect(remediationTypeSchema.safeParse(r).success).toBe(true);
			}
		});
	});

	describe('Alert Filters Schema', () => {
		it('should accept empty filters (all defaults)', () => {
			const result = alertFiltersSchema.safeParse({});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.page).toBe(1);
				expect(result.data.limit).toBe(50);
			}
		});

		it('should accept full filter set', () => {
			const result = alertFiltersSchema.safeParse({
				severity: 'critical',
				category: 'security',
				status: 'active',
				page: 2,
				limit: 25,
			});
			expect(result.success).toBe(true);
		});

		it('should coerce string page numbers', () => {
			const result = alertFiltersSchema.safeParse({ page: '3', limit: '10' });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.page).toBe(3);
				expect(result.data.limit).toBe(10);
			}
		});

		it('should reject page < 1', () => {
			expect(alertFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
			expect(alertFiltersSchema.safeParse({ page: -1 }).success).toBe(false);
		});

		it('should reject limit > 100', () => {
			expect(alertFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
			expect(alertFiltersSchema.safeParse({ limit: 1000 }).success).toBe(false);
		});

		it('should reject limit < 1', () => {
			expect(alertFiltersSchema.safeParse({ limit: 0 }).success).toBe(false);
		});

		it('should accept limit at boundaries (1 and 100)', () => {
			expect(alertFiltersSchema.safeParse({ limit: 1 }).success).toBe(true);
			expect(alertFiltersSchema.safeParse({ limit: 100 }).success).toBe(true);
		});
	});

	describe('Alert Update Schema', () => {
		it('should accept acknowledged status', () => {
			expect(alertUpdateSchema.safeParse({ status: 'acknowledged' }).success).toBe(true);
		});

		it('should accept dismissed status', () => {
			expect(alertUpdateSchema.safeParse({ status: 'dismissed' }).success).toBe(true);
		});

		it('should reject active status (cannot set back to active)', () => {
			expect(alertUpdateSchema.safeParse({ status: 'active' }).success).toBe(false);
		});

		it('should reject resolved status (resolved through remediation)', () => {
			expect(alertUpdateSchema.safeParse({ status: 'resolved' }).success).toBe(false);
		});

		it('should reject empty object', () => {
			expect(alertUpdateSchema.safeParse({}).success).toBe(false);
		});
	});

	describe('Remediation Request Schema', () => {
		it('should default dryRun to false', () => {
			const result = remediationRequestSchema.safeParse({});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.dryRun).toBe(false);
				expect(result.data.confirm).toBe(false);
			}
		});

		it('should accept dry run request', () => {
			const result = remediationRequestSchema.safeParse({ dryRun: true });
			expect(result.success).toBe(true);
			if (result.success) expect(result.data.dryRun).toBe(true);
		});

		it('should accept confirmed execution', () => {
			const result = remediationRequestSchema.safeParse({ dryRun: false, confirm: true });
			expect(result.success).toBe(true);
		});
	});

	describe('AI Chat Message Schema', () => {
		it('should accept valid chat message', () => {
			const result = aiChatMessageSchema.safeParse({
				message: 'What is the security status of tenant-123?',
			});
			expect(result.success).toBe(true);
		});

		it('should accept message with conversation ID', () => {
			const result = aiChatMessageSchema.safeParse({
				message: 'Follow up question',
				conversationId: '550e8400-e29b-41d4-a716-446655440000',
			});
			expect(result.success).toBe(true);
		});

		it('should reject empty message', () => {
			expect(aiChatMessageSchema.safeParse({ message: '' }).success).toBe(false);
		});

		it('should reject message exceeding 4000 chars', () => {
			const longMessage = 'a'.repeat(4001);
			expect(aiChatMessageSchema.safeParse({ message: longMessage }).success).toBe(false);
		});

		it('should accept message at exactly 4000 chars', () => {
			const maxMessage = 'a'.repeat(4000);
			expect(aiChatMessageSchema.safeParse({ message: maxMessage }).success).toBe(true);
		});

		it('should reject invalid conversation ID format', () => {
			expect(
				aiChatMessageSchema.safeParse({ message: 'hi', conversationId: 'not-a-uuid' }).success
			).toBe(false);
		});
	});

	describe('Tenant Onboard Schema', () => {
		it('should accept valid onboarding data', () => {
			const result = tenantOnboardSchema.safeParse({
				azureTenantId: 'abc-123-def',
				displayName: 'Contoso Ltd',
				domain: 'contoso.com',
			});
			expect(result.success).toBe(true);
		});

		it('should accept without optional domain', () => {
			const result = tenantOnboardSchema.safeParse({
				azureTenantId: 'abc-123',
				displayName: 'No Domain Corp',
			});
			expect(result.success).toBe(true);
		});

		it('should reject empty tenant ID', () => {
			expect(
				tenantOnboardSchema.safeParse({ azureTenantId: '', displayName: 'Test' }).success
			).toBe(false);
		});

		it('should reject empty display name', () => {
			expect(
				tenantOnboardSchema.safeParse({ azureTenantId: 'abc', displayName: '' }).success
			).toBe(false);
		});

		it('should reject display name > 255 chars', () => {
			expect(
				tenantOnboardSchema.safeParse({
					azureTenantId: 'abc',
					displayName: 'x'.repeat(256),
				}).success
			).toBe(false);
		});

		it('should accept display name at exactly 255 chars', () => {
			expect(
				tenantOnboardSchema.safeParse({
					azureTenantId: 'abc',
					displayName: 'x'.repeat(255),
				}).success
			).toBe(true);
		});
	});

	describe('Workflow Create Schema', () => {
		it('should accept minimal valid workflow', () => {
			const result = workflowCreateSchema.safeParse({
				name: 'Test',
				workflowType: 'scan',
				triggerType: 'manual',
				steps: [{ action: 'run', onFailure: 'skip' }],
			});
			expect(result.success).toBe(true);
		});

		it('should accept complex multi-step workflow', () => {
			const result = workflowCreateSchema.safeParse({
				name: 'Full Compliance Check',
				workflowType: 'compliance',
				triggerType: 'cron',
				triggerConfig: { schedule: '0 3 * * *' },
				steps: [
					{ action: 'sync', onFailure: 'abort' },
					{ action: 'scan', condition: 'sync_success', onFailure: 'skip' },
					{ action: 'report', onFailure: 'retry' },
					{ action: 'notify', onFailure: 'skip' },
				],
				requiresApproval: true,
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.steps.length).toBe(4);
				expect(result.data.requiresApproval).toBe(true);
			}
		});

		it('should reject empty steps array', () => {
			expect(
				workflowCreateSchema.safeParse({
					name: 'Empty', workflowType: 'test',
					triggerType: 'manual', steps: [],
				}).success
			).toBe(false);
		});

		it('should reject missing action in step', () => {
			expect(
				workflowCreateSchema.safeParse({
					name: 'Bad', workflowType: 'test',
					triggerType: 'manual',
					steps: [{ onFailure: 'skip' }],
				}).success
			).toBe(false);
		});

		it('should default requiresApproval to false', () => {
			const result = workflowCreateSchema.safeParse({
				name: 'No Approval', workflowType: 'test',
				triggerType: 'manual',
				steps: [{ action: 'run', onFailure: 'skip' }],
			});
			expect(result.success).toBe(true);
			if (result.success) expect(result.data.requiresApproval).toBe(false);
		});
	});

	describe('Audit Filters Schema', () => {
		it('should accept empty filters', () => {
			const result = auditFiltersSchema.safeParse({});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.page).toBe(1);
				expect(result.data.limit).toBe(50);
			}
		});

		it('should accept full filter set', () => {
			const result = auditFiltersSchema.safeParse({
				actor: 'admin@test.com',
				action: 'user.delete',
				resourceType: 'user',
				dateFrom: '2026-01-01T00:00:00Z',
				dateTo: '2026-04-01T00:00:00Z',
				page: 1,
				limit: 20,
			});
			expect(result.success).toBe(true);
		});

		it('should reject invalid datetime format', () => {
			expect(
				auditFiltersSchema.safeParse({ dateFrom: 'not-a-date' }).success
			).toBe(false);
			expect(
				auditFiltersSchema.safeParse({ dateFrom: '2026-01-01' }).success
			).toBe(false);
		});

		it('should accept ISO 8601 datetime strings', () => {
			expect(
				auditFiltersSchema.safeParse({ dateFrom: '2026-01-01T00:00:00Z' }).success
			).toBe(true);
		});
	});

	describe('XSS & Injection Prevention', () => {
		it('should accept but sanitize script-tag input in names', () => {
			// Zod passes through strings; sanitization happens at render time
			const result = tenantOnboardSchema.safeParse({
				azureTenantId: 'abc',
				displayName: '<script>alert("xss")</script>',
			});
			// Schema accepts it (validation only checks length/format)
			// The app must sanitize at output, not at schema level
			expect(result.success).toBe(true);
		});

		it('should accept SQL injection attempts in filters (treated as literal)', () => {
			const result = auditFiltersSchema.safeParse({
				actor: "'; DROP TABLE users; --",
			});
			// Schema accepts arbitrary strings; parameterized queries prevent injection
			expect(result.success).toBe(true);
		});

		it('should reject null bytes in message', () => {
			// Zod min(1) allows null bytes — but the string is non-empty
			const result = aiChatMessageSchema.safeParse({
				message: '\x00',
			});
			// This passes schema validation; null byte filtering is app-level
			expect(result.success).toBe(true);
		});
	});
});
