<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	type Role = { id: string; name: string };
	let { relationshipId, availableRoles, onAssigned }: { relationshipId: string; availableRoles: Role[]; onAssigned: () => void } = $props();

	let securityGroupId = $state('');
	let selectedRoles = $state<string[]>([]);
	let assigning = $state(false);

	function toggleRole(id: string) {
		selectedRoles = selectedRoles.includes(id) ? selectedRoles.filter((r) => r !== id) : [...selectedRoles, id];
	}

	async function submit() {
		const sgRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!sgRe.test(securityGroupId.trim())) { toasts.error('Security Group ID must be a GUID'); return; }
		if (selectedRoles.length === 0) { toasts.error('Select at least one role to assign'); return; }
		assigning = true;
		try {
			await api.post(`/gdap/relationships/${relationshipId}/access-assignment`, {
				securityGroupId: securityGroupId.trim(),
				roles: selectedRoles,
			});
			toasts.success('Access assignment submitted to Microsoft');
			securityGroupId = '';
			selectedRoles = [];
			onAssigned();
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Partner Center call failed';
			toasts.error(`Assignment failed: ${msg}`);
		} finally { assigning = false; }
	}
</script>

<div class="assign-card">
	<h4>Assign access to a partner-tenant security group</h4>
	<p class="hint">Bind a security group from your partner tenant to this delegated relationship. Members of the group inherit the selected roles in the customer tenant for the relationship's duration.</p>
	<div class="form">
		<input class="sg-input" bind:value={securityGroupId} placeholder="Security Group ID (GUID)" />
		<div class="role-row">
			{#each availableRoles as role (role.id)}
				<button type="button" class="role-chip" class:selected={selectedRoles.includes(role.id)} onclick={() => toggleRole(role.id)}>{role.name}</button>
			{/each}
		</div>
		<button class="assign-btn" onclick={submit} disabled={assigning}>{assigning ? 'Assigning…' : 'Assign access'}</button>
	</div>
</div>

<style>
	.assign-card { margin-top: 12px; padding: 14px; border-radius: 10px; background: rgba(59,130,246,0.04); border: 1px dashed rgba(59,130,246,0.25); }
	.assign-card h4 { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
	.hint { font-size: 12px; color: var(--color-text-tertiary); margin: 0 0 10px; }
	.form { display: flex; flex-direction: column; gap: 8px; }
	.sg-input { height: 36px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); padding: 0 10px; font-size: 12px; font-family: 'SF Mono', Menlo, monospace; color: var(--color-text); }
	.role-row { display: flex; flex-wrap: wrap; gap: 4px; }
	.role-chip { padding: 4px 10px; border-radius: 100px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 11px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; }
	.role-chip.selected { background: var(--color-primary); border-color: var(--color-primary); color: white; }
	.assign-btn { align-self: flex-start; padding: 6px 14px; border-radius: 8px; background: var(--color-primary); color: white; border: none; font-size: 12px; font-weight: 600; cursor: pointer; }
	.assign-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
