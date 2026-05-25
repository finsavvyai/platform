<script lang="ts">
	import ReadinessGuide from './ReadinessGuide.svelte';

	interface Check {
		name: string;
		status: 'pass' | 'fail' | 'warning' | 'error';
		detail: string;
		errorMessage?: string;
	}

	interface Props {
		label: string;
		score: number;
		checks: Check[];
		index?: number;
	}

	let { label, score, checks, index = 0 }: Props = $props();

	const color = $derived(
		score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-danger)',
	);
	const statusColors: Record<string, string> = {
		pass: 'text-[var(--color-success)]',
		fail: 'text-[var(--color-danger)]',
		warning: 'text-[var(--color-warning)]',
		error: 'text-[var(--color-text-secondary)]',
	};
	const statusIcons: Record<string, string> = {
		pass: 'Pass', fail: 'Fail', warning: 'Warn', error: 'N/A',
	};
</script>

<div class="animate-fade-up delay-{index + 2} rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex items-center justify-between">
		<p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
			{label}
		</p>
		<span class="text-lg font-bold" style="color: {color}">{score}%</span>
	</div>

	<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
		<div class="h-full rounded-full animate-fill-bar" style="width: {score}%; background: {color}"></div>
	</div>

	<div class="mt-3 space-y-1">
		{#each checks as check}
			<div class="text-xs">
				<div
					class="flex items-center gap-2"
					title={check.status === 'error' ? (check.errorMessage ?? 'Unable to assess') : check.detail}
				>
					<span class="font-semibold {statusColors[check.status]}">{statusIcons[check.status]}</span>
					<span class="text-[var(--color-text-secondary)]">{check.name}</span>
				</div>
				{#if check.status !== 'error'}
					<ReadinessGuide checkId={check.name} checkName={check.name} status={check.status} detail={check.detail} />
				{/if}
			</div>
		{/each}
	</div>
</div>
