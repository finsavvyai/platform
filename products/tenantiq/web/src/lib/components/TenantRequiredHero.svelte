<script lang="ts">
	import { tenant } from '$stores/tenant';
	import { auth } from '$stores/auth';
	import { LOGIN_PERSONAL_URL, ONBOARD_ORG_URL } from '$lib/config';
	import type { PageInfo } from '$lib/config/page-info';

	interface Props {
		info: PageInfo | null;
	}

	let { info }: Props = $props();

	const noTenants = $derived($tenant.tenants.length === 0);
	const isAnonymous = $derived(!$auth.user);
</script>

<div class="mx-auto max-w-3xl py-12">
	{#if info}
		<!-- Marketing hero for the requested page -->
		<div class="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)] p-8 sm:p-10">
			<span class="inline-block rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
				{info.title}
			</span>
			<h1 class="mt-4 text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">{info.tagline}</h1>
			<p class="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">{info.description}</p>

			<ul class="mt-6 grid gap-3 sm:grid-cols-2">
				{#each info.bullets as bullet}
					<li class="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
						<svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-success)]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path d="M4 8.5l3 3 5-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span>{bullet}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Connect/select CTA card -->
	{#if noTenants}
		<div class="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
			<h2 class="text-lg font-semibold text-[var(--color-text)]">How to see real data here</h2>
			<p class="mt-1 text-sm text-[var(--color-text-secondary)]">Pick the path that matches your role.</p>

			<!-- Path 1: Admin connects -->
			<div class="mt-5 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5">
				<div class="flex items-start gap-3">
					<span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">1</span>
					<div class="flex-1">
						<h3 class="text-sm font-semibold text-[var(--color-text)]">I am a Microsoft 365 admin</h3>
						<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Grant admin consent to TenantIQ — takes 30 seconds. Requires <strong>Global Admin</strong>, <strong>Privileged Role Admin</strong>, or <strong>Application Admin</strong> on a <strong>work or school</strong> account.</p>
						<a href="{ONBOARD_ORG_URL}" class="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:shadow-[var(--shadow-md)]">
							<svg width="14" height="14" viewBox="0 0 23 23" fill="none" aria-hidden="true"><rect width="10" height="10" fill="#F25022" /><rect x="12" width="10" height="10" fill="#7FBA00" /><rect y="12" width="10" height="10" fill="#00A4EF" /><rect x="12" y="12" width="10" height="10" fill="#FFB900" /></svg>
							Connect with Microsoft
						</a>
					</div>
				</div>
			</div>

			<!-- Path 2: Ask admin -->
			<div class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
				<div class="flex items-start gap-3">
					<span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-bold text-[var(--color-text)]">2</span>
					<div class="flex-1">
						<h3 class="text-sm font-semibold text-[var(--color-text)]">I need my admin to grant consent</h3>
						<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Send this link to your Microsoft 365 Global Admin. They click, grant consent, and you're in.</p>
						<div class="mt-3 flex gap-2">
							<input
								readonly
								value="{ONBOARD_ORG_URL}"
								class="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text)]"
								onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<button
								type="button"
								onclick={() => navigator.clipboard?.writeText('{ONBOARD_ORG_URL}')}
								class="min-h-[36px] rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
							>Copy</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Path 3: Explore first -->
			{#if isAnonymous}
				<div class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
					<div class="flex items-start gap-3">
						<span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-bold text-[var(--color-text)]">3</span>
						<div class="flex-1">
							<h3 class="text-sm font-semibold text-[var(--color-text)]">I just want to explore TenantIQ first</h3>
							<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Sign in with any Microsoft account — personal or work. You'll see the UI and feature descriptions. Connect a tenant later to see real data.</p>
							<a href="{LOGIN_PERSONAL_URL}" class="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]">
								Sign in to explore
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
				</svg>
			</div>
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Select a tenant to view this page</h2>
			<p class="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">Use the tenant switcher in the sidebar to pick which Microsoft 365 tenant to show.</p>
		</div>
	{/if}
</div>
