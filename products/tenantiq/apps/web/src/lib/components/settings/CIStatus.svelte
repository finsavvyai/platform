<script lang="ts">
	import { api } from '$api/client';

	interface CIBuild {
		id: string;
		status: 'passed' | 'failed' | 'running' | 'pending';
		branch: string;
		commit: string;
		duration: number;
		startedAt: string;
		checks: { name: string; passed: boolean; duration: number }[];
	}

	let loading = $state(true);
	let build = $state<CIBuild | null>(null);
	let error = $state('');

	const statusColors: Record<string, string> = {
		passed: 'var(--color-success)',
		failed: 'var(--color-danger)',
		running: 'var(--color-warning)',
		pending: 'var(--color-text-tertiary)'
	};

	const statusLabels: Record<string, string> = {
		passed: 'Passed',
		failed: 'Failed',
		running: 'Running',
		pending: 'Pending'
	};

	$effect(() => { loadStatus(); });

	async function loadStatus() {
		loading = true;
		try {
			const res = await api.get<{ build: CIBuild }>('/ci/status');
			build = res.build;
		} catch {
			error = 'Unable to load CI status';
		} finally {
			loading = false;
		}
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		const secs = Math.round(ms / 1000);
		if (secs < 60) return `${secs}s`;
		return `${Math.floor(secs / 60)}m ${secs % 60}s`;
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

	const statusColor = $derived(build ? statusColors[build.status] ?? 'var(--color-text-tertiary)' : 'var(--color-text-tertiary)');
	const statusLabel = $derived(build ? statusLabels[build.status] ?? build.status : 'Unknown');
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold text-[var(--color-text)]">CI/CD Pipeline</h3>
			<p class="text-xs text-[var(--color-text-secondary)]">PushCI build status and deploy health</p>
		</div>
		<button onclick={loadStatus} class="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">
			Refresh
		</button>
	</div>

	{#if loading}
		<div class="space-y-2">
			<div class="h-8 skeleton rounded-lg"></div>
			<div class="h-6 skeleton rounded-lg w-2/3"></div>
		</div>
	{:else if error}
		<p class="text-xs text-[var(--color-text-tertiary)]">{error}</p>
	{:else if build}
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				<span class="inline-block h-2.5 w-2.5 rounded-full" style="background:{statusColor}"></span>
				<span class="text-sm font-medium text-[var(--color-text)]">{statusLabel}</span>
				<span class="text-xs text-[var(--color-text-tertiary)]">{build.branch}</span>
				<code class="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
					{build.commit.slice(0, 7)}
				</code>
			</div>

			<div class="flex gap-4 text-xs text-[var(--color-text-secondary)]">
				<span>Duration: {formatDuration(build.duration)}</span>
				<span>Started: {formatTime(build.startedAt)}</span>
			</div>

			{#if build.checks.length > 0}
				<div class="mt-2 space-y-1">
					{#each build.checks as check}
						<div class="flex items-center gap-2 text-xs">
							<span class="inline-block h-1.5 w-1.5 rounded-full" style="background:{check.passed ? 'var(--color-success)' : 'var(--color-danger)'}"></span>
							<span class="text-[var(--color-text)]">{check.name}</span>
							<span class="text-[var(--color-text-tertiary)]">{formatDuration(check.duration)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-xs text-[var(--color-text-tertiary)]">No build data available. Push a commit to trigger the pipeline.</p>
	{/if}
</div>
