<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';

	interface Props {
		aiStatus: { openclaw: string; features: Record<string, boolean>; agentCount?: number } | null;
	}

	let { aiStatus }: Props = $props();

	type ChainPreset = 'security-audit' | 'compliance-check' | 'cost-review' | 'full-assessment';

	let chainPreset = $state<ChainPreset>('full-assessment');
	let chainResult = $state<string | null>(null);
	let chaining = $state(false);

	async function runChain() {
		if (!$tenant.currentTenantId || chaining) return;
		chaining = true;
		chainResult = null;
		try {
			const res = await api.post<{ result: string; source: string }>(
				`/ai/chain/${$tenant.currentTenantId}`,
				{ preset: chainPreset }
			);
			chainResult = res.result;
		} catch (e: unknown) {
			chainResult = `Error: ${e instanceof Error ? e.message : 'Chain failed'}`;
		} finally {
			chaining = false;
		}
	}

	export function getResult() {
		return chainResult;
	}
</script>

<div class="h-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="mb-6">
		<h2 class="text-base font-semibold text-[var(--color-text)]">Multi-Agent Analysis Chain</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">
			Run a coordinated analysis using multiple Luna agents for comprehensive insights.
			Requires OpenClaw to be configured.
		</p>
	</div>

	<div class="mb-4 flex items-center gap-4">
		<div class="flex-1">
			<label for="chain-preset" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Analysis Preset</label>
			<select
				id="chain-preset"
				bind:value={chainPreset}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
			>
				<option value="security-audit">Security Audit -- Full security assessment</option>
				<option value="compliance-check">Compliance Check -- SOC2/GDPR gap analysis</option>
				<option value="cost-review">Cost Review -- License & cost optimization</option>
				<option value="full-assessment">Full Assessment -- Complete tenant health report</option>
			</select>
		</div>
		<div class="mt-5">
			<button
				onclick={runChain}
				disabled={chaining || !$tenant.currentTenantId}
				class="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
			>
				{#if chaining}
					<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
					Running chain...
				{:else}
					Run Chain
				{/if}
			</button>
		</div>
	</div>

	{#if chainResult}
		<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<h3 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Chain Analysis Result</h3>
			<pre class="whitespace-pre-wrap text-sm text-[var(--color-text)]">{chainResult}</pre>
		</div>
	{:else if !chaining}
		<div class="flex h-48 items-center justify-center text-center text-[var(--color-text-secondary)]">
			<div>
				<div class="mb-2 text-4xl">&#128279;</div>
				<p class="text-sm">Select a preset and click "Run Chain" for comprehensive analysis</p>
				{#if !aiStatus?.features?.multiAgentChains}
					<p class="mt-2 text-xs text-yellow-500">Requires OPENCLAW_URL to be configured</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
