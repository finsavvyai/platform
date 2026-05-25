<script lang="ts">
	import CopyButton from '$components/ui/CopyButton.svelte';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { safeErrorMessage } from '$lib/utils/safe-error';
	import { untrack } from 'svelte';

	interface AIConfig {
		provider: 'none' | 'byok' | 'managed';
		anthropicKey?: string;
		openaiKey?: string;
		managedPlan?: 'core' | 'professional' | 'security_suite' | 'enterprise';
		sdlcGatewayUrl?: string;
	}

	let config = $state<AIConfig>({ provider: 'none' });
	let loading = $state(true);
	let saving = $state(false);
	let keyVisible = $state(false);

	$effect(() => { untrack(() => loadConfig()); });

	async function loadConfig() {
		loading = true;
		try {
			config = await api.get<AIConfig>('/settings/ai-provider');
		} catch {
			config = { provider: 'none' };
		} finally { loading = false; }
	}

	async function save() {
		saving = true;
		try {
			await api.post('/settings/ai-provider', config);
			toasts.success('AI provider settings saved');
		} catch (err) { toasts.error(safeErrorMessage(err, 'Failed to save')); }
		finally { saving = false; }
	}
</script>

<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h2 class="text-sm font-semibold text-[var(--color-text)]">AI Provider</h2>
	<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Power security scans, license optimization, and AI assistant</p>

	{#if loading}
		<div class="mt-4 h-20 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]"></div>
	{:else}
		<div class="mt-4 space-y-3">
			{#each [
				{ id: 'managed', label: 'Managed by TenantIQ', desc: 'Secure AI via SDLC.cc gateway — no key management needed', badge: 'Recommended' },
				{ id: 'byok', label: 'Bring Your Own Key', desc: 'Use your own Anthropic or OpenAI API key', badge: null },
				{ id: 'none', label: 'Disabled', desc: 'AI features will not be available', badge: null }
			] as option}
				<label class="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors {config.provider === option.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/30'}">
					<input type="radio" name="provider" value={option.id} bind:group={config.provider} class="mt-0.5 accent-[var(--color-primary)]" />
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-[var(--color-text)]">{option.label}</span>
							{#if option.badge}
								<span class="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">{option.badge}</span>
							{/if}
						</div>
						<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{option.desc}</p>
					</div>
				</label>
			{/each}
		</div>

		{#if config.provider === 'managed'}
			<div class="mt-4 rounded-lg bg-[var(--color-success)]/5 p-4">
				<p class="text-xs font-medium text-[var(--color-success)]">Managed AI is included in your plan</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Requests are routed through the SDLC.cc secure gateway with enterprise-grade encryption, audit logging, and compliance controls.</p>
				{#if config.sdlcGatewayUrl}
					<div class="mt-2 flex items-center gap-2">
						<code class="text-xs text-[var(--color-text-secondary)]">{config.sdlcGatewayUrl}</code>
						<CopyButton value={config.sdlcGatewayUrl} label="Gateway URL copied" />
					</div>
				{/if}
			</div>
		{/if}

		{#if config.provider === 'byok'}
			<div class="mt-4 space-y-4">
				<div class="space-y-1.5">
					<label for="anthropic-key" class="block text-sm font-medium text-[var(--color-text)]">Anthropic API Key</label>
					<div class="flex gap-2">
						<input
							id="anthropic-key"
							type={keyVisible ? 'text' : 'password'}
							bind:value={config.anthropicKey}
							placeholder="sk-ant-..."
							class="min-h-[44px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
						/>
						<button onclick={() => (keyVisible = !keyVisible)} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">{keyVisible ? 'Hide' : 'Show'}</button>
					</div>
					<p class="text-xs text-[var(--color-text-secondary)]">Your key is encrypted at rest and never logged</p>
				</div>
				<div class="space-y-1.5">
					<label for="openai-key" class="block text-sm font-medium text-[var(--color-text)]">OpenAI API Key (optional)</label>
					<input
						id="openai-key"
						type="password"
						bind:value={config.openaiKey}
						placeholder="sk-..."
						class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
					/>
				</div>
			</div>
		{/if}

		<div class="mt-5">
			<button onclick={save} disabled={saving} class="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
				{saving ? 'Saving...' : 'Save AI Settings'}
			</button>
		</div>
	{/if}
</section>
