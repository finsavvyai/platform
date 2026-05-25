<script lang="ts">
	interface Feature {
		name: string;
		active: boolean;
	}

	interface Props {
		title: string;
		replaces: string;
		status: 'active' | 'partial' | 'not_configured';
		score: number;
		features: Feature[];
		requiresLicense?: boolean;
		configUrl?: string;
		productId?: string;
		configurable?: boolean;
		onConfigure?: (productId: string) => Promise<void>;
	}

	let { title, replaces, status, score, features, requiresLicense = false, configUrl, productId = '', configurable = true, onConfigure }: Props = $props();

	let isConfiguring = $state(false);
	let configError = $state<string | null>(null);
	let configSuccess = $state(false);

	const statusColors = {
		active: { bg: 'bg-[var(--color-success)]/10', text: 'text-[var(--color-success)]', badge: 'bg-[var(--color-success)]/20' },
		partial: { bg: 'bg-[var(--color-warning)]/10', text: 'text-[var(--color-warning)]', badge: 'bg-[var(--color-warning)]/20' },
		not_configured: { bg: 'bg-[var(--color-danger)]/10', text: 'text-[var(--color-danger)]', badge: 'bg-[var(--color-danger)]/20' },
	};

	const colors = $derived(statusColors[status]);
	const statusLabel = $derived(status === 'active' ? 'Active' : status === 'partial' ? 'Partial' : 'Not Configured');

	const visibleFeatures = $derived(features.slice(0, 4));
	const hiddenCount = $derived(Math.max(0, features.length - 4));

	async function handleConfigure() {
		if (!onConfigure || !productId || isConfiguring) return;
		isConfiguring = true;
		configError = null;
		configSuccess = false;
		try {
			await onConfigure(productId);
			configSuccess = true;
			setTimeout(() => { configSuccess = false; }, 3000);
		} catch (e) {
			configError = e instanceof Error ? e.message : 'Configuration failed';
		} finally {
			isConfiguring = false;
		}
	}
</script>

<div class="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]">
	<!-- Background gradient on hover -->
	<div class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
		style="background: radial-gradient(circle at 30% 0%, rgba(59, 108, 245, 0.04), transparent 60%);"></div>

	<div class="relative space-y-4 p-5">
		<!-- Header: Title + Status Badge -->
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="font-semibold text-[var(--color-text)]">{title}</h3>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Replaces: {replaces}</p>
			</div>
			<span class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium {colors.badge} {colors.text}">
				{statusLabel}
			</span>
		</div>

		<!-- Score ring / progress -->
		<div class="flex items-center gap-3">
			<div class="relative h-14 w-14 flex-shrink-0">
				<svg viewBox="0 0 36 36" class="rotate-[-90deg] transform">
					<circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-border)" stroke-width="2"></circle>
					<circle
						cx="18"
						cy="18"
						r="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-dasharray="{score * 1.005} 100.48"
						stroke-linecap="round"
						class={colors.text}
					></circle>
				</svg>
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="text-sm font-bold text-[var(--color-text)]">{score}%</span>
				</div>
			</div>
			<div>
				<p class="text-xs font-medium text-[var(--color-text-secondary)]">Configuration</p>
				<p class="text-xs text-[var(--color-text-secondary)]">
					{#if score >= 80}Strong setup{:else if score >= 50}Needs work{:else}Unconfigured{/if}
				</p>
			</div>
		</div>

		<!-- Features checklist -->
		<div class="space-y-2">
			<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Features</p>
			<div class="space-y-1.5">
				{#each visibleFeatures as feature}
					<div class="flex items-center gap-2.5 text-xs">
						{#if feature.active}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-[var(--color-success)]" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-[var(--color-text-tertiary)]" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
							</svg>
						{/if}
						<span class={feature.active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}>
							{feature.name}
						</span>
					</div>
				{/each}
				{#if hiddenCount > 0}
					<p class="text-xs italic text-[var(--color-text-tertiary)]">+{hiddenCount} more features</p>
				{/if}
			</div>
		</div>

		{#if requiresLicense}
			<div class="rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-3 py-2 text-xs text-[var(--color-warning)]">
				Requires Microsoft 365 E5 license
			</div>
		{/if}

		<!-- Status messages -->
		{#if configSuccess}
			<div class="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-3 py-2 text-xs text-[var(--color-success)]">
				Configuration successful!
			</div>
		{/if}
		{#if configError}
			<div class="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-xs text-[var(--color-danger)]">
				{configError}
			</div>
		{/if}

		<!-- Action buttons -->
		<div class="flex flex-col gap-2 pt-2">
			{#if !configurable || !onConfigure}
				{#if configUrl}
					<a href={configUrl} target="_blank" rel="noopener" title="Requires Exchange admin configuration" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]">
						Open Admin Portal
					</a>
				{/if}
			{:else}
				<button
					onclick={handleConfigure}
					disabled={isConfiguring || status === 'active'}
					class="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-white transition-all hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isConfiguring}
						<span class="flex items-center gap-1.5">
							<svg class="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Configuring...
						</span>
					{:else if status === 'active'}
						Configured
					{:else}
						{status === 'partial' ? 'Fix Issues' : 'Auto-Configure'}
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
