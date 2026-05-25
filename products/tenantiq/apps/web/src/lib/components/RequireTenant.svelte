<script lang="ts">
	import { tenant } from '$stores/tenant';

	interface Props {
		children: any;
	}

	let { children }: Props = $props();
</script>

{#if $tenant.currentTenantId}
	{@render children()}
{:else if $tenant.tenants.length === 0}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.518a4.5 4.5 0 00-6.364-6.364L4.5 8.25l1.757 1.757" />
			</svg>
		</div>
		<h2 class="text-lg font-semibold text-[var(--color-text)]">No Microsoft 365 tenant connected</h2>
		<p class="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
			This page needs a connected tenant to show data. Grant admin consent with one click.
		</p>
		<a
			href="https://api.tenantiq.app/api/auth/onboard-org"
			class="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:shadow-[var(--shadow-md)]"
		>
			<svg width="16" height="16" viewBox="0 0 23 23" fill="none" aria-hidden="true">
				<rect width="10" height="10" fill="#F25022" />
				<rect x="12" width="10" height="10" fill="#7FBA00" />
				<rect y="12" width="10" height="10" fill="#00A4EF" />
				<rect x="12" y="12" width="10" height="10" fill="#FFB900" />
			</svg>
			Connect with Microsoft
		</a>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
			</svg>
		</div>
		<h2 class="text-lg font-semibold text-[var(--color-text)]">Select a tenant</h2>
		<p class="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
			Use the tenant switcher in the sidebar to pick which Microsoft 365 tenant to view.
		</p>
	</div>
{/if}
