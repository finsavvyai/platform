<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface Mapping {
		tenantId: string;
		tenantName: string;
		cwCompanyId: string | null;
		cwCompanyName: string | null;
		autoMatched: boolean;
	}

	interface Props {
		mappings: Mapping[];
		onUpdate: () => void;
	}

	let { mappings, onUpdate }: Props = $props();
	let saving = $state<string | null>(null);
	let editValues = $state<Record<string, string>>({});

	function startEdit(tenantId: string, currentValue: string) {
		editValues[tenantId] = currentValue;
	}

	function cancelEdit(tenantId: string) {
		delete editValues[tenantId];
		editValues = { ...editValues };
	}

	async function saveMapping(tenantId: string) {
		saving = tenantId;
		try {
			await api.post('/integrations/connectwise/mappings', {
				tenantId,
				cwCompanyId: editValues[tenantId]?.trim() || null
			});
			toasts.success('Mapping saved');
			cancelEdit(tenantId);
			onUpdate();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Failed to save mapping');
		} finally {
			saving = null;
		}
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<h2 class="mb-3 text-sm font-semibold text-[var(--color-text)]">Tenant &harr; Company Mappings</h2>
	<p class="mb-4 text-xs text-[var(--color-text-secondary)]">
		Map TenantIQ tenants to ConnectWise companies. Auto-matched entries are highlighted.
	</p>

	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
					<th class="pb-2 pr-4 font-medium">Tenant</th>
					<th class="pb-2 pr-4 font-medium">CW Company</th>
					<th class="pb-2 pr-4 font-medium">Match</th>
					<th class="pb-2 font-medium">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each mappings as m}
					<tr class="border-b border-[var(--color-border)]/50">
						<td class="py-2.5 pr-4 text-[var(--color-text)]">{m.tenantName}</td>
						<td class="py-2.5 pr-4">
							{#if m.tenantId in editValues}
								<input
									bind:value={editValues[m.tenantId]}
									placeholder="CW Company ID"
									class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
								/>
							{:else}
								<span class="text-[var(--color-text-secondary)]">
									{m.cwCompanyName ?? 'Unmapped'}
								</span>
							{/if}
						</td>
						<td class="py-2.5 pr-4">
							{#if m.autoMatched}
								<span class="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">Auto</span>
							{:else if m.cwCompanyId}
								<span class="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">Manual</span>
							{:else}
								<span class="text-xs text-[var(--color-text-secondary)]">&mdash;</span>
							{/if}
						</td>
						<td class="py-2.5">
							{#if m.tenantId in editValues}
								<div class="flex gap-1.5">
									<button
										onclick={() => saveMapping(m.tenantId)}
										disabled={saving === m.tenantId}
										class="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
									>
										{saving === m.tenantId ? 'Saving...' : 'Save'}
									</button>
									<button
										onclick={() => cancelEdit(m.tenantId)}
										class="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
									>
										Cancel
									</button>
								</div>
							{:else}
								<button
									onclick={() => startEdit(m.tenantId, m.cwCompanyId ?? '')}
									class="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
								>
									Edit
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
