<script lang="ts">
	import { api } from '$lib/api/client';
	import { onMount } from 'svelte';
	import { Activity, ArrowDown, ArrowUp, CheckCircle, XCircle, Loader2, Clock } from 'lucide-svelte';

	interface Check { name: string; status: 'pass' | 'fail'; ms: number; error?: string }
	interface SelfTestResult { checks: Check[]; overall: 'pass' | 'fail'; timestamp: string }
	interface DeployInfo { version: string; deployedAt: string; cisScoreDelta: number | null }

	let selfTest: SelfTestResult | null = $state(null as SelfTestResult | null);
	let deployInfo: DeployInfo | null = $state(null as DeployInfo | null);
	let loading = $state(true);
	let error: string | null = $state(null);

	const overallPass = $derived(selfTest?.overall === 'pass');
	const scoreDelta = $derived(deployInfo?.cisScoreDelta ?? null);
	const scoreImproved = $derived(scoreDelta !== null && scoreDelta > 0);
	const scoreRegressed = $derived(scoreDelta !== null && scoreDelta < 0);

	onMount(async () => {
		await fetchStatus();
	});

	async function fetchStatus() {
		loading = true;
		error = null;
		try {
			const [testResult, info] = await Promise.all([
				api.get<SelfTestResult>('/self-test').catch(() => null),
				api.get<DeployInfo>('/health').catch(() => null),
			]);
			selfTest = testResult;
			deployInfo = info as DeployInfo | null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch deploy status';
		} finally {
			loading = false;
		}
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
		});
	}
</script>

<div class="deploy-status">
	<div class="deploy-header">
		<Activity size={18} />
		<h3>Deploy Status</h3>
		<button class="refresh-btn" onclick={fetchStatus} disabled={loading} aria-label="Refresh status">
			<Loader2 size={14} class={loading ? 'spinning' : ''} />
		</button>
	</div>

	{#if loading && !selfTest}
		<div class="loading-state">
			<Loader2 size={20} class="spinning" />
			<span>Checking systems...</span>
		</div>
	{:else if error}
		<div class="error-state">
			<XCircle size={16} />
			<span>{error}</span>
		</div>
	{:else}
		<div class="status-grid">
			<!-- Overall Health -->
			<div class="status-card" class:pass={overallPass} class:fail={!overallPass}>
				{#if overallPass}
					<CheckCircle size={20} />
				{:else}
					<XCircle size={20} />
				{/if}
				<div class="card-content">
					<span class="card-label">Health</span>
					<span class="card-value">{overallPass ? 'Healthy' : 'Issues detected'}</span>
				</div>
			</div>

			<!-- CIS Score Delta -->
			<div class="status-card" class:improved={scoreImproved} class:regressed={scoreRegressed}>
				{#if scoreImproved}
					<ArrowUp size={20} />
				{:else if scoreRegressed}
					<ArrowDown size={20} />
				{:else}
					<Activity size={20} />
				{/if}
				<div class="card-content">
					<span class="card-label">CIS Score</span>
					<span class="card-value">
						{#if scoreDelta !== null}
							{scoreDelta > 0 ? '+' : ''}{scoreDelta}
						{:else}
							--
						{/if}
					</span>
				</div>
			</div>

			<!-- Last Deploy -->
			<div class="status-card">
				<Clock size={20} />
				<div class="card-content">
					<span class="card-label">Last Check</span>
					<span class="card-value">
						{selfTest ? formatTime(selfTest.timestamp) : '--'}
					</span>
				</div>
			</div>
		</div>

		<!-- Individual Checks -->
		{#if selfTest}
			<div class="checks-list">
				{#each selfTest.checks as check}
					<div class="check-row" class:pass={check.status === 'pass'} class:fail={check.status === 'fail'}>
						<span class="check-indicator"></span>
						<span class="check-name">{check.name}</span>
						<span class="check-ms">{check.ms}ms</span>
						{#if check.error}
							<span class="check-error" title={check.error}>{check.error}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.deploy-status {
		background: var(--card-bg, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 12px;
		padding: 20px;
	}
	:global(.dark) .deploy-status {
		background: var(--card-bg-dark, #1f2937);
		border-color: var(--border-dark, #374151);
	}
	.deploy-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	.deploy-header h3 { margin: 0; font-size: 16px; font-weight: 600; flex: 1; }
	.refresh-btn {
		background: none; border: none; cursor: pointer; padding: 4px;
		border-radius: 6px; color: var(--text-secondary, #6b7280);
	}
	.refresh-btn:hover { background: var(--hover-bg, #f3f4f6); }
	.loading-state, .error-state {
		display: flex; align-items: center; gap: 8px;
		padding: 12px; color: var(--text-secondary, #6b7280);
	}
	.error-state { color: var(--red-600, #dc2626); }
	:global(.spinning) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
	.status-card {
		display: flex; align-items: center; gap: 10px;
		padding: 12px; border-radius: 8px;
		background: var(--subtle-bg, #f9fafb);
		color: var(--text-primary, #111827);
	}
	:global(.dark) .status-card { background: var(--subtle-bg-dark, #111827); }
	.status-card.pass { color: var(--green-700, #15803d); }
	.status-card.fail { color: var(--red-700, #b91c1c); }
	.status-card.improved { color: var(--green-700, #15803d); }
	.status-card.regressed { color: var(--red-700, #b91c1c); }
	.card-content { display: flex; flex-direction: column; }
	.card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
	.card-value { font-size: 14px; font-weight: 600; }
	.checks-list { display: flex; flex-direction: column; gap: 6px; }
	.check-row {
		display: flex; align-items: center; gap: 8px;
		padding: 6px 10px; border-radius: 6px; font-size: 13px;
	}
	.check-indicator {
		width: 8px; height: 8px; border-radius: 50%;
		background: var(--gray-300, #d1d5db);
	}
	.check-row.pass .check-indicator { background: var(--green-500, #22c55e); }
	.check-row.fail .check-indicator { background: var(--red-500, #ef4444); }
	.check-name { flex: 1; font-weight: 500; }
	.check-ms { color: var(--text-secondary, #6b7280); font-size: 12px; }
	.check-error {
		color: var(--red-600, #dc2626); font-size: 12px;
		max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}

	@media (max-width: 640px) {
		.status-grid { grid-template-columns: 1fr; }
	}
</style>
