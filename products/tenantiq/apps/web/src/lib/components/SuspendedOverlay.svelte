<script lang="ts">
	/**
	 * SuspendedOverlay — blocks main content when user account is suspended.
	 * Settings page remains accessible so users can view account info.
	 */
	import { auth } from '$stores/auth';
	import { page } from '$app/stores';
	import { ShieldX, Mail } from 'lucide-svelte';

	const isSuspended = $derived($auth.user?.status === 'suspended');

	const allowedPaths = ['/settings', '/auth'];
	const isAllowedPage = $derived(
		allowedPaths.some((p) => $page.url.pathname.startsWith(p))
	);

	const showOverlay = $derived(isSuspended && !isAllowedPage);
</script>

{#if showOverlay}
	<div
		class="absolute inset-0 z-40 flex items-center justify-center bg-[var(--color-bg)]/95 backdrop-blur-sm"
	>
		<div class="mx-auto max-w-md px-6 text-center">
			<div
				class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10"
			>
				<ShieldX size={28} class="text-red-500" />
			</div>

			<h2 class="text-2xl font-bold tracking-tight text-[var(--color-text)]">
				Account Suspended
			</h2>
			<p class="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
				Your account has been suspended by an administrator. If you believe
				this is an error, please contact support.
			</p>

			<a
				href="mailto:support@tenantiq.app"
				class="mt-8 inline-flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-red-700"
			>
				<Mail size={16} />
				Contact Support
			</a>

			<div class="mt-4">
				<a
					href="/settings"
					class="text-sm text-[var(--color-primary)] hover:underline"
				>
					Go to Settings
				</a>
			</div>

			<p class="mt-4 text-xs text-[var(--color-text-tertiary)]">
				support@tenantiq.app
			</p>
		</div>
	</div>
{/if}
