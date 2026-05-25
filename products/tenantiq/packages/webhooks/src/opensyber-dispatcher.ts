/**
 * OpenSyber Outbound Dispatcher
 *
 * Dispatches tenantiq alert candidates to the OpenSyber webhook receiver at
 *   POST {opensyber_url}/api/integrations/tenantiq/findings
 * with header `X-TenantIQ-Signature: sha256=<hex>` where <hex> is the
 * HMAC-SHA256 of the JSON body computed with the configured shared secret.
 *
 * Wire schema (snake_case) matches the receiver in
 *   opensyber/apps/api/src/routes/integrations/tenantiq.ts
 */

const encoder = new TextEncoder();

export type TenantiqWireSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TenantiqWireCategory = 'security' | 'optimization' | 'compliance' | 'operational';
export type TenantiqWireSource =
	| 'intel-engine'
	| 'remediation'
	| 'compliance-scan'
	| 'drift-detection';

export interface TenantiqWireAlert {
	rule_id: string;
	severity: TenantiqWireSeverity;
	category: TenantiqWireCategory;
	title: string;
	description: string;
	business_impact: string | null;
	recommended_action: string | null;
	affected_resources_count: number;
	tenant_id: string;
}

export interface TenantiqWirePayload {
	alerts: TenantiqWireAlert[];
	tenant_id: string;
	evaluated_at: string;
	source: TenantiqWireSource;
	connection_name: string;
}

/** Internal-shape candidate accepted by buildTenantiqPayload. */
export interface DispatchableCandidate {
	ruleId: string;
	title: string;
	description: string;
	businessImpact: string | null;
	recommendedAction: string | null;
	affectedResources?: unknown[];
	severity: TenantiqWireSeverity;
	category: TenantiqWireCategory;
}

export interface OpenSyberDispatchConfig {
	opensyber_url: string;
	secret: string;
	connection_name: string;
}

export interface DispatchResult {
	status: number;
	body: string;
	attempts: number;
	ok: boolean;
	error?: string;
}

export interface DispatchOptions {
	maxRetries?: number;
	baseDelayMs?: number;
	timeoutMs?: number;
	fetchImpl?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_TIMEOUT_MS = 30_000;

function bytesToHex(bytes: ArrayBuffer): string {
	const arr = new Uint8Array(bytes);
	let out = '';
	for (let i = 0; i < arr.length; i++) {
		out += arr[i].toString(16).padStart(2, '0');
	}
	return out;
}

export async function signOpenSyberPayload(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
	return `sha256=${bytesToHex(mac)}`;
}

export function buildTenantiqPayload(
	alerts: DispatchableCandidate[],
	tenantId: string,
	source: TenantiqWireSource,
	connectionName: string,
	evaluatedAt: string = new Date().toISOString(),
): TenantiqWirePayload {
	return {
		alerts: alerts.map((a) => ({
			rule_id: a.ruleId,
			severity: a.severity,
			category: a.category,
			title: a.title,
			description: a.description,
			business_impact: a.businessImpact,
			recommended_action: a.recommendedAction,
			affected_resources_count: Array.isArray(a.affectedResources)
				? a.affectedResources.length
				: 0,
			tenant_id: tenantId,
		})),
		tenant_id: tenantId,
		evaluated_at: evaluatedAt,
		source,
		connection_name: connectionName,
	};
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchToOpenSyber(
	config: OpenSyberDispatchConfig,
	payload: TenantiqWirePayload,
	opts: DispatchOptions = {},
): Promise<DispatchResult> {
	const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
	const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const fetchImpl = opts.fetchImpl ?? fetch;
	const sleep = opts.sleep ?? defaultSleep;

	const body = JSON.stringify(payload);
	const signature = await signOpenSyberPayload(config.secret, body);
	const url = `${config.opensyber_url.replace(/\/$/, '')}/api/integrations/tenantiq/findings`;

	let attempt = 0;
	let lastError: string | undefined;
	let lastStatus = 0;
	let lastBody = '';

	while (attempt < maxRetries) {
		attempt++;
		try {
			const res = await fetchImpl(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-TenantIQ-Signature': signature,
					'X-TenantIQ-Event': `tenantiq.${payload.source}`,
					'User-Agent': 'TenantIQ-OpenSyber-Dispatcher/1.0',
				},
				body,
				signal: AbortSignal.timeout(timeoutMs),
			});
			lastStatus = res.status;
			lastBody = await res.text().catch(() => '');
			if (res.ok) {
				return { status: res.status, body: lastBody, attempts: attempt, ok: true };
			}
			// 4xx: do not retry — signature/payload bug, will not change.
			if (res.status >= 400 && res.status < 500) {
				return {
					status: res.status,
					body: lastBody,
					attempts: attempt,
					ok: false,
					error: `HTTP ${res.status}`,
				};
			}
			lastError = `HTTP ${res.status}`;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
		if (attempt < maxRetries) {
			await sleep(baseDelayMs * 2 ** (attempt - 1));
		}
	}

	return {
		status: lastStatus,
		body: lastBody,
		attempts: attempt,
		ok: false,
		error: lastError ?? 'unknown dispatch error',
	};
}
