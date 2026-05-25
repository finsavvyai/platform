<script lang="ts">
	import { goto } from '$app/navigation';

	interface SuggestedAction {
		label: string;
		type: 'navigate' | 'remediate' | 'scan' | 'export';
		target: string;
		description: string;
	}

	interface Props {
		actions: SuggestedAction[];
		onRemediate?: (target: string) => void;
	}

	let { actions, onRemediate }: Props = $props();

	const ICONS: Record<string, string> = {
		navigate: 'M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z',
		remediate: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
		scan: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
		export: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
	};

	function handleAction(action: SuggestedAction) {
		if (action.type === 'remediate' && onRemediate) {
			onRemediate(action.target);
		} else if (action.type === 'navigate' || action.type === 'scan') {
			goto(action.target);
		}
	}
</script>

{#if actions.length > 0}
	<div class="mt-2 flex flex-wrap gap-2">
		{#each actions as action}
			<button
				onclick={() => handleAction(action)}
				title={action.description}
				class="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
			>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d={ICONS[action.type] ?? ICONS.navigate} />
				</svg>
				{action.label}
			</button>
		{/each}
	</div>
{/if}
