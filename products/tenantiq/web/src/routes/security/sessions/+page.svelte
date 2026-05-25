<script lang="ts">
	import MfaCoverageRing from '$lib/components/sessions/MfaCoverageRing.svelte';
	import SessionProtectionCard from '$lib/components/sessions/SessionProtectionCard.svelte';
	import RiskySigninsTable from '$lib/components/sessions/RiskySigninsTable.svelte';
	import TokenForgeCard from '$lib/components/sessions/TokenForgeCard.svelte';
	import TokenForgeSetupModal from '$lib/components/sessions/TokenForgeSetupModal.svelte';
	import MetricCard from '$components/MetricCard.svelte';
	import ExportMenu from '$components/ui/ExportMenu.svelte';
	import { tenant } from '$stores/tenant';
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { copyToClipboard } from '$utils/export';
	import { formatNumber } from '$utils/format';
	import { untrack } from 'svelte';

	interface SecurityData {
		mfaCoverage?: { enrolled: number; total: number; percentage: number };
		activeSessions?: number;
		conditionalAccessPolicies?: number;
		tokenLifetimePolicies?: boolean;
		sessionRevocationEnabled?: boolean;
		signInRiskPolicy?: boolean;
		riskySignins?: Array<{ user: string; email: string; ip: string; riskLevel: 'high' | 'medium' | 'low'; location: string; time: string }>;
	}

	interface TokenForgeStatus {
		enabled: boolean; configured: boolean; enforceMode: string;
		maxDevicesPerUser?: number; bindingTtlDays?: number; autoRevokeOnRisk?: boolean;
		stats: { totalBindings: number; activeBindings: number; revokedBindings: number; recentEvents: number };
	}

	let securityData = $state<SecurityData | null>(null);
	let loading = $state(true);
	let tfStatus = $state<TokenForgeStatus | null>(null);
	let tfLoading = $state(false);
	let showSetupModal = $state(false);

	$effect(() => {
		if ($tenant.currentTenantId) untrack(() => { loadSecurityData(); loadTokenForgeStatus(); });
	});

	async function loadSecurityData() {
		loading = true;
		try {
			securityData = await api.get<SecurityData>(`/tenants/${$tenant.currentTenantId}/security`);
		} catch {
			securityData = getMockData();
		} finally { loading = false; }
	}

	async function loadTokenForgeStatus() {
		tfLoading = true;
		try { tfStatus = await api.get<TokenForgeStatus>(`/tenants/${$tenant.currentTenantId}/tokenforge/status`); }
		catch { tfStatus = null; }
		finally { tfLoading = false; }
	}

	async function handleSetupSubmit(config: { enforceMode: string; maxDevicesPerUser: number; bindingTtlDays: number; autoRevokeOnRisk: boolean }) {
		await api.post(`/tenants/${$tenant.currentTenantId}/tokenforge/setup`, config);
		toasts.success('TokenForge configured successfully');
		showSetupModal = false;
		await loadTokenForgeStatus();
		// Auto-bind the current device so the newly configured tenant immediately has one
		// registered device — otherwise the user would need to reload for bindCurrentDevice
		// to retry. sessionStorage key is cleared first to force a retry this session.
		try {
			sessionStorage.removeItem(`tq_tf_bound:${$tenant.currentTenantId}`);
			const { bindCurrentDevice } = await import('$lib/utils/tokenforge-bind');
			await bindCurrentDevice();
			toasts.success('This device has been registered');
			await loadTokenForgeStatus();
		} catch {
			/* Non-blocking — user can rebind from Sessions if needed */
		}
	}

	async function handleToggle(enabled: boolean) {
		try {
			await api.post(`/tenants/${$tenant.currentTenantId}/tokenforge/toggle`, { enabled });
			toasts.success(enabled ? 'TokenForge resumed' : 'TokenForge paused');
			await loadTokenForgeStatus();
		} catch { toasts.error('Failed to update TokenForge'); }
	}

	function getMockData(): SecurityData {
		return {
			mfaCoverage: { enrolled: 185, total: 220, percentage: 84 }, activeSessions: 412,
			conditionalAccessPolicies: 8, tokenLifetimePolicies: true, sessionRevocationEnabled: true, signInRiskPolicy: true,
			riskySignins: [
				{ user: 'John Smith', email: 'john.smith@company.com', ip: '203.0.113.45', riskLevel: 'high', location: 'Vladivostok, Russia', time: new Date(Date.now() - 2 * 60000).toISOString() },
				{ user: 'Sarah Johnson', email: 'sarah.j@company.com', ip: '198.51.100.92', riskLevel: 'medium', location: 'Lagos, Nigeria', time: new Date(Date.now() - 25 * 60000).toISOString() },
			],
		};
	}

	async function handleCopyLink() { if (await copyToClipboard(window.location.href)) toasts.success('Link copied to clipboard'); }

	const hasData = $derived(securityData != null);
	const mfaPercentage = $derived(securityData?.mfaCoverage?.percentage ?? 0);
	const mfaEnrolled = $derived(securityData?.mfaCoverage?.enrolled ?? 0);
	const mfaTotal = $derived(securityData?.mfaCoverage?.total ?? 0);
	const activeSessions = $derived(securityData?.activeSessions ?? 0);
	const conditionalAccessCount = $derived(securityData?.conditionalAccessPolicies ?? 0);
	const riskySigninsList = $derived(securityData?.riskySignins ?? []);
</script>

<svelte:head><title>Session Security | TenantIQ</title></svelte:head>

<div class="space-y-6">
	<div class="animate-fade-up flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--color-text)]">Session Security</h1>
			<p class="text-[var(--color-text-secondary)]">MFA coverage, Conditional Access, and risky sign-in activity</p>
		</div>
		{#if hasData}<ExportMenu onCopyLink={handleCopyLink} disabled={loading} />{/if}
	</div>

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each Array(4) as _, i}<div class="h-40 skeleton rounded-2xl delay-{i + 1}"></div>{/each}
		</div>
	{:else if hasData}
		<div class="animate-fade-up delay-1"><MfaCoverageRing percentage={mfaPercentage} total={mfaTotal} enrolled={mfaEnrolled} /></div>

		<div class="animate-fade-up delay-2">
			<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Protection Status</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<SessionProtectionCard title="Conditional Access" status={conditionalAccessCount > 0 ? 'active' : 'inactive'} description="{conditionalAccessCount} {conditionalAccessCount === 1 ? 'policy' : 'policies'} active" icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
				<SessionProtectionCard title="Token Lifetime" status={securityData?.tokenLifetimePolicies ? 'active' : 'inactive'} description={securityData?.tokenLifetimePolicies ? 'Configured and active' : 'Not configured'} icon="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				<SessionProtectionCard title="Session Revocation" status={securityData?.sessionRevocationEnabled ? 'active' : 'inactive'} description={securityData?.sessionRevocationEnabled ? 'Enabled' : 'Disabled'} icon="M6 18L18 6M6 6l12 12" />
				<SessionProtectionCard title="Sign-in Risk Policy" status={securityData?.signInRiskPolicy ? 'active' : 'partial'} description={securityData?.signInRiskPolicy ? 'Monitoring active' : 'Detection only'} icon="M12 9v2m0 4v2m0 4v2M7.5 3h9C18.33 3 19 3.67 19 4.5v15c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5v-15C6 3.67 6.67 3 7.5 3z" />
			</div>
		</div>

		<div class="animate-fade-up delay-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div><MetricCard title="Active Sessions" value={formatNumber(activeSessions)} subtitle="Currently connected" icon="M13 10V3L4 14h7v7l9-11h-7z" /></div>
			<div><MetricCard title="Risky Sign-ins" value={formatNumber(riskySigninsList.filter((s) => s.riskLevel === 'high').length)} subtitle="High risk in last 24h" icon="M12 9v2m0 4v2m0 4v2M7.5 3h9C18.33 3 19 3.67 19 4.5v15c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5v-15C6 3.67 6.67 3 7.5 3z" /></div>
		</div>

		{#if riskySigninsList.length > 0}
			<div class="animate-fade-up delay-4">
				<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Recent Risky Sign-ins</h2>
				<RiskySigninsTable signins={riskySigninsList} />
			</div>
		{/if}

		<div class="animate-fade-up delay-5">
			<TokenForgeCard status={tfStatus} loading={tfLoading} onSetup={() => (showSetupModal = true)} onToggle={handleToggle} />
		</div>
	{/if}
</div>

<TokenForgeSetupModal
	open={showSetupModal}
	isUpdate={tfStatus?.configured ?? false}
	initialMode={(tfStatus?.enforceMode ?? 'monitor') as 'monitor' | 'enforce' | 'strict'}
	initialMaxDevices={tfStatus?.maxDevicesPerUser ?? 5}
	initialTtlDays={tfStatus?.bindingTtlDays ?? 90}
	initialAutoRevoke={tfStatus?.autoRevokeOnRisk ?? true}
	onClose={() => (showSetupModal = false)}
	onSubmit={handleSetupSubmit}
/>
