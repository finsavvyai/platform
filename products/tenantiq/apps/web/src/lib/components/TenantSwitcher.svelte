<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { goto } from '$app/navigation';
	import { ChevronDown, Check } from 'lucide-svelte';
	import { formatRelativeTime } from '$utils/format';

	let open = $state(false);
	let dropdownEl = $state<HTMLDivElement | undefined>(undefined);

	const currentTenant = $derived(
		$tenant.tenants.find((t) => t.id === $tenant.currentTenantId)
	);

	function selectTenant(id: string) {
		if (id === $tenant.currentTenantId) {
			open = false;
			return;
		}
		tenant.setCurrentTenant(id);
		open = false;
		goto('/');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	function handleClickOutside(e: MouseEvent) {
		if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			document.addEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	function syncStatusColor(lastSyncAt: string | null): string {
		if (!lastSyncAt) return 'bg-[var(--color-warning)]';
		return 'bg-[var(--color-success)]';
	}

	function syncLabel(lastSyncAt: string | null): string {
		if (!lastSyncAt) return 'Never synced';
		return `Synced ${formatRelativeTime(lastSyncAt)}`;
	}
</script>

<div class="relative" bind:this={dropdownEl}>
	<button
		type="button"
		onclick={() => { open = !open; }}
		class="flex w-full items-center gap-2 rounded-lg bg-[var(--color-bg)] px-3 py-2.5
			transition-all duration-200 hover:bg-[var(--color-bg-secondary)]"
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-label="Switch tenant: {currentTenant?.displayName ?? 'Select tenant'}"
		style="min-height: 44px;"
	>
		<span class="h-2 w-2 shrink-0 rounded-full {currentTenant ? syncStatusColor(currentTenant.lastSyncAt) : 'bg-[var(--color-text-tertiary)]'}"></span>
		<div class="flex-1 overflow-hidden text-left">
			<p class="truncate text-xs font-medium text-[var(--color-text)]">
				{currentTenant?.displayName ?? 'Select tenant'}
			</p>
			{#if currentTenant?.domain}
				<p class="truncate text-[10px] text-[var(--color-text-tertiary)]">{currentTenant.domain}</p>
			{/if}
		</div>
		<ChevronDown
			size={14}
			class="shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 {open ? 'rotate-180' : ''}"
		/>
	</button>

	{#if open}
		<div
			class="tenant-dropdown absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg
				border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
			role="listbox"
			aria-label="Select tenant"
		>
			{#each $tenant.tenants as t (t.id)}
				{@const selected = t.id === $tenant.currentTenantId}
				<button
					type="button"
					role="option"
					aria-selected={selected}
					onclick={() => selectTenant(t.id)}
					class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors
						duration-150 hover:bg-[var(--color-bg-secondary)]
						{selected ? 'bg-[var(--color-primary)]/5' : ''}"
					style="min-height: 44px;"
				>
					<span class="h-2 w-2 shrink-0 rounded-full {syncStatusColor(t.lastSyncAt)}"></span>
					<div class="flex-1 overflow-hidden">
						<p class="truncate text-xs font-medium text-[var(--color-text)]">{t.displayName}</p>
						<p class="truncate text-[10px] text-[var(--color-text-tertiary)]">
							{t.domain} · {syncLabel(t.lastSyncAt)}
						</p>
					</div>
					{#if selected}
						<Check size={14} class="shrink-0 text-[var(--color-primary)]" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tenant-dropdown {
		animation: dropdown-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1);
	}
	@keyframes dropdown-in {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.tenant-dropdown { animation: none; }
	}
</style>
