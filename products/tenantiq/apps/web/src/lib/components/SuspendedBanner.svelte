<script lang="ts">
	/**
	 * SuspendedBanner — full-width red banner shown when user account is suspended.
	 * Not dismissible. Links to support email.
	 */
	import { auth } from '$stores/auth';
	import { ShieldX } from 'lucide-svelte';

	const isSuspended = $derived($auth.user?.status === 'suspended');
</script>

{#if isSuspended}
	<div
		class="flex items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-6 py-3"
		role="alert"
	>
		<ShieldX size={18} class="shrink-0 text-red-500" />
		<p class="flex-1 text-sm font-medium text-red-700 dark:text-red-300">
			Your account has been suspended. Please contact your administrator or
			<a
				href="mailto:support@tenantiq.app"
				class="underline underline-offset-2 hover:text-red-900 dark:hover:text-red-100"
			>
				support@tenantiq.app
			</a>
			for assistance.
		</p>
	</div>
{/if}
