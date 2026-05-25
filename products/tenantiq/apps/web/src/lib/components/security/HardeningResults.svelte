<script lang="ts">
	import { goto } from '$app/navigation';
	import BeforeAfterScore from './BeforeAfterScore.svelte';

	interface HardeningAction {
		id: string;
		title: string;
		status: 'pending' | 'running' | 'success' | 'failed';
	}

	interface Props {
		actions: HardeningAction[];
		scoreIncrease: number;
	}

	let { actions, scoreIncrease }: Props = $props();

	const successCount = $derived(actions.filter((a) => a.status === 'success').length);
	const failedCount = $derived(actions.filter((a) => a.status === 'failed').length);
	const beforeScore = $derived(65); // Mock: in production, use actual assessment score
	const afterScore = $derived(beforeScore + scoreIncrease);

	async function goToCIS() {
		await goto('/security/cis');
	}

	function downloadReport() {
		// Mock PDF export
		const content = `
Security Hardening Report
Generated: ${new Date().toLocaleString()}

Summary:
- Actions Completed: ${successCount}
- Actions Failed: ${failedCount}
- Score Improvement: +${scoreIncrease} points

Details:
${actions.map((a) => `- ${a.title}: ${a.status}`).join('\n')}
		`;
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `hardening-report-${Date.now()}.txt`;
		a.click();
	}
</script>

<div class="space-y-6">
	<!-- Celebration -->
	<div class="animate-fade-up rounded-2xl border border-[#16a34a]/30 bg-gradient-to-br from-[#16a34a]/5 to-[#10b981]/5 p-8 text-center">
		<div class="mb-4 flex justify-center">
			<div class="relative">
				<div class="absolute inset-0 animate-pulse rounded-full bg-[#16a34a]/30 blur-xl"></div>
				<div class="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#16a34a]">
					<svg class="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				</div>
			</div>
		</div>
		<h2 class="text-2xl font-bold text-[#16a34a]">Hardening Complete!</h2>
		<p class="mt-2 text-sm text-[var(--color-text-secondary)]">
			Your Microsoft 365 environment is now more secure
		</p>
	</div>

	<!-- Score comparison -->
	<div class="animate-fade-up delay-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
		<h3 class="mb-6 text-lg font-semibold text-[var(--color-text)]">Security Score Improvement</h3>
		<BeforeAfterScore before={beforeScore} after={afterScore} />
	</div>

	<!-- Results summary -->
	<div class="animate-fade-up delay-2 grid grid-cols-2 gap-4">
		<div class="rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/5 p-4 text-center">
			<p class="text-3xl font-bold text-[#16a34a]">{successCount}</p>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Actions Completed</p>
		</div>

		{#if failedCount > 0}
			<div class="rounded-lg border border-[#dc2626]/30 bg-[#dc2626]/5 p-4 text-center">
				<p class="text-3xl font-bold text-[#dc2626]">{failedCount}</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Actions Failed</p>
				<button class="mt-2 text-xs font-medium text-[#dc2626] underline hover:no-underline">Retry</button>
			</div>
		{:else}
			<div class="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 text-center">
				<p class="text-3xl font-bold text-[var(--color-primary)]">100%</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Success Rate</p>
			</div>
		{/if}
	</div>

	<!-- Action buttons -->
	<div class="animate-fade-up delay-3 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:flex-row">
		<button
			onclick={goToCIS}
			class="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			View Full Report
		</button>

		<button
			onclick={downloadReport}
			class="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-text)] transition-all duration-200 hover:bg-[var(--color-bg)]"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
			Download Report
		</button>
	</div>
</div>
