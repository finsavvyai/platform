<script lang="ts">
	import { auth } from '$stores/auth';
	import { page } from '$app/stores';
	import { Heart, Sparkles, Shield, BarChart3, ArrowRight, LogOut } from 'lucide-svelte';

	async function signOut() {
		await auth.logout();
		window.location.href = '/';
	}

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

	const daysSinceExpiry = $derived(
		trialEnd ? Math.floor((Date.now() - trialEnd.getTime()) / 86_400_000) : 0
	);

	const isGraceExpired = $derived(
		isTrial && trialEnd && trialEnd < new Date() && daysSinceExpiry >= GRACE_PERIOD_DAYS
	);

	// Allow access to settings/billing so they can actually upgrade
	const allowedPaths = ['/settings', '/auth'];
	const isAllowedPage = $derived(allowedPaths.some(p => $page.url.pathname.startsWith(p)));

	// Skip overlay in development for testing
	const isDev = $derived(typeof window !== 'undefined' && window.location.hostname === 'localhost');
	const showOverlay = $derived(isGraceExpired && !isAllowedPage && !isDev);

	const benefits = [
		{ icon: Shield, title: 'Security Intelligence', desc: 'CIS benchmarks, threat detection, and compliance monitoring' },
		{ icon: BarChart3, title: 'License Optimization', desc: 'Save thousands with automated license management' },
		{ icon: Sparkles, title: 'AI-Powered Analysis', desc: 'Natural language tenant management with Claude' },
	];
</script>

{#if showOverlay}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/95 backdrop-blur-sm">
		<div class="mx-auto max-w-lg px-6 text-center">
			<!-- Warm greeting -->
			<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
				<Heart size={28} class="text-[var(--color-primary)]" />
			</div>

			<h2 class="text-2xl font-bold tracking-tight text-[var(--color-text)]">
				We loved having you on the trial
			</h2>
			<p class="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
				Your trial period and grace extension have ended. Your data is safe and waiting for you
				— upgrade to pick up right where you left off.
			</p>

			<!-- Benefits reminder -->
			<div class="mt-8 space-y-3 text-left">
				{#each benefits as b}
					<div class="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
							<b.icon size={18} class="text-[var(--color-primary)]" />
						</div>
						<div>
							<p class="text-sm font-semibold text-[var(--color-text)]">{b.title}</p>
							<p class="text-xs text-[var(--color-text-secondary)]">{b.desc}</p>
						</div>
					</div>
				{/each}
			</div>

			<!-- CTA -->
			<a href="/settings?tab=billing"
				class="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:opacity-95"
			>
				Choose a plan
				<ArrowRight size={16} />
			</a>

			<p class="mt-4 text-xs text-[var(--color-text-tertiary)]">
				Questions? Reach out to support@tenantiq.app — we're happy to help.
			</p>

			<button
				type="button"
				onclick={signOut}
				class="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-secondary)] hover:underline"
			>
				<LogOut size={12} />
				Sign out
			</button>
		</div>
	</div>
{/if}
