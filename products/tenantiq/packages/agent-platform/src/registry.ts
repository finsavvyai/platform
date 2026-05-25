import type { ToolDefinition, ToolNamespace } from './types';

/** Qualified tool name: namespace.toolName */
export type QualifiedName = `${ToolNamespace}.${string}`;

interface RegistryEntry {
	namespace: ToolNamespace;
	tool: ToolDefinition;
}

const registry = new Map<QualifiedName, RegistryEntry>();

/** Register tools under a namespace. */
export function registerTools(namespace: ToolNamespace, tools: ToolDefinition[]): void {
	for (const tool of tools) {
		const key = `${namespace}.${tool.name}` as QualifiedName;
		registry.set(key, { namespace, tool });
	}
}

/** List tools, optionally filtered by namespace. */
export function getTools(namespace?: ToolNamespace): Array<{ qualifiedName: QualifiedName; tool: ToolDefinition }> {
	const results: Array<{ qualifiedName: QualifiedName; tool: ToolDefinition }> = [];
	for (const [key, entry] of registry) {
		if (!namespace || entry.namespace === namespace) {
			results.push({ qualifiedName: key, tool: entry.tool });
		}
	}
	return results;
}

/** Find a tool by its qualified name. */
export function findTool(qualifiedName: QualifiedName): ToolDefinition | undefined {
	return registry.get(qualifiedName)?.tool;
}

/** Clear all registered tools (useful for testing). */
export function clearRegistry(): void {
	registry.clear();
}

// ─── Pre-registered TenantIQ tools (15) ──────────────────────────────

const tenantiqTools: ToolDefinition[] = [
	{ name: 'list_tenants', description: 'List all connected tenants', inputSchema: { type: 'object', properties: {} }, permission: 'read' },
	{ name: 'get_dashboard', description: 'Dashboard metrics for a tenant', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, permission: 'read' },
	{ name: 'run_cis_scan', description: 'Trigger CIS benchmark scan', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, permission: 'write' },
	{ name: 'get_cis_results', description: 'Get CIS scan results', inputSchema: { type: 'object', properties: { scanId: { type: 'string' } }, required: ['scanId'] }, permission: 'read' },
	{ name: 'list_alerts', description: 'List security alerts', inputSchema: { type: 'object', properties: { severity: { type: 'string' } } }, permission: 'read' },
	{ name: 'acknowledge_alert', description: 'Acknowledge an alert', inputSchema: { type: 'object', properties: { alertId: { type: 'string' } }, required: ['alertId'] }, permission: 'write' },
	{ name: 'create_workflow', description: 'Install workflow template', inputSchema: { type: 'object', properties: { templateId: { type: 'string' } }, required: ['templateId'] }, permission: 'write' },
	{ name: 'run_workflow', description: 'Execute a workflow', inputSchema: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] }, permission: 'write' },
	{ name: 'get_backup_status', description: 'Check backup job status', inputSchema: { type: 'object', properties: {} }, permission: 'read' },
	{ name: 'start_backup', description: 'Start data backup', inputSchema: { type: 'object', properties: { scope: { type: 'string' } } }, permission: 'write' },
	{ name: 'sync_psa', description: 'Trigger PSA sync', inputSchema: { type: 'object', properties: { provider: { type: 'string' } }, required: ['provider'] }, permission: 'write' },
	{ name: 'get_health_score', description: 'Tenant health score', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } } }, permission: 'read' },
	{ name: 'export_config', description: 'Export M365 config as JSON', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, permission: 'read' },
	{ name: 'get_storage', description: 'Storage analytics', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } } }, permission: 'read' },
	{ name: 'executive_report', description: 'Generate executive summary', inputSchema: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, permission: 'read' },
];

// ─── Pre-registered PushCI tools (6) ──────────────────────────────────

const pushciTools: ToolDefinition[] = [
	{ name: 'init', description: 'Scan repo and generate CI config', inputSchema: { type: 'object', properties: { directory: { type: 'string' } }, required: ['directory'] }, permission: 'write' },
	{ name: 'run', description: 'Run CI pipeline locally', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, parallel: { type: 'boolean' } }, required: ['directory'] }, permission: 'write' },
	{ name: 'status', description: 'Get last run status', inputSchema: { type: 'object', properties: { directory: { type: 'string' } }, required: ['directory'] }, permission: 'read' },
	{ name: 'doctor', description: 'Check environment health', inputSchema: { type: 'object', properties: { directory: { type: 'string' } }, required: ['directory'] }, permission: 'read' },
	{ name: 'secret_set', description: 'Store an encrypted secret', inputSchema: { type: 'object', properties: { directory: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } }, required: ['directory', 'key', 'value'] }, permission: 'dangerous' },
	{ name: 'ask', description: 'Natural language CI command', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, permission: 'read' },
];

registerTools('tenantiq', tenantiqTools);
registerTools('pushci', pushciTools);
