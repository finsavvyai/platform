<script lang="ts">
	interface SignIn {
		user: string;
		email?: string;
		ip: string;
		riskLevel: 'high' | 'medium' | 'low';
		location: string;
		time: string;
	}

	interface Props {
		signins: SignIn[];
		loading?: boolean;
	}

	let { signins, loading = false }: Props = $props();

	function formatTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	const riskColor = (level: string) => {
		switch (level) {
			case 'high': return 'text-[#dc2626]';
			case 'medium': return 'text-[#f59e0b]';
			default: return 'text-[#3b82f6]';
		}
	};

	const riskBg = (level: string) => {
		switch (level) {
			case 'high': return 'bg-[#dc2626]/10';
			case 'medium': return 'bg-[#f59e0b]/10';
			default: return 'bg-[#3b82f6]/10';
		}
	};
</script>

<div class="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
	{#if loading}
		<div class="p-6 text-center text-sm text-[var(--color-text-secondary)]">Loading risky sign-ins...</div>
	{:else if signins.length === 0}
		<div class="p-8 text-center">
			<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="mt-2 text-sm font-medium text-[var(--color-text)]">No risky sign-ins detected</p>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">Your recent sign-in activity looks secure</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">User</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">IP Address</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Risk Level</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Location</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)]">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each signins as signin (signin.time + signin.email)}
						<tr class="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-secondary)]">
							<td class="px-4 py-3 text-sm">
								<div>
									<p class="font-medium text-[var(--color-text)]">{signin.user}</p>
									{#if signin.email}
										<p class="text-xs text-[var(--color-text-secondary)]">{signin.email}</p>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-sm font-mono text-[var(--color-text-secondary)]">{signin.ip}</td>
							<td class="px-4 py-3 text-sm">
								<span class="inline-flex items-center gap-1 rounded-lg {riskBg(signin.riskLevel)} px-2 py-1">
									<span class="h-1.5 w-1.5 rounded-full {riskColor(signin.riskLevel)}"></span>
									<span class="text-xs font-medium {riskColor(signin.riskLevel)}">{signin.riskLevel.charAt(0).toUpperCase() + signin.riskLevel.slice(1)}</span>
								</span>
							</td>
							<td class="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{signin.location}</td>
							<td class="px-4 py-3 text-sm text-[var(--color-text-tertiary)]">{formatTime(signin.time)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
