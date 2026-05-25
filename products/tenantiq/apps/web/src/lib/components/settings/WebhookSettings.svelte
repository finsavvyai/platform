<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { tenant } from '$stores/tenant';
	import { untrack } from 'svelte';

	let url = $state('');
	let enabled = $state(false);
	let loading = $state(true);
	let saving = $state(false);
	let testing = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadConfig()); });

	async function loadConfig() {
		loading = true;
		try {
			const res = await api.get<{ config: { url: string; enabled: boolean } }>('/webhook-config');
			if (res.config) { url = res.config.url; enabled = res.config.enabled; }
		} catch { /* first time */ }
		finally { loading = false; }
	}

	async function saveConfig() {
		saving = true;
		try {
			await api.post('/webhook-config', { url, enabled });
			toasts.success('Webhook saved');
		} catch { toasts.error('Failed to save'); }
		finally { saving = false; }
	}

	async function testWebhook() {
		testing = true;
		try {
			const res = await api.post<{ sent: boolean; error?: string }>('/webhook-config/test');
			if (res.sent) toasts.success('Test notification sent');
			else toasts.error(res.error || 'Test failed');
		} catch { toasts.error('Test failed'); }
		finally { testing = false; }
	}

	const isSlack = $derived(url.includes('hooks.slack.com'));
	const isTeams = $derived(url.includes('webhook.office.com') || url.includes('workflows.microsoft.com'));
	const webhookType = $derived(isSlack ? 'Slack' : isTeams ? 'Microsoft Teams' : url ? 'Custom' : 'None');
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Webhook Notifications</h3>
	<p class="mb-4 text-xs text-[var(--color-text-secondary)]">Receive alerts in Slack, Microsoft Teams, or any webhook endpoint.</p>

	{#if loading}
		<div class="h-10 skeleton rounded-lg"></div>
	{:else}
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				<input bind:value={url} placeholder="https://hooks.slack.com/services/... or Teams webhook URL" class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none" />
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<label class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
						<input type="checkbox" bind:checked={enabled} class="rounded" /> Enabled
					</label>
					{#if url}
						<span class="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">{webhookType}</span>
					{/if}
				</div>
				<div class="flex gap-2">
					<button onclick={testWebhook} disabled={testing || !url} class="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50">
						{testing ? 'Testing...' : 'Test'}
					</button>
					<button onclick={saveConfig} disabled={saving || !url} class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</div>
		<p class="mt-3 text-[11px] text-[var(--color-text-tertiary)]">Notifications sent for: new alerts, scan completions, config drift, sync results.</p>
	{/if}
</div>
