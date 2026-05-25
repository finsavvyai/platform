<script lang="ts">
	import { auth } from '$stores/auth';
	import { ONBOARD_ORG_URL } from '$lib/config';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		/** Short label of the feature being gated, e.g. "CIS benchmark scanning" */
		feature?: string;
		/** Override the upgrade target URL (defaults to /onboard-org). */
		upgradeHref?: string;
	}
	let { children, feature = 'this feature', upgradeHref = ONBOARD_ORG_URL }: Props = $props();

	const scopeLevel = $derived($auth.user?.scopeLevel ?? 'admin');
	const isPersonal = $derived(scopeLevel === 'personal');
	const userDomain = $derived(($auth.user?.email ?? '').split('@')[1] ?? '');
	const suggestedAdminEmails = $derived(
		userDomain ? [`admin@${userDomain}`, `it@${userDomain}`, `support@${userDomain}`].join(',') : '',
	);
	const mailSubject = $derived(encodeURIComponent(`Please enable TenantIQ for ${userDomain || 'our organization'}`));
	const mailBody = $derived(
		encodeURIComponent(
			`Hi,\n\nI'd like to use TenantIQ for Microsoft 365 security, compliance, and license visibility. It needs a one-time admin consent from a Global Admin.\n\nPlease open this link while signed in as Global Admin and click Accept:\n${upgradeHref}\n\nIt takes ~30 seconds. After you accept, I (and anyone else in the org) can sign in normally.\n\nThanks!`,
		),
	);
	const mailto = $derived(
		suggestedAdminEmails
			? `mailto:${suggestedAdminEmails}?subject=${mailSubject}&body=${mailBody}`
			: `mailto:?subject=${mailSubject}&body=${mailBody}`,
	);
</script>

{#if isPersonal}
	<div class="scope-gate">
		<div class="gate-icon" aria-hidden="true">🔒</div>
		<h2>Admin access required</h2>
		<p>
			{feature} reads data across your whole Microsoft 365 tenant, which a Global Admin
			must authorize once. You're signed in with personal scopes only — only your own data
			is available here.
		</p>
		<div class="gate-actions">
			<a class="btn-primary" href={upgradeHref}>I'm a Global Admin — enable now</a>
			<a class="btn-secondary" href={mailto}>Ask my IT admin</a>
		</div>
		<p class="gate-note">
			After an admin clicks Accept once, every user in <strong>{userDomain || 'your org'}</strong>
			can sign in normally. No code changes, no data leaves your tenant.
		</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.scope-gate {
		max-width: 560px;
		margin: 3rem auto;
		padding: 2rem;
		text-align: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}
	.gate-icon { font-size: 2.4rem; margin-bottom: 0.75rem; }
	.scope-gate h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
	.scope-gate p { color: var(--color-text-secondary); font-size: 0.9rem; line-height: 1.55; }
	.gate-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; margin: 1.5rem 0 1rem; }
	.btn-primary, .btn-secondary {
		padding: 0.65rem 1.15rem; border-radius: var(--radius-lg); font-size: 0.85rem;
		font-weight: 600; text-decoration: none; min-height: 40px;
		display: inline-flex; align-items: center; transition: all 0.2s;
	}
	.btn-primary { background: var(--color-primary); color: #fff; }
	.btn-primary:hover { filter: brightness(1.08); }
	.btn-secondary { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
	.btn-secondary:hover { border-color: var(--color-primary); color: var(--color-primary); }
	.gate-note { font-size: 0.75rem; color: var(--color-text-tertiary); margin-top: 1rem; }
</style>
