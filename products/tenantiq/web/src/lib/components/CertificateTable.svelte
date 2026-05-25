<script lang="ts">
	import CopyButton from './ui/CopyButton.svelte';

	interface Certificate {
		appName: string; appId: string; type: string;
		expiresAt: string; daysUntilExpiry: number; status: string;
	}

	interface Props {
		certificates: Certificate[];
		onSelect?: (cert: Certificate) => void;
	}

	let { certificates, onSelect }: Props = $props();

	const sorted = $derived([...certificates].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry));

	let reminderTarget = $state<Certificate | null>(null);
	let reminderChannel = $state<'email' | 'sms'>('email');
	let reminderNotes = $state('');
	let reminderDaysBefore = $state(30);

	function openReminder(cert: Certificate, e: MouseEvent) {
		e.stopPropagation();
		reminderTarget = cert;
		reminderNotes = `Certificate "${cert.appName}" (${cert.type}) expires ${formatDate(cert.expiresAt)}`;
	}

	function saveReminder() {
		// Store reminder in localStorage (would POST to API in production)
		const reminders = JSON.parse(localStorage.getItem('tenantiq_reminders') ?? '[]');
		reminders.push({ certId: reminderTarget?.appId, channel: reminderChannel, notes: reminderNotes, daysBefore: reminderDaysBefore, createdAt: new Date().toISOString() });
		localStorage.setItem('tenantiq_reminders', JSON.stringify(reminders));
		reminderTarget = null;
		reminderNotes = '';
	}

	function statusClass(status: string): string {
		if (status === 'critical' || status === 'expired') return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
		if (status === 'warning' || status === 'expiring') return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
		return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
	}

	function statusLabel(status: string): string {
		if (status === 'critical' || status === 'expired') return 'Expired';
		if (status === 'warning' || status === 'expiring') return 'Expiring';
		return 'Valid';
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDaysShort(days: number): string {
		if (days < 0) return `${Math.abs(days)}d ago`;
		if (days <= 90) return `${days}d`;
		if (days <= 365) return `${Math.floor(days / 30)}mo`;
		return `${(days / 365).toFixed(1)}y`;
	}

	function formatDaysLong(days: number): string {
		const abs = Math.abs(days);
		const years = Math.floor(abs / 365);
		const months = Math.floor((abs % 365) / 30);
		const d = abs % 30;
		const parts: string[] = [];
		if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
		if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
		if (d > 0 || parts.length === 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
		return (days < 0 ? 'Expired ' : '') + parts.join(', ') + (days < 0 ? ' ago' : '') + ` (${abs} days)`;
	}
</script>

<div>
	<h2 class="mb-3 text-lg font-semibold text-[var(--color-text)]">Certificate & Secret Expiration</h2>
	<div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
		<table class="min-w-full">
			<thead class="bg-[var(--color-bg)]">
				<tr>
					<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Application</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Type</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Expires</th>
					<th class="px-3 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Days Left</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
					<th class="w-10 px-2 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
				{#each sorted as cert}
					<tr
						class="group transition-colors {onSelect ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)]' : ''}"
						onclick={() => onSelect?.(cert)}
					>
						<td class="px-3 py-3">
							<p class="text-sm font-medium text-[var(--color-text)]">{cert.appName}</p>
							<div class="flex items-center gap-1">
								<code class="select-all text-xs text-[var(--color-text-secondary)]">{cert.appId}</code>
							</div>
						</td>
						<td class="px-3 py-3 text-sm text-[var(--color-text)]">{cert.type}</td>
						<td class="px-3 py-3 text-sm text-[var(--color-text-secondary)]">{formatDate(cert.expiresAt)}</td>
						<td class="px-3 py-3 text-right text-sm font-medium text-[var(--color-text)]" title={formatDaysLong(cert.daysUntilExpiry)}>
							<span class="{cert.daysUntilExpiry < 0 ? 'text-[var(--color-danger)]' : cert.daysUntilExpiry <= 30 ? 'text-[var(--color-warning)]' : ''}">{formatDaysShort(cert.daysUntilExpiry)}</span>
						</td>
						<td class="px-3 py-3">
							<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusClass(cert.status)}">{statusLabel(cert.status)}</span>
						</td>
						<td class="px-2 py-3">
							<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button onclick={(e) => openReminder(cert, e)} class="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]" title="Set reminder">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
								</button>
								<CopyButton value={cert.appId} label="App ID copied" />
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && reminderTarget) reminderTarget = null; }} />

{#if reminderTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-transparent"
			onclick={() => (reminderTarget = null)}
			aria-label="Close reminder dialog"
		></button>
		<div class="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
			<h3 id="reminder-title" class="text-base font-bold text-[var(--color-text)]">Set Expiry Reminder</h3>
			<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{reminderTarget.appName} — expires {formatDate(reminderTarget.expiresAt)}</p>
			<div class="mt-4 space-y-3">
				<div>
					<span id="reminder-channel-label" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Notify via</span>
					<div class="flex gap-2" role="group" aria-labelledby="reminder-channel-label">
						<button onclick={() => (reminderChannel = 'email')} class="flex-1 rounded-lg border py-2 text-xs font-medium transition-all {reminderChannel === 'email' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}">Email</button>
						<button onclick={() => (reminderChannel = 'sms')} class="flex-1 rounded-lg border py-2 text-xs font-medium transition-all {reminderChannel === 'sms' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}">SMS</button>
					</div>
				</div>
				<div>
					<label for="reminder-days" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Remind me</label>
					<select id="reminder-days" bind:value={reminderDaysBefore} class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
						<option value={7}>7 days before</option>
						<option value={14}>14 days before</option>
						<option value={30}>30 days before</option>
						<option value={60}>60 days before</option>
						<option value={90}>90 days before</option>
					</select>
				</div>
				<div>
					<label for="reminder-notes" class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Notes</label>
					<textarea id="reminder-notes" bind:value={reminderNotes} rows="3" class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]" placeholder="Add context or instructions..."></textarea>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (reminderTarget = null)} class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">Cancel</button>
				<button onclick={saveReminder} class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">Save Reminder</button>
			</div>
		</div>
	</div>
{/if}
