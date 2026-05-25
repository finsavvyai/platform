<script lang="ts">
	/**
	 * TenantIQ Platform Hub
	 *
	 * Navigation hub for platform management with links to:
	 * - Admin CRM Dashboard
	 * - Users Management
	 * - Organizations Management
	 * - Subscriptions & Billing
	 */

	import Card from '$lib/components/ui/Card.svelte';
	import { Users, Building2, CreditCard, TrendingUp, ArrowUpRight, DollarSign, LayoutDashboard } from 'lucide-svelte';

	type RecentOrg = { id: string; name: string; tier: string; status: string; users: number; mrr: number };
	let stats = $state({
		totalOrganizations: 0, activeSubscriptions: 0, monthlyRecurringRevenue: 0,
		totalUsers: 0, organizationsChange: 0, mrrChange: 0,
		recentOrganizations: [] as RecentOrg[]
	});

	const tierColors: Record<string, string> = {
		Starter: 'text-[var(--color-gray)]',
		Professional: 'text-[var(--color-primary)]',
		Enterprise: 'text-[var(--color-orange)]',
		Custom: 'text-[var(--color-green)]'
	};

	const statusColors: Record<string, string> = {
		active: 'bg-[var(--color-success)] text-white',
		trial: 'bg-[var(--color-orange)] text-white',
		past_due: 'bg-[var(--color-danger)] text-white',
		cancelled: 'bg-[var(--color-gray)] text-white'
	};

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency', currency: 'USD', minimumFractionDigits: 0
		}).format(amount);
	}

	const adminLinks = [
		{ href: '/platform/admin', label: 'Admin Dashboard', icon: LayoutDashboard, desc: 'CRM overview and metrics' },
		{ href: '/platform/admin/users', label: 'Users', icon: Users, desc: 'Manage all platform users' },
		{ href: '/platform/admin/orgs', label: 'Organizations', icon: Building2, desc: 'Manage customer organizations' },
		{ href: '/platform/subscriptions', label: 'Subscriptions', icon: CreditCard, desc: 'Billing and plan management' }
	];
</script>

<svelte:head>
	<title>Platform Dashboard - TenantIQ</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg-secondary)]">
	<header class="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] hig-header">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-16">
				<div>
					<h1 class="text-2xl font-semibold text-[var(--color-text)]">Platform Dashboard</h1>
					<p class="text-sm text-[var(--color-text-secondary)]">Manage all customer organizations</p>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Admin Navigation -->
		<div class="mb-8">
			<h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">Admin Tools</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each adminLinks as link}
					<a href={link.href}>
						<Card variant="elevated" padding="md" hoverable clickable>
							<div class="flex items-center gap-4">
								<div class="p-3 rounded-lg bg-[var(--color-primary)] bg-opacity-10">
									<link.icon class="w-6 h-6 text-[var(--color-primary)]" />
								</div>
								<div class="flex-1 min-w-0">
									<h3 class="font-semibold text-[var(--color-text)]">{link.label}</h3>
									<p class="text-xs text-[var(--color-text-secondary)] truncate">{link.desc}</p>
								</div>
								<ArrowUpRight class="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
							</div>
						</Card>
					</a>
				{/each}
			</div>
		</div>

		<!-- Stats Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
			<Card variant="elevated" padding="md" hoverable>
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm font-medium text-[var(--color-text-secondary)]">Organizations</p>
						<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{stats.totalOrganizations}</p>
						<div class="flex items-center gap-1 mt-2">
							<ArrowUpRight class="w-3 h-3 text-[var(--color-success)]" />
							<span class="text-xs text-[var(--color-success)]">+{stats.organizationsChange}%</span>
						</div>
					</div>
					<div class="p-3 rounded-lg bg-[var(--color-primary)] bg-opacity-10">
						<Building2 class="w-6 h-6 text-[var(--color-primary)]" />
					</div>
				</div>
			</Card>
			<a href="/platform/subscriptions">
				<Card variant="elevated" padding="md" hoverable clickable>
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-[var(--color-text-secondary)]">Active Subscriptions</p>
							<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{stats.activeSubscriptions}</p>
							<p class="text-xs text-[var(--color-text-secondary)] mt-2">
								{stats.totalOrganizations - stats.activeSubscriptions} in trial
							</p>
						</div>
						<div class="p-3 rounded-lg bg-[var(--color-success)] bg-opacity-10">
							<CreditCard class="w-6 h-6 text-[var(--color-success)]" />
						</div>
					</div>
				</Card>
			</a>
			<Card variant="elevated" padding="md" hoverable>
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm font-medium text-[var(--color-text-secondary)]">MRR</p>
						<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{formatCurrency(stats.monthlyRecurringRevenue)}</p>
						<div class="flex items-center gap-1 mt-2">
							<TrendingUp class="w-3 h-3 text-[var(--color-success)]" />
							<span class="text-xs text-[var(--color-success)]">+{stats.mrrChange}%</span>
						</div>
					</div>
					<div class="p-3 rounded-lg bg-[var(--color-orange)] bg-opacity-10">
						<DollarSign class="w-6 h-6 text-[var(--color-orange)]" />
					</div>
				</div>
			</Card>
			<Card variant="elevated" padding="md" hoverable>
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm font-medium text-[var(--color-text-secondary)]">Total Users</p>
						<p class="text-3xl font-semibold text-[var(--color-text)] mt-2">{stats.totalUsers}</p>
						<p class="text-xs text-[var(--color-text-secondary)] mt-2">Across all organizations</p>
					</div>
					<div class="p-3 rounded-lg bg-[var(--color-green)] bg-opacity-10">
						<Users class="w-6 h-6 text-[var(--color-green)]" />
					</div>
				</div>
			</Card>
		</div>

		<!-- Recent Organizations -->
		<Card variant="elevated" padding="none">
			<div class="p-6 border-b border-[var(--color-border)]">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold text-[var(--color-text)]">Recent Organizations</h2>
					<a href="/platform/admin/orgs" class="text-sm text-[var(--color-primary)] hover:underline">View All</a>
				</div>
			</div>
			<div class="divide-y divide-[var(--color-border)]">
				{#each stats.recentOrganizations as org}
					<div class="p-6 hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4 flex-1">
								<div class="w-10 h-10 rounded-lg bg-[var(--color-primary)] bg-opacity-10 flex items-center justify-center">
									<Building2 class="w-5 h-5 text-[var(--color-primary)]" />
								</div>
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<h3 class="font-medium text-[var(--color-text)]">{org.name}</h3>
										<span class="px-2 py-0.5 text-xs font-medium rounded-full {statusColors[org.status]}">{org.status}</span>
									</div>
									<p class="text-sm text-[var(--color-text-secondary)] mt-0.5">
										<span class={tierColors[org.tier]}>{org.tier}</span> · {org.users} users
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="font-semibold text-[var(--color-text)]">
									{formatCurrency(org.mrr)}
									<span class="text-sm font-normal text-[var(--color-text-secondary)]">/mo</span>
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	</main>
</div>

<style>
	.hig-header { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
</style>
