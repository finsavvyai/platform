<script lang="ts">
	interface Props {
		title: string;
		status: 'active' | 'partial' | 'inactive';
		description: string;
		icon: string;
	}

	let { title, status, description, icon }: Props = $props();

	const statusColor = $derived(
		status === 'active'
			? 'text-[var(--color-success)]'
			: status === 'partial'
			? 'text-[var(--color-warning)]'
			: 'text-[var(--color-danger)]',
	);

	const statusBg = $derived(
		status === 'active'
			? 'bg-[var(--color-success)]/10'
			: status === 'partial'
			? 'bg-[var(--color-warning)]/10'
			: 'bg-[var(--color-danger)]/10',
	);

	const statusLabel = $derived(
		status === 'active' ? 'Active' : status === 'partial' ? 'Partial' : 'Inactive',
	);
</script>

<div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-start gap-3">
			<div class="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d={icon} />
				</svg>
			</div>
			<div class="flex-1">
				<h3 class="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{description}</p>
			</div>
		</div>
		<span class="inline-flex shrink-0 items-center gap-1.5 rounded-lg {statusBg} px-2.5 py-1">
			<span class="h-2 w-2 rounded-full {statusColor}"></span>
			<span class="text-xs font-medium {statusColor}">{statusLabel}</span>
		</span>
	</div>
</div>
