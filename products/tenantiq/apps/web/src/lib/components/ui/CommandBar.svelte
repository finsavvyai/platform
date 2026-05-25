<script lang="ts">
	import { goto } from '$app/navigation';

	// ─── Types ────────────────────────────────────────────────────────────────

	interface CommandItem {
		id: string;
		label: string;
		category: 'navigate' | 'actions' | 'agents';
		action: () => void;
		keywords?: string[];
	}

	// ─── Props ────────────────────────────────────────────────────────────────

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	// ─── State ────────────────────────────────────────────────────────────────

	let query = $state('');
	let selectedIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	// ─── Commands ─────────────────────────────────────────────────────────────

	const commands: CommandItem[] = [
		{ id: 'nav-dashboard', label: 'Go to Dashboard', category: 'navigate', action: () => goto('/'), keywords: ['home'] },
		{ id: 'nav-alerts', label: 'Go to Alerts', category: 'navigate', action: () => goto('/alerts'), keywords: ['warnings'] },
		{ id: 'nav-cis', label: 'Go to CIS Benchmark', category: 'navigate', action: () => goto('/security/cis'), keywords: ['compliance'] },
		{ id: 'nav-licenses', label: 'Go to Licenses', category: 'navigate', action: () => goto('/licenses') },
		{ id: 'nav-workflows', label: 'Go to Workflows', category: 'navigate', action: () => goto('/workflows') },
		{ id: 'nav-settings', label: 'Go to Settings', category: 'navigate', action: () => goto('/settings') },
		{ id: 'nav-ai', label: 'Go to AI Engine', category: 'navigate', action: () => goto('/ai') },
		{ id: 'nav-agent', label: 'Go to Agent Chat', category: 'navigate', action: () => goto('/ai/agent') },
		{ id: 'nav-operations', label: 'Go to Operations', category: 'navigate', action: () => goto('/platform/operations') },
		{ id: 'nav-security', label: 'Go to Security', category: 'navigate', action: () => goto('/security'), keywords: ['health'] },
		{ id: 'act-scan', label: 'Run CIS Scan', category: 'actions', action: () => goto('/security/cis?action=scan') },
		{ id: 'act-backup', label: 'Start Backup', category: 'actions', action: () => goto('/backups?action=start') },
		{ id: 'act-sync', label: 'Sync PSA', category: 'actions', action: () => goto('/settings?tab=integrations') },
		{ id: 'agent-morning', label: 'MSP Morning Check', category: 'agents', action: () => goto('/ai/agent?recipe=msp-morning') },
		{ id: 'agent-incident', label: 'Incident Response', category: 'agents', action: () => goto('/ai/agent?recipe=incident-response') },
	];

	// ─── Filtered results ─────────────────────────────────────────────────────

	let filtered = $derived.by(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		return commands.filter((c) => {
			const text = `${c.label} ${c.keywords?.join(' ') ?? ''}`.toLowerCase();
			return text.includes(q);
		});
	});

	let grouped = $derived.by(() => {
		const map = new Map<string, CommandItem[]>();
		for (const item of filtered) {
			const group = map.get(item.category) ?? [];
			group.push(item);
			map.set(item.category, group);
		}
		return map;
	});

	// ─── Keyboard ─────────────────────────────────────────────────────────────

	$effect(() => {
		if (open && inputEl) inputEl.focus();
	});

	$effect(() => {
		// Reset selection when query changes
		query;
		selectedIndex = 0;
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open = !open;
			query = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (e.key === 'Enter' && filtered[selectedIndex]) {
			e.preventDefault();
			executeItem(filtered[selectedIndex]);
		}
	}

	function executeItem(item: CommandItem) {
		open = false;
		query = '';
		item.action();
	}

	function handleBackdropClick() {
		open = false;
	}

	const categoryLabels: Record<string, string> = {
		navigate: 'Navigate',
		actions: 'Actions',
		agents: 'Agents',
	};
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Command bar"
		tabindex="-1"
	>
		<!-- Panel -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="border-b border-[var(--color-border)] px-4 py-3">
				<input
					bind:this={inputEl}
					bind:value={query}
					placeholder="Type a command..."
					class="w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none"
					aria-label="Search commands"
				/>
			</div>

			<div class="max-h-72 overflow-y-auto py-2" role="listbox">
				{#if filtered.length === 0}
					<div class="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
						No results found
					</div>
				{:else}
					{#each [...grouped.entries()] as [category, items]}
						<div class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
							{categoryLabels[category] ?? category}
						</div>
						{#each items as item, i}
							{@const globalIdx = filtered.indexOf(item)}
							<button
								onclick={() => executeItem(item)}
								class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors
									{globalIdx === selectedIndex
									? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
									: 'text-[var(--color-text)] hover:bg-[var(--color-bg)]'}"
								role="option"
								aria-selected={globalIdx === selectedIndex}
							>
								{item.label}
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<div class="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-secondary)]">
				<kbd class="rounded border border-[var(--color-border)] px-1">Esc</kbd> close
				<kbd class="ml-2 rounded border border-[var(--color-border)] px-1">&#8593;&#8595;</kbd> navigate
				<kbd class="ml-2 rounded border border-[var(--color-border)] px-1">Enter</kbd> select
			</div>
		</div>
	</div>
{/if}
