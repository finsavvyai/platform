<script lang="ts">
	/**
	 * Admin Layout — wraps all admin sub-pages with nav + access check.
	 */
	import AdminNav from '$lib/components/admin/AdminNav.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { auth } from '$stores/auth';
	import { ShieldAlert } from 'lucide-svelte';

	let { children } = $props();

	const isAdmin = $derived(
		$auth.user && ['admin', 'super_admin', 'platform_admin'].includes($auth.user.role)
	);
	const accessDenied = $derived($auth.user && !isAdmin);
</script>

<svelte:head>
	<title>Platform Admin - TenantIQ</title>
</svelte:head>

{#if accessDenied}
	<div class="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)]">
		<Card variant="elevated" padding="lg">
			<div class="text-center py-8">
				<ShieldAlert class="w-16 h-16 text-[var(--color-danger)] mx-auto mb-4" />
				<h2 class="text-xl font-semibold text-[var(--color-text)] mb-2">Access Denied</h2>
				<p class="text-sm text-[var(--color-text-secondary)]">Platform admin privileges required.</p>
			</div>
		</Card>
	</div>
{:else}
	<div class="min-h-screen bg-[var(--color-bg-secondary)]">
		<header class="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] hig-header">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-14">
					<div>
						<h1 class="text-xl font-semibold text-[var(--color-text)]">Platform Admin</h1>
					</div>
				</div>
			</div>
		</header>
		<AdminNav />
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			{@render children?.()}
		</main>
	</div>
{/if}

<style>
	.hig-header { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
</style>
