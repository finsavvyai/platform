/**
 * MCP resources for TenantIQ — long-form context Claude can attach to a turn.
 *
 * Resources are different from tools: tools are *invoked* (action verb),
 * resources are *referenced* (noun, "give me the latest version of X"). We
 * expose 3 stable URIs that wrap dynamic data so Claude can include them as
 * conversation context without an explicit tool call.
 *
 * Spec: https://modelcontextprotocol.io/specification/server/resources
 */
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';

export interface McpResource {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

export const RESOURCES: McpResource[] = [
	{
		uri: 'tenantiq://org/overview',
		name: 'MSP org overview',
		description: 'Every tenant the calling MSP manages with last sync, plan, and current posture summary.',
		mimeType: 'application/json',
	},
	{
		uri: 'tenantiq://compliance/frameworks',
		name: 'Compliance frameworks catalog',
		description: 'Frameworks TenantIQ evaluates (SOC 2, HIPAA, GDPR, ISO 27001:2022 Annex A) with control counts.',
		mimeType: 'application/json',
	},
	{
		uri: 'tenantiq://schema/finding',
		name: 'TenantIQ finding shape',
		description: 'JSON Schema describing the shape of findings returned by any *_posture tool — useful to ground Claude when reasoning over outputs.',
		mimeType: 'application/json',
	},
];

export async function readResource(c: Context<AppEnv>, uri: string): Promise<string | null> {
	const orgId = c.get('user')?.orgId ?? '';

	switch (uri) {
		case 'tenantiq://org/overview': {
			const rows = await c.env.DB.prepare(
				'SELECT id, display_name, domain, status, last_sync_at FROM tenants WHERE org_id = ?',
			).bind(orgId).all().catch(() => ({ results: [] }));
			return JSON.stringify({
				orgId,
				tenants: rows.results,
				generatedAt: new Date().toISOString(),
			}, null, 2);
		}

		case 'tenantiq://compliance/frameworks':
			return JSON.stringify({
				frameworks: [
					{ id: 'soc2', name: 'SOC 2 Type II', controlCount: 4, controls: ['CC6.1', 'CC6.2', 'CC7.2', 'CC8.1'] },
					{ id: 'hipaa', name: 'HIPAA Security Rule', controlCount: 4, controls: ['164.312a', '164.312b', '164.312c', '164.312e'] },
					{ id: 'gdpr', name: 'GDPR', controlCount: 5, controls: ['Art. 5.1', 'Art. 17', 'Art. 25', 'Art. 32', 'Art. 33'] },
					{ id: 'iso27001', name: 'ISO 27001:2022 Annex A', controlCount: 25, telemetryEvaluable: 25, organisationalOutOfScope: 68 },
					{ id: 'cis_m365', name: 'CIS Microsoft 365 Foundations v3.1', controlCount: 121, l1: 'tagged', l2: 'tagged' },
				],
			}, null, 2);

		case 'tenantiq://schema/finding':
			return JSON.stringify({
				$schema: 'http://json-schema.org/draft-07/schema#',
				title: 'TenantIQ finding',
				type: 'object',
				required: ['id', 'severity', 'category', 'title', 'detail', 'remediation', 'affectedCount'],
				properties: {
					id: { type: 'string', description: 'Stable identifier per finding rule, e.g. INTUNE-DEV-002' },
					severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
					category: { type: 'string' },
					title: { type: 'string' },
					detail: { type: 'string', description: 'Plain-English explanation referencing the data that triggered the rule' },
					remediation: { type: 'string', description: 'Specific portal path or admin action — never "review your policies"' },
					affectedCount: { type: 'integer' },
					principals: { type: 'array', items: { type: 'string' }, description: 'Optional: UPN / display-name list for identity findings' },
					deviceIds: { type: 'array', items: { type: 'string' }, description: 'Optional: Intune device id list' },
				},
			}, null, 2);

		default:
			return null;
	}
}
