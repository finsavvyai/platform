<script lang="ts">
	import { auth } from '$stores/auth';
	import { Clock, Heart } from 'lucide-svelte';

	const GRACE_PERIOD_DAYS = 30;

	const trialEnd = $derived(
		$auth.user?.trialEndsAt ? new Date($auth.user.trialEndsAt) : null
	);

	// Platform roles bypass trial/billing UI.
	const isPlatformRole = $derived(
		$auth.user?.role === 'platform_admin' || $auth.user?.role === 'super_admin',
	);
	const isTrial = $derived(
		$auth.user && !isPlatformRole && (!$auth.user.plan || $auth.user.plan === 'free' || $auth.user.plan === 'trial'),
	);

	let tick = $state(0);

	// Update every minute for live countdown
	$effect(() => {
		const interval = setInterval(() => { tick += 1; }, 60_000);
		return () => clearInterval(interval);
	});

	const now = $derived(tick >= 0 ? new Date() : new Date());
	const isExpired = $derived(trialEnd ? trialEnd < now : false);

	const daysSinceExpiry = $derived(
		trialEnd ? Math.floor((now.getTime() - trialEnd.getTime()) / 86_400_000) : 0
	);

	const graceDaysLeft = $derived(
		Math.max(0, GRACE_PERIOD_DAYS - daysSinceExpiry)
	);

	const isInGracePeriod = $derived(isExpired && graceDaysLeft > 0);
	const isGraceExpired = $derived(isExpired && graceDaysLeft === 0);

	let dismissed = $state(false);
</script>

{#if isTrial && isInGracePeriod && !dismissed}
	<!-- Grace period: warm, friendly countdown -->
	<div class="flex items-center justify-between border-b border-[var(--color-warning)]/20 bg-[var(--color-warning)]/6 px-6 py-2.5" role="status">
		<div class="flex items-center gap-2.5">
			<Clock size={16} class="shrink-0 text-[var(--color-warning)]" />
			<p class="text-sm text-[var(--color-text)]">
				<span class="font-semibold text-[var(--color-warning)]">{graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} left</span>
				— Your trial ended, but we've extended your access so you don't lose anything.
				Upgrade anytime to keep your data and features.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<a href="/settings?tab=billing" class="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90">
				View plans
			</a>
			<button onclick={() => dismissed = true} class="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]" aria-label="Dismiss">
				&times;
			</button>
		</div>
	</div>
{/if}
