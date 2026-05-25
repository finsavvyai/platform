import { z } from 'zod';

// ============================================================
// Zod validation schemas — shared between frontend and backend
// ============================================================

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const alertCategorySchema = z.enum(['security', 'optimization', 'compliance', 'operational']);
export const alertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'dismissed']);
export const remediationTypeSchema = z.enum(['automatic', 'semi_automatic', 'manual']);

// Alert filters
export const alertFiltersSchema = z.object({
	severity: severitySchema.optional(),
	category: alertCategorySchema.optional(),
	status: alertStatusSchema.optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

// Alert update
export const alertUpdateSchema = z.object({
	status: z.enum(['acknowledged', 'dismissed'])
});

// Remediation request
export const remediationRequestSchema = z.object({
	dryRun: z.boolean().default(false),
	confirm: z.boolean().default(false)
});

// AI chat message
export const aiChatMessageSchema = z.object({
	message: z.string().min(1).max(4000),
	conversationId: z.string().uuid().optional()
});

// Tenant onboarding
export const tenantOnboardSchema = z.object({
	azureTenantId: z.string().min(1),
	displayName: z.string().min(1).max(255),
	domain: z.string().optional()
});

// Workflow creation
export const workflowCreateSchema = z.object({
	name: z.string().min(1).max(255),
	workflowType: z.string().min(1),
	triggerType: z.enum(['cron', 'webhook', 'manual', 'conditional']),
	triggerConfig: z.unknown().optional(),
	steps: z
		.array(
			z.object({
				action: z.string().min(1),
				condition: z.string().optional(),
				onFailure: z.enum(['skip', 'abort', 'retry'])
			})
		)
		.min(1),
	requiresApproval: z.boolean().default(false)
});

// Audit log filters
export const auditFiltersSchema = z.object({
	actor: z.string().optional(),
	action: z.string().optional(),
	resourceType: z.string().optional(),
	dateFrom: z.string().datetime().optional(),
	dateTo: z.string().datetime().optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});
