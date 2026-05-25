<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import ScoreRing from '$components/ScoreRing.svelte';

	interface Props {
		score: number;
		blocked: number;
		quarantined: number;
		delivered: number;
		scanned: number;
	}

	let { score, blocked, quarantined, delivered, scanned }: Props = $props();

	const scoreColor = $derived(score >= 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)');
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-5">
	<div class="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<ScoreRing score={score} size={80} strokeWidth={6} label="/100" />
		<p class="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">Email Security Score</p>
	</div>
	<MetricCard title="Emails Scanned" value={(scanned ?? 0).toLocaleString()} subtitle="Last 24 hours" icon="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
	<MetricCard title="Threats Blocked" value={String(blocked)} subtitle="Prevented delivery" icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
	<MetricCard title="Quarantined" value={String(quarantined)} subtitle="Pending review" href="/security/email" icon="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
	<MetricCard title="Clean Delivered" value={(delivered ?? 0).toLocaleString()} subtitle="Passed all checks" icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</div>
