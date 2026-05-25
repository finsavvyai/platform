<script lang="ts">
	import { page } from '$app/stores';
	import OverviewTab from '$lib/components/openclaw/OverviewTab.svelte';
	import SkillsTab from '$lib/components/openclaw/SkillsTab.svelte';
	import ChannelsTab from '$lib/components/openclaw/ChannelsTab.svelte';
	import WebhookConfig from '$lib/components/openclaw/WebhookConfig.svelte';
	import InstallationGuide from '$lib/components/openclaw/InstallationGuide.svelte';

	type Tab = 'overview' | 'skills' | 'channels' | 'webhooks' | 'guide';

	let activeTab = $state<Tab>('overview');
	let skillInstalled = $state(false);
	let loading = $state(true);

	let platforms = $state([
		{ id: 'slack', name: 'Slack', icon: '💬', enabled: true, connected: false },
		{ id: 'teams', name: 'Microsoft Teams', icon: '👥', enabled: true, connected: false },
		{ id: 'discord', name: 'Discord', icon: '🎮', enabled: true, connected: false },
		{ id: 'whatsapp', name: 'WhatsApp', icon: '📱', enabled: true, connected: false },
		{ id: 'telegram', name: 'Telegram', icon: '✈️', enabled: true, connected: false },
		{ id: 'imessage', name: 'iMessage', icon: '💙', enabled: true, connected: false }
	]);

	let webhookConfig = $state({
		webhookUrl: '', webhookSecret: '', enabled: true,
		notificationMode: 'realtime' as const, minSeverity: 'medium' as const,
		categories: ['security', 'licenses', 'compliance'],
		quietHoursStart: '22:00', quietHoursEnd: '08:00'
	});

	const commands = [
		{ category: 'Security', count: 5, icon: '🔒' },
		{ category: 'License Optimization', count: 5, icon: '💰' },
		{ category: 'User Management', count: 5, icon: '👥' },
		{ category: 'Compliance', count: 3, icon: '📋' },
		{ category: 'Tenant Management', count: 3, icon: '🏢' },
		{ category: 'AI Assistant', count: 2, icon: '🤖' }
	];

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'skills', label: 'Skills & Commands' },
		{ id: 'channels', label: 'Channels' },
		{ id: 'webhooks', label: 'Webhooks' },
		{ id: 'guide', label: 'Installation Guide' }
	];

	const commandCount = $derived(commands.reduce((s, c) => s + c.count, 0));
	const connectedCount = $derived(platforms.filter(p => p.connected).length);

	// No API endpoint exists yet — show UI immediately with defaults
	loading = false;

	async function loadIntegrationStatus() {
		try {
			const res = await fetch('/api/integrations/openclaw/status');
			if (!res.ok) return;
			const data = await res.json();
			if (data.platforms) {
				platforms = platforms.map(p => ({
					...p,
					connected: data.platforms[p.id]?.connected ?? p.connected
				}));
			}
			if (data.skillInstalled !== undefined) {
				skillInstalled = data.skillInstalled;
			}
		} catch (e) {
			console.error('Failed to load integration status:', e);
		}
	}

	async function connectPlatform(id: string) {
		try {
			const res = await fetch(`/api/integrations/openclaw/platforms/${id}/connect`, { method: 'POST' });
			if (res.ok) await loadIntegrationStatus();
		} catch (e) { console.error('Failed to connect platform:', e); }
	}

	async function disconnectPlatform(id: string) {
		if (!confirm('Are you sure you want to disconnect this platform?')) return;
		try {
			const res = await fetch(`/api/integrations/openclaw/platforms/${id}/disconnect`, { method: 'POST' });
			if (res.ok) await loadIntegrationStatus();
		} catch (e) { console.error('Failed to disconnect platform:', e); }
	}

	async function saveWebhookConfig() {
		try {
			const res = await fetch(`/api/tenants/${$page.data.tenant.id}/webhooks/config`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(webhookConfig)
			});
			if (res.ok) alert('Webhook configuration saved successfully!');
		} catch (e) { console.error('Failed to save webhook config:', e); alert('Failed to save configuration'); }
	}

	function copyInstallCommand() {
		navigator.clipboard.writeText('openclaw install tenantiq');
	}
</script>

<svelte:head><title>OpenClaw Integration | TenantIQ</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-[var(--color-text)]">OpenClaw Integration</h1>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Manage your Microsoft 365 tenants from any messaging platform</p>
		</div>
		<span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold {skillInstalled ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'}">
			<span class="h-2 w-2 rounded-full {skillInstalled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}"></span>
			{skillInstalled ? 'Skill Installed' : 'Not Installed'}
		</span>
	</header>

	<nav class="flex gap-1 border-b border-[var(--color-border)]" aria-label="Integration tabs">
		{#each tabs as tab}
			<button
				onclick={() => (activeTab = tab.id)}
				class="min-h-[44px] border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors
					{activeTab === tab.id
						? 'border-[var(--color-primary)] text-[var(--color-primary)]'
						: 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}"
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
			<p class="ml-3 text-sm text-[var(--color-text-secondary)]">Loading integration status...</p>
		</div>
	{:else if activeTab === 'overview'}
		<OverviewTab
			{commandCount}
			{connectedCount}
			totalPlatforms={platforms.length}
			webhookEnabled={webhookConfig.enabled}
			notificationMode={webhookConfig.notificationMode}
			{skillInstalled}
			hasWebhookUrl={!!webhookConfig.webhookUrl}
			hasPlatformConnected={connectedCount > 0}
			onGoToChannels={() => (activeTab = 'channels')}
			onGoToWebhooks={() => (activeTab = 'webhooks')}
			onCopyInstall={copyInstallCommand}
		/>
	{:else if activeTab === 'skills'}
		<SkillsTab {commands} />
	{:else if activeTab === 'channels'}
		<ChannelsTab {platforms} onConnect={connectPlatform} onDisconnect={disconnectPlatform} />
	{:else if activeTab === 'webhooks'}
		<WebhookConfig config={webhookConfig} onSave={saveWebhookConfig} />
	{:else if activeTab === 'guide'}
		<InstallationGuide />
	{/if}
</div>
