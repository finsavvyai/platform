<script lang="ts">
	/**
	 * BroadcastComposer — admin component for sending broadcast notifications.
	 * Supports targeting all users or org-scoped users with info/warning/promotion types.
	 */
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { Send, CheckCircle } from 'lucide-svelte';

	let targetType = $state<'all_users' | 'org_users'>('all_users');
	let orgId = $state('');
	let type = $state<'info' | 'warning' | 'promotion'>('info');
	let title = $state('');
	let message = $state('');
	let sending = $state(false);
	let sentCount = $state<number | null>(null);
	let error = $state('');
	let confirming = $state(false);

	const typeOptions = [
		{ value: 'info', label: 'Info', color: 'bg-blue-500' },
		{ value: 'warning', label: 'Warning', color: 'bg-amber-500' },
		{ value: 'promotion', label: 'Promotion', color: 'bg-green-500' },
	] as const;

	const canSend = $derived(title.trim() && message.trim() && !sending);

	function requestSend() {
		if (!canSend) return;
		confirming = true;
	}

	async function confirmSend() {
		confirming = false;
		sending = true;
		error = '';
		sentCount = null;

		try {
			const body: Record<string, string> = { targetType, title: title.trim(), message: message.trim(), type };
			if (targetType === 'org_users' && orgId) body.orgId = orgId;

			const res = await fetch('https://api.tenantiq.app/platform/admin/notifications/broadcast', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({ error: 'Request failed' }));
				error = data.error ?? 'Failed to send notification';
				return;
			}

			const data = await res.json();
			sentCount = data.sent ?? 0;
			title = '';
			message = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Network error';
		} finally {
			sending = false;
		}
	}
</script>

<Card variant="elevated" padding="none">
	<div class="border-b border-[var(--color-border)] p-6">
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Send Notification</h2>
		<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Broadcast a message to platform users</p>
	</div>

	<div class="space-y-4 p-6">
		<!-- Target selector -->
		<div>
			<label for="bc-target" class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Target</label>
			<select id="bc-target" bind:value={targetType} class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
				<option value="all_users">All Users</option>
				<option value="org_users">Organization Users</option>
			</select>
		</div>

		{#if targetType === 'org_users'}
			<div>
				<label for="bc-org" class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Organization ID</label>
				<input id="bc-org" bind:value={orgId} type="text" placeholder="Enter org ID" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]" />
			</div>
		{/if}

		<!-- Type selector -->
		<div>
			<span id="bc-type-label" class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Type</span>
			<div class="flex gap-2" role="group" aria-labelledby="bc-type-label">
				{#each typeOptions as opt}
					<button
						onclick={() => (type = opt.value)}
						class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors {type === opt.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'}"
					>
						<span class="h-2 w-2 rounded-full {opt.color}"></span>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<label for="bc-title" class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Title</label>
			<input id="bc-title" bind:value={title} type="text" placeholder="Notification title" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]" />
		</div>

		<div>
			<label for="bc-message" class="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Message</label>
			<textarea id="bc-message" bind:value={message} rows={3} placeholder="Notification message" class="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"></textarea>
		</div>

		{#if error}
			<p class="text-sm text-red-500">{error}</p>
		{/if}

		{#if sentCount !== null}
			<div class="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
				<CheckCircle size={16} />
				Notification sent to {sentCount} user{sentCount !== 1 ? 's' : ''}.
			</div>
		{/if}

		{#if confirming}
			<div class="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
				<p class="flex-1 text-sm text-amber-700 dark:text-amber-300">Send this notification to {targetType === 'all_users' ? 'all users' : 'organization users'}?</p>
				<button onclick={confirmSend} class="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white">Confirm</button>
				<button onclick={() => (confirming = false)} class="text-xs text-[var(--color-text-secondary)] hover:underline">Cancel</button>
			</div>
		{:else}
			<button onclick={requestSend} disabled={!canSend} class="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
				<Send size={14} />
				{sending ? 'Sending...' : 'Send Notification'}
			</button>
		{/if}
	</div>
</Card>
