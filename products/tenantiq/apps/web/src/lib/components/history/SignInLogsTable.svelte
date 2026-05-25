<script lang="ts">
	import CopyButton from '$components/ui/CopyButton.svelte';
	import { formatRelativeTime } from '$utils/format';

	interface SignInLog {
		id: string;
		userDisplayName: string;
		userPrincipalName: string;
		appDisplayName: string;
		ipAddress: string;
		location: string;
		status: 'success' | 'failure' | 'interrupted';
		riskLevel: 'none' | 'low' | 'medium' | 'high';
		clientApp: string;
		createdAt: string;
	}

	interface Props { logs: SignInLog[] }

	let { logs }: Props = $props();
	let selectedLog = $state<SignInLog | null>(null);

	const failureReasons: Record<string, { title: string; desc: string; fix: string }> = {
		'50126': { title: 'Invalid credentials', desc: 'The username or password entered is incorrect.', fix: 'Verify the credentials and try again. If persistent, reset the password.' },
		'50076': { title: 'MFA required', desc: 'Multi-factor authentication is required but was not completed.', fix: 'Complete the MFA challenge. Check authenticator app or phone.' },
		'53003': { title: 'Blocked by Conditional Access', desc: 'A Conditional Access policy blocked this sign-in attempt.', fix: 'Review CA policies in Azure AD. Check device compliance and location.' },
		'50074': { title: 'Strong auth required', desc: 'The user needs to pass strong authentication (MFA).', fix: 'Register for MFA at aka.ms/mfasetup.' },
		'50053': { title: 'Account locked', desc: 'The account is locked due to too many failed sign-in attempts.', fix: 'Wait 30 minutes or have an admin unlock the account.' },
		'50057': { title: 'Account disabled', desc: 'The user account has been disabled by an administrator.', fix: 'Contact your admin to re-enable the account.' },
		'700016': { title: 'App not found', desc: 'The application was not found in the tenant directory.', fix: 'Verify the app registration exists in Azure AD.' },
		'default': { title: 'Sign-in failed', desc: 'The sign-in attempt was unsuccessful.', fix: 'Check Azure AD sign-in logs for the specific error code.' },
	};

	function getFailureInfo(log: SignInLog) {
		const code = (log as any).errorCode?.toString() ?? 'default';
		return failureReasons[code] ?? failureReasons['default'];
	}

	function riskBadge(r: string): string {
		if (r === 'high') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		if (r === 'medium') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		if (r === 'low') return 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]';
		return 'bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]';
	}

	function statusBadge(s: string): string {
		if (s === 'success') return 'text-[var(--color-success)]';
		if (s === 'failure') return 'text-[var(--color-danger)]';
		return 'text-[var(--color-warning)]';
	}
</script>

<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
	<table class="min-w-full">
		<thead class="bg-[var(--color-bg)]">
			<tr>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">User</th>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Application</th>
				<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">IP / Location</th>
				<th class="px-3 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
				<th class="px-3 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)]">Risk</th>
				<th class="px-3 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Time</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
			{#each logs as log}
				<tr class="group transition-colors hover:bg-[var(--color-bg-secondary)]">
					<td class="px-3 py-3">
						<p class="text-sm font-medium text-[var(--color-text)]">{log.userDisplayName}</p>
						<p class="text-xs text-[var(--color-text-secondary)]">{log.userPrincipalName}</p>
					</td>
					<td class="px-3 py-3">
						<p class="text-sm text-[var(--color-text)]">{log.appDisplayName}</p>
						<p class="text-xs text-[var(--color-text-secondary)]">{log.clientApp}</p>
					</td>
					<td class="px-3 py-3">
						<div class="flex items-center gap-1">
							<span class="text-sm text-[var(--color-text)]">{log.ipAddress}</span>
							<div class="opacity-0 transition-opacity group-hover:opacity-100">
								<CopyButton value={log.ipAddress} label="IP copied" />
							</div>
						</div>
						<p class="text-xs text-[var(--color-text-secondary)]">{log.location}</p>
					</td>
					<td class="px-3 py-3 text-center">
						{#if log.status === 'failure'}
							<button onclick={() => (selectedLog = log)} class="rounded-md px-2 py-0.5 text-xs font-semibold capitalize transition-all {statusBadge(log.status)} hover:bg-[var(--color-danger)]/10 hover:underline" title="Click for details">
								{log.status}
							</button>
						{:else}
							<span class="text-xs font-semibold capitalize {statusBadge(log.status)}">{log.status}</span>
						{/if}
					</td>
					<td class="px-3 py-3 text-center">
						<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize {riskBadge(log.riskLevel)}">{log.riskLevel}</span>
					</td>
					<td class="px-3 py-3 text-right text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(log.createdAt)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && selectedLog) selectedLog = null; }} />

{#if selectedLog}
	{@const info = getFailureInfo(selectedLog)}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="signin-modal-title">
		<button type="button" class="absolute inset-0 cursor-default bg-transparent" onclick={() => (selectedLog = null)} aria-label="Close dialog"></button>
		<div class="relative w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
					</div>
					<div>
						<h3 id="signin-modal-title" class="text-base font-bold text-[var(--color-text)]">Sign-in Failed</h3>
						<p class="text-xs text-[var(--color-text-secondary)]">{info.title}</p>
					</div>
				</div>
				<button onclick={() => (selectedLog = null)} class="rounded-lg p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)]">&times;</button>
			</div>
			<!-- Body -->
			<div class="space-y-4 px-6 py-5">
				<div class="rounded-xl bg-[var(--color-danger)]/5 p-4">
					<p class="text-sm text-[var(--color-text)]">{info.desc}</p>
				</div>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">User</p><p class="text-[var(--color-text)]">{selectedLog.userDisplayName}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Email</p><p class="text-[var(--color-text)]">{selectedLog.userPrincipalName}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Application</p><p class="text-[var(--color-text)]">{selectedLog.appDisplayName}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Client</p><p class="text-[var(--color-text)]">{selectedLog.clientApp}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">IP Address</p><p class="text-[var(--color-text)]">{selectedLog.ipAddress}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Location</p><p class="text-[var(--color-text)]">{selectedLog.location}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Risk Level</p><p class="capitalize text-[var(--color-text)]">{selectedLog.riskLevel}</p></div>
					<div><p class="text-[10px] font-medium text-[var(--color-text-secondary)]">Time</p><p class="text-[var(--color-text)]">{new Date(selectedLog.createdAt).toLocaleString()}</p></div>
				</div>
				<div class="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
					<p class="mb-1 text-xs font-semibold text-[var(--color-primary)]">Recommended Action</p>
					<p class="text-sm text-[var(--color-text)]">{info.fix}</p>
				</div>
			</div>
		</div>
	</div>
{/if}
