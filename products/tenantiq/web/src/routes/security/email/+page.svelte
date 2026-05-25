<script lang="ts">
	import MetricCard from '$components/MetricCard.svelte';
	import PageHeader from '$components/ui/PageHeader.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { untrack } from 'svelte';

	interface AuthStatus { spf: 'pass' | 'fail' | 'none'; dkim: 'pass' | 'fail' | 'none'; dmarc: 'pass' | 'fail' | 'none' }
	interface AuthDetails { domain: string; spfRecords: string[]; dmarcRecords: string[]; dkimRecords: string[]; dmarcPolicy: string; lastChecked: string }
	interface EmailSecurityResponse {
		threats: unknown[]; summary: { totalScanned: number; blocked: number; quarantined: number; delivered: number };
		authStatus: AuthStatus; authDetails?: AuthDetails; relayPatterns: unknown[];
	}

	let data = $state<EmailSecurityResponse | null>(null);
	let loading = $state(true);
	let error = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadEmailSecurity()); else loading = false; });

	async function loadEmailSecurity() {
		loading = true; error = false;
		try { data = await api.get<EmailSecurityResponse>(`/tenants/${$tenant.currentTenantId}/email-security`); }
		catch { error = true; data = null; }
		finally { loading = false; }
	}

	function badgeClass(status: string): string {
		if (status === 'pass') return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
		if (status === 'fail') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
	}

	const allPass = $derived(data?.authStatus?.spf === 'pass' && data?.authStatus?.dkim === 'pass' && data?.authStatus?.dmarc === 'pass');
	const failCount = $derived([data?.authStatus?.spf, data?.authStatus?.dkim, data?.authStatus?.dmarc].filter(s => s === 'none' || s === 'fail').length);
</script>

<svelte:head><title>Email Security | TenantIQ</title></svelte:head>

<div class="page-container space-y-6">
	<PageHeader title="Email Security" iconPath="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" description={"Mail authentication, threat detection, and relay monitoring" + (data?.authDetails?.domain ? ` (${data.authDetails.domain})` : '')} />

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
			{#each Array(4) as _}<div class="h-28 skeleton rounded-2xl"></div>{/each}
		</div>
	{:else if error || !data || !data.summary}
		<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
			<h3 class="section-title">Email Security data unavailable</h3>
			<p class="mt-2 text-sm text-[var(--color-text-secondary)]">Sync your tenant to scan email authentication.</p>
			<button onclick={loadEmailSecurity} class="btn-primary mt-4">Retry</button>
		</div>
	{:else}
		<!-- Overall status banner -->
		{#if allPass}
			<div class="flex items-center gap-3 rounded-2xl border border-[var(--color-success)]/20 bg-[var(--color-success)]/5 p-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
				<div>
					<p class="text-sm font-semibold text-[var(--color-success)]">All email authentication protocols are configured</p>
					<p class="text-xs text-[var(--color-text-secondary)]">SPF, DKIM, and DMARC are all passing for {data.authDetails?.domain || 'your domain'}</p>
				</div>
			</div>
		{:else if failCount > 0}
			<div class="flex items-center gap-3 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
				<div>
					<p class="text-sm font-semibold text-[var(--color-danger)]">{failCount} email authentication {failCount === 1 ? 'protocol' : 'protocols'} not configured</p>
					<p class="text-xs text-[var(--color-text-secondary)]">Your domain is vulnerable to email spoofing and phishing attacks</p>
				</div>
			</div>
		{/if}

		<!-- Auth Protocol Cards -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each [
				{ key: 'spf', label: 'SPF', full: 'Sender Policy Framework', desc: 'Specifies which mail servers are authorized to send email for your domain', fix: 'Add a TXT record: v=spf1 include:spf.protection.outlook.com -all' },
				{ key: 'dkim', label: 'DKIM', full: 'DomainKeys Identified Mail', desc: 'Adds a digital signature to outgoing emails to verify they haven\'t been altered', fix: 'Enable DKIM signing in Exchange Admin Center > Mail Flow > DKIM' },
				{ key: 'dmarc', label: 'DMARC', full: 'Domain-based Message Authentication', desc: 'Tells receiving servers what to do with emails that fail SPF/DKIM checks', fix: 'Add a TXT record: _dmarc.yourdomain.com → v=DMARC1; p=quarantine' },
			] as proto}
				{@const status = data.authStatus[proto.key as keyof AuthStatus] ?? 'none'}
				<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
					<div class="flex items-center justify-between mb-3">
						<div>
							<span class="text-lg font-bold text-[var(--color-text)]">{proto.label}</span>
							<span class="ml-2 text-xs text-[var(--color-text-secondary)]">{proto.full}</span>
						</div>
						<span class="rounded-full px-3 py-1 text-xs font-semibold uppercase {badgeClass(status)}">{status}</span>
					</div>
					<p class="text-xs text-[var(--color-text-secondary)] mb-3">{proto.desc}</p>
					{#if status === 'pass' && data.authDetails}
						{@const records = proto.key === 'spf' ? data.authDetails.spfRecords : proto.key === 'dmarc' ? data.authDetails.dmarcRecords : data.authDetails.dkimRecords}
						<div class="space-y-1">
							{#each records.filter(r => r.includes('v=spf') || r.includes('v=DMARC') || r.includes('domainkey')).slice(0, 2) as record}
								<div class="rounded-lg bg-[var(--color-bg)] px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)] break-all">{record.replace(/^"|"$/g, '')}</div>
							{/each}
						</div>
						{#if proto.key === 'dmarc' && data.authDetails.dmarcPolicy}
							<div class="mt-2 flex items-center gap-2">
								<span class="text-xs text-[var(--color-text-secondary)]">Policy:</span>
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {data.authDetails.dmarcPolicy === 'reject' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : data.authDetails.dmarcPolicy === 'quarantine' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}">{data.authDetails.dmarcPolicy}</span>
								{#if data.authDetails.dmarcPolicy === 'none'}
									<span class="text-[10px] text-[var(--color-danger)]">Not enforcing — upgrade to quarantine or reject</span>
								{/if}
							</div>
						{/if}
					{:else if status === 'none'}
						<div class="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-3">
							<p class="text-xs font-medium text-[var(--color-danger)]">Not configured</p>
							<p class="mt-1 text-[11px] text-[var(--color-text-secondary)]">{proto.fix}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Domain info -->
		{#if data.authDetails}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<h2 class="mb-3 section-title">Domain Details</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<p class="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Domain</p>
						<p class="mt-0.5 text-sm font-medium text-[var(--color-text)]">{data.authDetails.domain}</p>
					</div>
					<div>
						<p class="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">DMARC Policy</p>
						<p class="mt-0.5 text-sm font-medium text-[var(--color-text)]">{data.authDetails.dmarcPolicy}</p>
					</div>
					<div>
						<p class="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">SPF Records</p>
						<p class="mt-0.5 text-sm font-medium text-[var(--color-text)]">{data.authDetails.spfRecords.length}</p>
					</div>
					<div>
						<p class="text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">Last Checked</p>
						<p class="mt-0.5 text-sm font-medium text-[var(--color-text)]">{new Date(data.authDetails.lastChecked).toLocaleTimeString()}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Threats -->
		{#if data.threats.length === 0}
			<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
				<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/10">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
				</div>
				<p class="text-sm font-medium text-[var(--color-text)]">No active email threats</p>
				<p class="mt-1 text-xs text-[var(--color-text-secondary)]">All emails passed security checks in the last 24 hours.</p>
			</div>
		{/if}
	{/if}
</div>
