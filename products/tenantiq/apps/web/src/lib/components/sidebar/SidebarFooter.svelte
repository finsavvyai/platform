<script lang="ts">
	import { LogOut } from 'lucide-svelte';
	import ThemeToggle from '$components/ThemeToggle.svelte';
	import { auth } from '$stores/auth';

	const GRACE_PERIOD_DAYS = 7;

	const trialEnd = $derived(
		$auth.user?.trialEndsAt ? new Date($auth.user.trialEndsAt) : null
	);
	const isTrialExpired = $derived(trialEnd ? trialEnd < new Date() : false);
	const isTrial = $derived(
		!$auth.user?.plan || $auth.user.plan === 'free' || $auth.user.plan === 'trial'
	);
	const daysSinceExpiry = $derived(
		trialEnd && isTrialExpired ? Math.floor((Date.now() - trialEnd.getTime()) / 86_400_000) : 0
	);
	const graceDaysLeft = $derived(Math.max(0, GRACE_PERIOD_DAYS - daysSinceExpiry));
	const isInGracePeriod = $derived(isTrialExpired && graceDaysLeft > 0);
	const isFullyExpired = $derived(isTrialExpired && graceDaysLeft === 0);
</script>

{#if $auth.user}
	<div class="border-t border-[var(--color-border)] p-3">
		{#if isTrial}
			{@const color = isFullyExpired ? 'primary' : isInGracePeriod ? 'warning' : 'success'}
			{@const label = isFullyExpired ? 'Ready to upgrade?' : isInGracePeriod ? `${graceDaysLeft} day${graceDaysLeft !== 1 ? 's' : ''} of access left` : trialEnd ? `Trial ends ${trialEnd.toLocaleDateString()}` : 'Free plan'}
			<div class="mb-2 rounded-lg bg-[var(--color-{color})]/8 px-3 py-2 text-center">
				<p class="text-xs font-medium text-[var(--color-{color})]">{label}</p>
				{#if isTrialExpired}
					<a href="/settings?tab=billing" class="mt-0.5 inline-block text-xs font-medium text-[var(--color-{color})] underline hover:no-underline">View plans</a>
				{/if}
			</div>
		{/if}
		<div class="flex items-center gap-3 rounded-lg p-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">
				{$auth.user.name.charAt(0).toUpperCase()}
			</div>
			<div class="flex-1 overflow-hidden">
				<div class="flex items-center gap-1.5">
					<p class="truncate text-xs font-medium text-[var(--color-text)]">{$auth.user.name}</p>
					{#if isTrial}
						<span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase {isInGracePeriod ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' : isFullyExpired ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-success)]/15 text-[var(--color-success)]'}">
							{isInGracePeriod ? `${graceDaysLeft}d left` : isFullyExpired ? 'Free' : 'Trial'}
						</span>
					{/if}
				</div>
				<p class="truncate text-xs text-[var(--color-text-secondary)]">{$auth.user.email}</p>
			</div>
		</div>
		<div class="flex items-center justify-between px-3 py-2">
			<span class="text-xs text-[var(--color-text-tertiary)]">Theme</span>
			<ThemeToggle />
		</div>
		<button
			onclick={() => { fetch((import.meta.env.PUBLIC_API_URL ? `${import.meta.env.PUBLIC_API_URL}/api` : 'https://api.tenantiq.app/api') + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); auth.logout(); window.location.href = '/'; }}
			aria-label="Sign out of TenantIQ"
			class="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-danger)]/5 hover:text-[var(--color-danger)]"
		>
			<LogOut size={14} />
			Sign Out
		</button>
	</div>
{/if}
