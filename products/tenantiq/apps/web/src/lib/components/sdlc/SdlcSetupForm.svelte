<script lang="ts">
	interface Props {
		onEnable: (piiClasses: string[], policies: string[], apiKey: string) => void;
		configuring: boolean;
	}

	let { onEnable, configuring }: Props = $props();

	const piiClasses = ['SSN', 'Email', 'Credit Card', 'Phone', 'Address', 'Name', 'DOB', 'Passport', 'IP Address', 'PHI', 'PCI', 'API Keys'];
	const complianceFrameworks = ['HIPAA', 'GDPR', 'FINRA', 'SOC 2', 'PCI-DSS'];

	let selectedPii = $state<string[]>(['SSN', 'Credit Card', 'PHI', 'PCI', 'API Keys', 'Email']);
	let selectedPolicies = $state<string[]>(['HIPAA', 'GDPR']);
	let apiKeyInput = $state('');

	function togglePii(cls: string) {
		selectedPii = selectedPii.includes(cls) ? selectedPii.filter(c => c !== cls) : [...selectedPii, cls];
	}
	function togglePolicy(p: string) {
		selectedPolicies = selectedPolicies.includes(p) ? selectedPolicies.filter(c => c !== p) : [...selectedPolicies, p];
	}
</script>

<!-- Hero -->
<div class="animate-fade-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
	<div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"/></svg>
	</div>
	<h2 class="text-xl font-semibold text-[var(--color-text)]">Enable AI Data Compliance</h2>
	<p class="mx-auto mt-2 max-w-lg text-sm text-[var(--color-text-secondary)]">
		SDLC.cc sits between your team and AI models (ChatGPT, Claude, Gemini), automatically redacting sensitive data with sub-50ms latency.
	</p>
</div>

<!-- Configuration -->
<div class="animate-fade-up delay-1 grid grid-cols-1 gap-6 lg:grid-cols-2">
	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">PII Detection Classes</h3>
		<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Select data types to automatically redact from AI prompts</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each piiClasses as cls}
				<button onclick={() => togglePii(cls)} class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedPii.includes(cls) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30'}">
					{cls}
				</button>
			{/each}
		</div>
	</div>

	<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<h3 class="text-sm font-semibold text-[var(--color-text)]">Compliance Frameworks</h3>
		<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Enforce compliance templates for regulatory requirements</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each complianceFrameworks as fw}
				<button onclick={() => togglePolicy(fw)} class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedPolicies.includes(fw) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30'}">
					{fw}
				</button>
			{/each}
		</div>

		<div class="mt-5">
			<label for="sdlc-apikey" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">SDLC.cc API Key (optional)</label>
			<input id="sdlc-apikey" bind:value={apiKeyInput} type="password" placeholder="sk_live_..." class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary)] focus:outline-none" />
		</div>
	</div>
</div>

<div class="animate-fade-up delay-2 flex justify-center">
	<button onclick={() => onEnable(selectedPii, selectedPolicies, apiKeyInput)} disabled={configuring || selectedPii.length === 0} class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] disabled:opacity-50">
		{#if configuring}
			<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
			Configuring...
		{:else}
			Enable AI Compliance
		{/if}
	</button>
</div>
