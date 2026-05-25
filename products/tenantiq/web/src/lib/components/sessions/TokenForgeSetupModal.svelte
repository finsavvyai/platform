<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		open: boolean;
		isUpdate?: boolean;
		initialMode?: 'monitor' | 'enforce' | 'strict';
		initialMaxDevices?: number;
		initialTtlDays?: number;
		initialAutoRevoke?: boolean;
		onClose: () => void;
		onSubmit: (config: { enforceMode: string; maxDevicesPerUser: number; bindingTtlDays: number; autoRevokeOnRisk: boolean }) => Promise<void>;
	}

	let {
		open,
		isUpdate = false,
		initialMode = 'monitor',
		initialMaxDevices = 5,
		initialTtlDays = 90,
		initialAutoRevoke = true,
		onClose,
		onSubmit,
	}: Props = $props();

	let mode = $state(untrack(() => initialMode));
	let maxDevices = $state(untrack(() => initialMaxDevices));
	let ttlDays = $state(untrack(() => initialTtlDays));
	let autoRevoke = $state(untrack(() => initialAutoRevoke));
	let submitting = $state(false);

	// Sync with props when modal opens
	$effect(() => {
		if (open) {
			mode = initialMode;
			maxDevices = initialMaxDevices;
			ttlDays = initialTtlDays;
			autoRevoke = initialAutoRevoke;
		}
	});

	async function handleSubmit() {
		submitting = true;
		try {
			await onSubmit({ enforceMode: mode, maxDevicesPerUser: maxDevices, bindingTtlDays: ttlDays, autoRevokeOnRisk: autoRevoke });
		} finally {
			submitting = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
		<div class="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
			<h3 class="text-lg font-semibold text-[var(--color-text)]">Configure TokenForge</h3>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Device-bound token protection for your tenant</p>

			<div class="mt-5 space-y-4">
				<div>
					<label for="tf-mode" class="block text-xs font-medium text-[var(--color-text-secondary)]">Enforcement Mode</label>
					<select id="tf-mode" bind:value={mode} class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
						<option value="monitor">Monitor — log mismatches, allow all</option>
						<option value="enforce">Enforce — block unbound devices</option>
						<option value="strict">Strict — block unbound + expired</option>
					</select>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="tf-max" class="block text-xs font-medium text-[var(--color-text-secondary)]">Max Devices per User</label>
						<input id="tf-max" type="number" bind:value={maxDevices} min="1" max="20" class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
					</div>
					<div>
						<label for="tf-ttl" class="block text-xs font-medium text-[var(--color-text-secondary)]">Binding TTL (days)</label>
						<input id="tf-ttl" type="number" bind:value={ttlDays} min="1" max="365" class="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
					</div>
				</div>

				<label class="flex items-center gap-3 cursor-pointer">
					<input type="checkbox" bind:checked={autoRevoke} class="h-4 w-4 rounded border-[var(--color-border)] text-[var(--brand-500)]" />
					<span class="text-sm text-[var(--color-text)]">Auto-revoke bindings when device risk detected</span>
				</label>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button onclick={onClose} class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">Cancel</button>
				<button onclick={handleSubmit} disabled={submitting} class="rounded-lg bg-[var(--brand-500)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
					{submitting ? 'Saving...' : isUpdate ? 'Update Configuration' : 'Enable TokenForge'}
				</button>
			</div>
		</div>
	</div>
{/if}
