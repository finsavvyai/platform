<script lang="ts">
	import Button from '$components/ui/Button.svelte';

	interface Props {
		syncStarted: boolean;
		syncProgress: number;
		syncStatus: string;
		syncError: string | null;
		onStartSync: () => void;
	}

	let { syncStarted, syncProgress, syncStatus, syncError, onStartSync }: Props = $props();
</script>

<div class="flex flex-col items-center animate-fade-up">
	{#if !syncStarted}
		<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
			</svg>
		</div>

		<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
			Sync your data
		</h2>
		<p class="mb-8 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
			We'll securely pull users, licenses, and security data from your Microsoft 365 tenant. Nothing is modified -- we only read.
		</p>

		{#if syncError}
			<div class="mb-4 w-full max-w-sm space-y-3 rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 px-4 py-3">
				<p class="text-sm text-[var(--color-text)]">{syncError}</p>
				<p class="text-xs text-[var(--color-text-secondary)]">The sync encountered an issue. Check your internet connection and try again.</p>
				<Button variant="primary" size="sm" onclick={onStartSync}>Try Again</Button>
			</div>
		{:else}
			<Button variant="primary" size="lg" onclick={onStartSync}>Start Sync</Button>
			<p class="mt-3 text-[13px] text-[var(--color-text-tertiary)]">Usually takes about a minute.</p>
		{/if}

	{:else}
		<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
			<svg class="h-8 w-8 animate-spin text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		</div>

		<h2 class="mb-2 text-2xl font-bold tracking-tight text-[var(--color-text)]">
			Syncing your tenant...
		</h2>
		<p class="mb-6 text-[15px] text-[var(--color-text-secondary)]">{syncStatus}</p>

		<div
			class="h-2 w-full max-w-sm overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]"
			role="progressbar"
			aria-valuenow={syncProgress}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div
				class="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500 ease-out"
				style="width: {syncProgress}%"
			></div>
		</div>
		<p class="mt-3 text-[13px] text-[var(--color-text-tertiary)]">{syncProgress}% complete</p>
	{/if}
</div>
