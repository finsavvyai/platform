<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';

	interface Props {
		onInvited: () => void;
	}

	let { onInvited }: Props = $props();
	let email = $state('');
	let role = $state('tenant_viewer');
	let sending = $state(false);
	let inviteUrl = $state<string | null>(null);

	async function sendInvite() {
		if (!email.trim() || sending) return;
		sending = true;
		inviteUrl = null;
		try {
			const res = await api.post<{ success: boolean; inviteUrl: string; error?: string }>('/team/invite', { email: email.trim(), role });
			if (res.error) { toasts.error(res.error); }
			else {
				inviteUrl = res.inviteUrl;
				toasts.success(`Invitation sent to ${email}`);
				email = '';
				onInvited();
			}
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Failed to send invitation');
		} finally { sending = false; }
	}

	async function copyInvite() {
		if (inviteUrl && await copyToClipboard(inviteUrl)) toasts.success('Invite link copied');
	}
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Invite Team Member</h3>
	<div class="flex flex-wrap gap-3">
		<input bind:value={email} type="email" placeholder="colleague@company.com" class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none" />
		<select bind:value={role} class="min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
			<option value="tenant_viewer">Viewer</option>
			<option value="tenant_operator">Operator</option>
			<option value="tenant_admin">Admin</option>
		</select>
		<button onclick={sendInvite} disabled={!email.trim() || sending} class="min-h-[44px] rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] disabled:opacity-50">
			{#if sending}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>{:else}Send Invite{/if}
		</button>
	</div>
	{#if inviteUrl}
		<div class="mt-3 flex items-center gap-2 rounded-lg bg-[var(--color-bg)] px-3 py-2">
			<p class="flex-1 truncate font-mono text-xs text-[var(--color-text-secondary)]">{inviteUrl}</p>
			<button onclick={copyInvite} class="shrink-0 text-xs font-medium text-[var(--color-primary)] hover:underline">Copy</button>
		</div>
	{/if}
	<p class="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
		<strong>Viewer:</strong> read-only access &middot; <strong>Operator:</strong> can run scans and syncs &middot; <strong>Admin:</strong> full management access
	</p>
</div>
