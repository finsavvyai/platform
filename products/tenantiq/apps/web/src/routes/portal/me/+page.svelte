<script lang="ts">
	import { untrack } from 'svelte';
	import { tenant } from '$stores/tenant';
	import { auth } from '$stores/auth';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { formatRelativeTime } from '$utils/format';

	interface UserProfile {
		id: string; displayName: string; mail: string; jobTitle: string | null;
		department: string | null; accountEnabled: boolean; assignedLicenses: { skuId: string }[];
	}
	interface License { skuId: string; skuPartNumber: string }
	interface SignIn { date: string; location: string; device: string; status: string }

	let user = $state<UserProfile | null>(null);
	let licenses = $state<License[]>([]);
	let signIns = $state<SignIn[]>([]);
	let loading = $state(true);
	let showRequestModal = $state(false);
	let requestSkuId = $state('');
	let requestReason = $state('');
	let requesting = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadProfile()); });

	async function loadProfile() {
		loading = true;
		try {
			const [profileRes, licRes, actRes] = await Promise.all([
				api.get<{ user: UserProfile }>('/portal/me'),
				api.get<{ licenses: License[] }>('/portal/me/licenses'),
				api.get<{ signIns: SignIn[] }>('/portal/me/activity'),
			]);
			user = profileRes.user;
			licenses = licRes.licenses;
			signIns = actRes.signIns;
		} catch { user = null; }
		finally { loading = false; }
	}

	async function requestLicense() {
		if (!requestSkuId.trim() || !requestReason.trim()) return;
		requesting = true;
		try {
			await api.post('/portal/me/license-request', { skuId: requestSkuId, reason: requestReason });
			toasts.success('License request submitted for approval');
			showRequestModal = false;
			requestSkuId = ''; requestReason = '';
		} catch { toasts.error('Failed to submit request'); }
		finally { requesting = false; }
	}
</script>

<svelte:head><title>My Profile | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-[var(--color-text)]">My Profile</h1>
		<p class="text-[var(--color-text-secondary)]">Your account information and activity</p>
	</div>

	{#if loading}
		<div class="space-y-4">{#each Array(3) as _}<div class="h-32 skeleton rounded-2xl"></div>{/each}</div>
	{:else if !user}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-secondary)]">Unable to load profile. Please try again.</div>
	{:else}
		<!-- Profile Info -->
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h2 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Profile</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div><p class="text-xs text-[var(--color-text-secondary)]">Name</p><p class="text-sm font-medium text-[var(--color-text)]">{user.displayName}</p></div>
				<div><p class="text-xs text-[var(--color-text-secondary)]">Email</p><p class="text-sm font-medium text-[var(--color-text)]">{user.mail}</p></div>
				<div><p class="text-xs text-[var(--color-text-secondary)]">Job Title</p><p class="text-sm font-medium text-[var(--color-text)]">{user.jobTitle ?? 'Not set'}</p></div>
				<div><p class="text-xs text-[var(--color-text-secondary)]">Department</p><p class="text-sm font-medium text-[var(--color-text)]">{user.department ?? 'Not set'}</p></div>
				<div><p class="text-xs text-[var(--color-text-secondary)]">Status</p><span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {user.accountEnabled ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}">{user.accountEnabled ? 'Active' : 'Disabled'}</span></div>
			</div>
		</div>

		<!-- Licenses -->
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-semibold text-[var(--color-text)]">My Licenses ({licenses.length})</h2>
				<button onclick={() => (showRequestModal = true)} class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white">Request License</button>
			</div>
			{#if licenses.length === 0}
				<p class="text-sm text-[var(--color-text-secondary)]">No licenses assigned.</p>
			{:else}
				<div class="space-y-2">
					{#each licenses as lic (lic.skuId)}
						<div class="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
							<span class="text-sm font-medium text-[var(--color-text)]">{lic.skuPartNumber}</span>
							<span class="text-xs text-[var(--color-text-tertiary)]">{lic.skuId.slice(0, 8)}...</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Sign-in Activity -->
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
			<h2 class="mb-4 text-sm font-semibold text-[var(--color-text)]">Sign-in Activity</h2>
			{#if signIns.length === 0}
				<p class="text-sm text-[var(--color-text-secondary)]">No recent sign-in activity.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead><tr class="text-left text-xs text-[var(--color-text-secondary)]">
							<th class="pb-2">Date</th><th class="pb-2">Location</th><th class="pb-2">Device</th><th class="pb-2">Status</th>
						</tr></thead>
						<tbody>
							{#each signIns.slice(0, 10) as si}
								<tr class="border-t border-[var(--color-border)]">
									<td class="py-2 text-[var(--color-text)]">{formatRelativeTime(si.date)}</td>
									<td class="py-2 text-[var(--color-text-secondary)]">{si.location}</td>
									<td class="py-2 text-[var(--color-text-secondary)]">{si.device}</td>
									<td class="py-2"><span class="rounded-full px-2 py-0.5 text-xs font-medium {si.status === 'success' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}">{si.status}</span></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showRequestModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
		<div class="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
			<h3 class="text-lg font-semibold text-[var(--color-text)]">Request License</h3>
			<div class="mt-4 space-y-3">
				<input bind:value={requestSkuId} placeholder="SKU ID or license name" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
				<textarea bind:value={requestReason} placeholder="Reason for request..." rows="3" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"></textarea>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showRequestModal = false)} class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">Cancel</button>
				<button onclick={requestLicense} disabled={requesting || !requestSkuId.trim() || !requestReason.trim()} class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{requesting ? 'Submitting...' : 'Submit Request'}</button>
			</div>
		</div>
	</div>
{/if}
