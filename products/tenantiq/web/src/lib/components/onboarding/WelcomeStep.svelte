<script lang="ts">
	import Button from '$components/ui/Button.svelte';

	interface Props {
		tenantName: string;
		onContinue: () => void;
	}

	let { tenantName, onContinue }: Props = $props();
</script>

<div class="flex flex-col items-center animate-fade-up">
	<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
		</svg>
	</div>

	<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
		Welcome to TenantIQ
	</h2>

	<p class="mb-4 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
		Your Microsoft 365 tenant is connected and ready to go.
		Let's set up your security intelligence in just a few steps.
	</p>

	<div class="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3">
		<p class="text-sm text-[var(--color-text-secondary)]">Connected tenant</p>
		<p class="text-base font-semibold text-[var(--color-text)]">{tenantName}</p>
	</div>

	<div class="w-full max-w-sm space-y-3 mb-8">
		<div class="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">1</span>
			<div>
				<p class="text-sm font-medium text-[var(--color-text)]">Sync your data</p>
				<p class="text-[13px] text-[var(--color-text-secondary)]">Pull users, licenses, and policies from Microsoft 365.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">2</span>
			<div>
				<p class="text-sm font-medium text-[var(--color-text)]">Security analysis</p>
				<p class="text-[13px] text-[var(--color-text-secondary)]">Automated scan for risks, misconfigurations, and compliance gaps.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
			<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">3</span>
			<div>
				<p class="text-sm font-medium text-[var(--color-text)]">Actionable insights</p>
				<p class="text-[13px] text-[var(--color-text-secondary)]">Your dashboard will be populated with real recommendations.</p>
			</div>
		</div>
	</div>

	<Button variant="primary" size="lg" onclick={onContinue}>Get Started</Button>
	<p class="mt-3 text-[13px] text-[var(--color-text-tertiary)]">
		This takes about a minute. You can navigate away at any time.
	</p>
</div>
