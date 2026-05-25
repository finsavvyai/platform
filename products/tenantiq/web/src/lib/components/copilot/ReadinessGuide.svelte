<script lang="ts">
	import { slide } from 'svelte/transition';

	interface Props {
		checkId: string;
		checkName: string;
		status: string;
		detail: string;
	}

	let { checkId, checkName, status, detail }: Props = $props();
	let expanded = $state(false);

	interface Guide { steps: string[]; time: string; difficulty: string; docUrl: string }

	const guides: Record<string, Guide> = {
		'M365 E3/E5': {
			steps: ['Review current licenses in M365 admin center', 'Identify users needing E3/E5 upgrade', 'Purchase or convert licenses via billing portal'],
			time: '10-20 min', difficulty: 'Easy',
			docUrl: 'https://learn.microsoft.com/en-us/microsoft-365/commerce/licenses/buy-licenses',
		},
		'Copilot add-on': {
			steps: ['Go to M365 admin center > Billing > Purchase services', 'Search for "Microsoft 365 Copilot"', 'Select quantity and assign to users'],
			time: '5-10 min', difficulty: 'Easy',
			docUrl: 'https://learn.microsoft.com/en-us/microsoft-365-copilot/microsoft-365-copilot-setup',
		},
		'MFA enrollment': {
			steps: ['Go to Azure Portal > Security > Authentication methods', 'Enable Microsoft Authenticator for all users', 'Set up Security defaults or per-user MFA', 'Monitor adoption via Azure AD reports'],
			time: '20-45 min', difficulty: 'Easy',
			docUrl: 'https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks',
		},
		'Conditional Access': {
			steps: ['Go to Azure Portal > Security > Conditional Access', 'Click "New policy"', 'Set conditions (users, cloud apps = "Microsoft 365 Copilot")', 'Set access controls (grant with MFA)', 'Enable the policy'],
			time: '10-20 min', difficulty: 'Medium',
			docUrl: 'https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview',
		},
		'Sensitivity labels': {
			steps: ['Go to Microsoft Purview > Information Protection', 'Click "Create a label"', 'Name it (Public, Internal, Confidential)', 'Set scope and protection settings', 'Publish via a label policy'],
			time: '15-30 min', difficulty: 'Medium',
			docUrl: 'https://learn.microsoft.com/en-us/purview/sensitivity-labels',
		},
		'Public groups': {
			steps: ['Go to M365 admin center > Groups', 'Review each group privacy setting', 'Change public groups to private where appropriate'],
			time: '10-30 min', difficulty: 'Easy',
			docUrl: 'https://learn.microsoft.com/en-us/microsoft-365/admin/create-groups/manage-groups',
		},
		'Guest invitations': {
			steps: ['Go to Azure Portal > External Identities', 'Set "Guest invite restrictions" to "Only admins"', 'Set collaboration restrictions for specific domains'],
			time: '5-10 min', difficulty: 'Easy',
			docUrl: 'https://learn.microsoft.com/en-us/entra/external-id/external-collaboration-settings-configure',
		},
		'Secure Score': {
			steps: ['Go to Microsoft 365 Defender > Secure Score', 'Review recommended improvement actions', 'Prioritize high-impact, low-effort items', 'Track progress over time'],
			time: '30-60 min', difficulty: 'Medium',
			docUrl: 'https://learn.microsoft.com/en-us/microsoft-365/security/defender/microsoft-secure-score',
		},
		'Stale accounts': {
			steps: ['Go to Azure AD > Users > Filter by sign-in activity', 'Identify accounts inactive 90+ days', 'Disable or delete unused accounts', 'Set up automated account lifecycle rules'],
			time: '20-40 min', difficulty: 'Medium',
			docUrl: 'https://learn.microsoft.com/en-us/entra/identity/users/clean-up-stale-guest-accounts',
		},
	};

	const guide = $derived(guides[checkName] ?? null);
	const showGuide = $derived(guide && status !== 'pass');
	const diffColors: Record<string, string> = { Easy: 'text-[var(--color-success)]', Medium: 'text-[var(--color-warning)]', Hard: 'text-[var(--color-danger)]' };
</script>

{#if showGuide}
	<button
		onclick={() => (expanded = !expanded)}
		class="mt-1 flex w-full cursor-pointer items-center gap-1 text-left text-[11px] font-medium text-[var(--color-primary)] hover:underline"
		aria-expanded={expanded}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-3 w-3 transition-transform duration-200 {expanded ? 'rotate-90' : ''}"
			fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		How to fix
	</button>

	{#if expanded}
		<div transition:slide={{ duration: 200 }} class="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
			<div class="mb-2 flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
				<span>Est. {guide.time}</span>
				<span class={diffColors[guide.difficulty] ?? ''}>{guide.difficulty}</span>
			</div>
			<ol class="space-y-1.5">
				{#each guide.steps as step, i}
					<li class="flex items-start gap-2 text-xs text-[var(--color-text)]">
						<span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-bold text-[var(--color-primary)]">{i + 1}</span>
						{step}
					</li>
				{/each}
			</ol>
			<a href={guide.docUrl} target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] hover:underline">
				Microsoft docs
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
				</svg>
			</a>
		</div>
	{/if}
{/if}
