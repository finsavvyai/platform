/**
 * AI-related API operations for TenantIQ
 */

import { BaseHttpClient } from './http-client';

export class AiOperationsClient extends BaseHttpClient {
	/**
	 * Ask AI agent a natural language question about a tenant
	 */
	async askAI(tenantId: string, question: string): Promise<string> {
		const response = await this.request<{ answer: string; source?: string }>(
			`/api/ai/ask/${tenantId}`,
			{
				method: 'POST',
				body: JSON.stringify({ question })
			}
		);
		return response.answer;
	}

	/**
	 * Run AI security scan on a tenant
	 */
	async aiSecurityScan(tenantId: string): Promise<{
		source: string;
		analysis: {
			riskScore: number;
			criticalFindings: string[];
			recommendations: string[];
			complianceGaps: string[];
			estimatedRemediationHours: number;
		};
	}> {
		return this.request(`/api/ai/security-scan/${tenantId}`, { method: 'POST' });
	}

	/**
	 * Run AI license optimization analysis
	 */
	async aiLicenseOptimize(tenantId: string): Promise<{
		source: string;
		analysis: {
			wastedLicenses: number;
			estimatedMonthlySavings: number;
			recommendations: Array<{ action: string; priority: string }>;
		};
	}> {
		return this.request(`/api/ai/license-optimize/${tenantId}`, { method: 'POST' });
	}

	/**
	 * Run multi-agent analysis chain
	 */
	async aiChain(
		tenantId: string,
		preset: 'security-audit' | 'compliance-check' | 'cost-review' | 'full-assessment'
	): Promise<{
		source: string;
		preset: string;
		result: string;
	}> {
		return this.request(`/api/ai/chain/${tenantId}`, {
			method: 'POST',
			body: JSON.stringify({ preset })
		});
	}

	/**
	 * Get AI engine status
	 */
	async aiStatus(): Promise<{
		openclaw: string;
		features: Record<string, boolean>;
		agentCount?: number;
	}> {
		return this.request(`/api/ai/status`);
	}
}
