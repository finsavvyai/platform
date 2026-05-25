<script lang="ts">
	import { api } from '$api/client';
	import { onMount } from 'svelte';

	interface HealEvent {
		id: string;
		strategy: string;
		pattern: string;
		action: string;
		success: boolean;
		timeSavedMs: number;
		createdAt: string;
	}

	interface HealStats {
		totalFixes: number;
		successRate: number;
		timeSavedMs: number;
		recentEvents: HealEvent[];
		weeklyData: { day: string; fixes: number; failures: number }[];
	}

	let loading = $state(true);
	let stats = $state<HealStats | null>(null);

	onMount(() => { loadStats(); });

	async function loadStats() {
		loading = true;
		try {
			const res = await api.get<{ stats: HealStats }>('/ci/heal-stats');
			stats = res.stats;
		} catch {
			stats = null;
		} finally {
			loading = false;
		}
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		const secs = Math.round(ms / 1000);
		if (secs < 60) return `${secs}s`;
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ${secs % 60}s`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}

	function formatTime(iso: string): string {
		const d = new Date(iso);
		const now = Date.now();
		const diff = now - d.getTime();
		if (diff < 60_000) return 'just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return d.toLocaleDateString();
	}

	const chartMax = $derived(
		stats?.weeklyData.reduce((max, d) => Math.max(max, d.fixes + d.failures), 0) ?? 1
	);

	const patternLabels: Record<string, string> = {
		'd1-table-exists': 'D1 Table Exists',
		'd1-column-missing': 'D1 Column Missing',
		'ts-missing-module': 'TS Missing Module',
		'ts-type-mismatch': 'TS Type Mismatch',
		'wrangler-missing-binding': 'Wrangler Binding',
		'file-size-violation': 'File Size Limit',
		'graph-api-401': 'Graph API Auth',
		'graph-token-expired': 'Graph Token Expired'
	};

	function patternLabel(pattern: string): string {
		return patternLabels[pattern] ?? pattern;
	}
</script>

<svelte:head>
	<title>CI Health | TenantIQ</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-[var(--color-text)]">CI Health</h1>
		<p class="text-[var(--color-text-secondary)]">Self-healing pipeline status and auto-fix history</p>
	</div>

	{#if loading}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each Array(3) as _}
				<div class="h-24 skeleton rounded-2xl"></div>
			{/each}
		</div>
	{:else if stats}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<p class="text-xs text-[var(--color-text-secondary)]">Total Auto-Fixes</p>
				<p class="mt-1 text-2xl font-bold text-[var(--color-text)]">{stats.totalFixes}</p>
			</div>
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<p class="text-xs text-[var(--color-text-secondary)]">Success Rate</p>
				<p class="mt-1 text-2xl font-bold" style="color:{stats.successRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)'}">
					{stats.successRate.toFixed(0)}%
				</p>
			</div>
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<p class="text-xs text-[var(--color-text-secondary)]">Time Saved</p>
				<p class="mt-1 text-2xl font-bold text-[var(--color-text)]">{formatDuration(stats.timeSavedMs)}</p>
			</div>
		</div>

		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Weekly Fixes</h2>
			<div class="flex items-end gap-2" style="height:120px">
				{#each stats.weeklyData as day}
					{@const total = day.fixes + day.failures}
					{@const height = chartMax > 0 ? (total / chartMax) * 100 : 0}
					{@const successHeight = chartMax > 0 ? (day.fixes / chartMax) * 100 : 0}
					<div class="flex flex-1 flex-col items-center gap-1">
						<div class="relative w-full" style="height:{height}%">
							<div class="absolute bottom-0 w-full rounded-t bg-[var(--color-success)]" style="height:{total > 0 ? (successHeight / height) * 100 : 0}%;opacity:0.8"></div>
							<div class="absolute top-0 w-full rounded-t bg-[var(--color-danger)]" style="height:{total > 0 ? ((height - successHeight) / height) * 100 : 0}%;opacity:0.6"></div>
						</div>
						<span class="text-[10px] text-[var(--color-text-tertiary)]">{day.day}</span>
					</div>
				{/each}
			</div>
			<div class="mt-2 flex gap-4 text-[10px] text-[var(--color-text-tertiary)]">
				<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" style="opacity:0.8"></span> Fixed</span>
				<span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-[var(--color-danger)]" style="opacity:0.6"></span> Failed</span>
			</div>
		</div>

		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Recent Auto-Fixes</h2>
			{#if stats.recentEvents.length === 0}
				<p class="text-xs text-[var(--color-text-tertiary)]">No auto-fixes yet.</p>
			{:else}
				<div class="space-y-2">
					{#each stats.recentEvents as event}
						<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
							<div class="flex items-center gap-3">
								<span class="inline-block h-2 w-2 rounded-full" style="background:{event.success ? 'var(--color-success)' : 'var(--color-danger)'}"></span>
								<div>
									<p class="text-xs font-medium text-[var(--color-text)]">{patternLabel(event.pattern)}</p>
									<p class="text-[10px] text-[var(--color-text-tertiary)]">{event.action}</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-[10px] text-[var(--color-text-secondary)]">{formatTime(event.createdAt)}</p>
								{#if event.success}
									<p class="text-[10px] text-[var(--color-success)]">Saved {formatDuration(event.timeSavedMs)}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
			<p class="text-sm text-[var(--color-text-secondary)]">No CI health data available yet.</p>
			<p class="mt-1 text-xs text-[var(--color-text-tertiary)]">Push commits to trigger the self-healing pipeline.</p>
		</div>
	{/if}
</div>
