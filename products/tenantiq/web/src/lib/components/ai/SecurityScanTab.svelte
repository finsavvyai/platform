<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';

	interface SecurityAnalysis {
		riskScore: number;
		criticalFindings: string[];
		recommendations: string[];
		complianceGaps: string[];
		estimatedRemediationHours: number;
	}

	let scanResult = $state<{ source: string; analysis: SecurityAnalysis } | null>(null);
	let scanning = $state(false);

	async function runSecurityScan() {
		if (!$tenant.currentTenantId || scanning) return;
		scanning = true;
		scanResult = null;
		try {
			scanResult = await api.post(`/ai/security-scan/${$tenant.currentTenantId}`, {});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Scan failed';
			scanResult = {
				source: 'error',
				analysis: { riskScore: 0, criticalFindings: [msg], recommendations: [], complianceGaps: [], estimatedRemediationHours: 0 }
			};
		} finally {
			scanning = false;
		}
	}

	function riskColor(score: number) {
		if (score >= 70) return 'text-red-500';
		if (score >= 40) return 'text-yellow-500';
		return 'text-green-500';
	}

	export function getResult() {
		return scanResult;
	}
</script>

<div class="h-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="mb-6 flex items-start justify-between">
		<div>
			<h2 class="text-base font-semibold text-[var(--color-text)]">AI Security Posture Scan</h2>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
				Uses the 365-security Luna agent to analyze your tenant's security posture, identify risks, and generate recommendations.
			</p>
		</div>
		<button
			onclick={runSecurityScan}
			disabled={scanning || !$tenant.currentTenantId}
			class="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
		>
			{#if scanning}
				<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
				Scanning...
			{:else}
				Run Scan
			{/if}
		</button>
	</div>

	{#if scanResult}
		{@const a = scanResult.analysis}
		<div class="space-y-4">
			<div class="flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-4">
				<div class="text-center">
					<div class="text-4xl font-bold {riskColor(a.riskScore)}">{a.riskScore}</div>
					<div class="text-xs text-[var(--color-text-secondary)]">Risk Score /100</div>
				</div>
				<div class="flex-1">
					<div class="mb-1 text-sm font-medium text-[var(--color-text)]">
						{a.riskScore >= 70 ? 'High Risk' : a.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
						<div
							class="h-full rounded-full {a.riskScore >= 70 ? 'bg-red-500' : a.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'}"
							style="width: {a.riskScore}%"
						></div>
					</div>
					<div class="mt-1 text-xs text-[var(--color-text-secondary)]">Powered by {scanResult.source}</div>
				</div>
			</div>

			{#if a.criticalFindings.length > 0}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/10">
					<h3 class="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
						Critical Findings ({a.criticalFindings.length})
					</h3>
					<ul class="space-y-1">
						{#each a.criticalFindings as finding}
							<li class="text-sm text-red-600 dark:text-red-400">{finding}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if a.recommendations.length > 0}
				<div class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/10">
					<h3 class="mb-2 text-sm font-semibold text-green-700 dark:text-green-400">
						Recommendations
					</h3>
					<ul class="space-y-1">
						{#each a.recommendations as rec}
							<li class="text-sm text-green-700 dark:text-green-400">{rec}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if a.complianceGaps.length > 0}
				<div class="rounded-lg border border-[var(--color-border)] p-4">
					<h3 class="mb-2 text-sm font-semibold text-[var(--color-text)]">Compliance Gaps</h3>
					<ul class="space-y-1">
						{#each a.complianceGaps as gap}
							<li class="text-sm text-[var(--color-text-secondary)]">{gap}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<p class="text-xs text-[var(--color-text-secondary)]">
				Estimated remediation time: <strong>{a.estimatedRemediationHours}h</strong>
			</p>
		</div>
	{:else if !scanning}
		<div class="flex h-48 items-center justify-center text-center text-[var(--color-text-secondary)]">
			<div>
				<div class="mb-2 text-4xl">&#128274;</div>
				<p class="text-sm">Click "Run Scan" to analyze your tenant's security posture</p>
			</div>
		</div>
	{/if}
</div>
