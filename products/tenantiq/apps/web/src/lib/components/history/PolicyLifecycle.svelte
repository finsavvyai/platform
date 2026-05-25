<script lang="ts">
	import { formatRelativeTime } from '$utils/format';

	interface PolicySnapshot {
		id: string;
		policyName: string;
		policyType: string;
		action: 'created' | 'modified' | 'enabled' | 'disabled' | 'deleted';
		changedBy: string;
		changedAt: string;
		previousSettings: Record<string, unknown> | null;
		newSettings: Record<string, unknown>;
	}

	interface Props { snapshots: PolicySnapshot[] }

	let { snapshots }: Props = $props();

	function actionBadge(a: string): string {
		if (a === 'created' || a === 'enabled') return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
		if (a === 'modified') return 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]';
		if (a === 'disabled') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
	}

	function formatSettings(settings: Record<string, unknown>): string[] {
		return Object.entries(settings).map(([k, v]) => `${k}: ${String(v)}`);
	}
</script>

<section>
	<h2 class="mb-4 text-lg font-semibold text-[var(--color-text)]">Policy Lifecycle</h2>
	<div class="space-y-3">
		{#each snapshots as snap}
			<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-bg-secondary)]">
				<div class="flex items-start justify-between gap-3">
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-[var(--color-text)]">{snap.policyName}</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {actionBadge(snap.action)}">{snap.action}</span>
						</div>
						<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{snap.policyType} &middot; By {snap.changedBy} &middot; {formatRelativeTime(snap.changedAt)}</p>
					</div>
				</div>

				{#if snap.previousSettings && snap.action === 'modified'}
					<div class="mt-3 grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg bg-[var(--color-danger)]/5 p-3">
							<p class="mb-1 text-xs font-semibold text-[var(--color-danger)]">Before</p>
							{#each formatSettings(snap.previousSettings) as s}
								<p class="text-xs text-[var(--color-text-secondary)]">{s}</p>
							{/each}
						</div>
						<div class="rounded-lg bg-[var(--color-success)]/5 p-3">
							<p class="mb-1 text-xs font-semibold text-[var(--color-success)]">After</p>
							{#each formatSettings(snap.newSettings) as s}
								<p class="text-xs text-[var(--color-text-secondary)]">{s}</p>
							{/each}
						</div>
					</div>
				{:else}
					<div class="mt-3 rounded-lg bg-[var(--color-bg-tertiary)] p-3">
						<p class="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">Settings</p>
						{#each formatSettings(snap.newSettings) as s}
							<p class="text-xs text-[var(--color-text-secondary)]">{s}</p>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
