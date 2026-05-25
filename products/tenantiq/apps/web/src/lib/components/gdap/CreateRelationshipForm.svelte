<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	type Role = { id: string; name: string };
	let { availableRoles = [], onCreated, onCancel }: { availableRoles: Role[]; onCreated: () => void; onCancel: () => void } = $props();

	let customerId = $state('');
	let displayName = $state('');
	let duration = $state('P90D');
	let selectedRoles = $state<string[]>([]);
	let creating = $state(false);

	function toggleRole(id: string) {
		selectedRoles = selectedRoles.includes(id) ? selectedRoles.filter((r) => r !== id) : [...selectedRoles, id];
	}

	async function submit() {
		if (!customerId.trim() || !displayName.trim()) { toasts.error('Fill in customer details'); return; }
		if (selectedRoles.length === 0) { toasts.error('Select at least one role'); return; }
		creating = true;
		try {
			await api.post('/gdap/relationships', {
				customerId: customerId.trim(), displayName: displayName.trim(),
				roles: selectedRoles, duration,
			});
			toasts.success('GDAP relationship created');
			onCreated();
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to create'); }
		finally { creating = false; }
	}
</script>

<div class="create-card">
	<div class="header">
		<h3>Create GDAP Relationship</h3>
		<button class="close" onclick={onCancel} aria-label="Cancel">×</button>
	</div>
	<div class="form-row">
		<div class="form-field">
			<label for="gdap-cust">Customer Tenant ID</label>
			<input id="gdap-cust" bind:value={customerId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
		</div>
		<div class="form-field">
			<label for="gdap-name">Display Name</label>
			<input id="gdap-name" bind:value={displayName} placeholder="Contoso Ltd — GDAP" />
		</div>
		<div class="form-field">
			<label for="gdap-dur">Duration</label>
			<select id="gdap-dur" bind:value={duration}>
				<option value="P30D">30 Days</option>
				<option value="P90D">90 Days</option>
				<option value="P180D">180 Days</option>
				<option value="P365D">365 Days</option>
				<option value="P730D">730 Days (Max)</option>
			</select>
		</div>
	</div>
	<div class="roles-section">
		<span class="roles-label">Azure AD Roles ({selectedRoles.length} selected)</span>
		<div class="roles-grid">
			{#each availableRoles as role (role.id)}
				<button type="button" class="role-chip" class:selected={selectedRoles.includes(role.id)} onclick={() => toggleRole(role.id)}>{role.name}</button>
			{/each}
		</div>
	</div>
	<button class="submit-btn" onclick={submit} disabled={creating}>{creating ? 'Creating…' : 'Create Relationship'}</button>
</div>

<style>
	.create-card { padding: 24px; border-radius: 16px; border: 1px solid var(--color-primary); background: var(--color-surface); }
	.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.header h3 { font-size: 16px; font-weight: 700; margin: 0; }
	.close { font-size: 24px; line-height: 1; background: transparent; border: none; color: var(--color-text-tertiary); cursor: pointer; padding: 0 4px; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr 150px; gap: 12px; margin-bottom: 16px; }
	.form-field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin-bottom: 6px; }
	.form-field input, .form-field select { width: 100%; height: 40px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); padding: 0 12px; font-size: 13px; color: var(--color-text); }
	.roles-section { margin-bottom: 16px; }
	.roles-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin-bottom: 8px; }
	.roles-grid { display: flex; flex-wrap: wrap; gap: 6px; }
	.role-chip { padding: 6px 14px; border-radius: 100px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 12px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
	.role-chip:hover { border-color: var(--color-primary); color: var(--color-text); }
	.role-chip.selected { background: var(--color-primary); border-color: var(--color-primary); color: white; }
	.submit-btn { padding: 10px 24px; border-radius: 10px; background: var(--color-primary); color: white; border: none; font-size: 14px; font-weight: 600; cursor: pointer; }
	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	@media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
</style>
