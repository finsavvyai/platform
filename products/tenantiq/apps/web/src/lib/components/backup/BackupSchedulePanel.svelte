<script lang="ts">
	import { untrack } from 'svelte';
	import { toasts } from '$stores/toast';

	interface Schedule {
		enabled: boolean;
		frequency: 'daily' | 'weekly' | 'monthly';
		time: string;
		dayOfWeek?: number;
		dayOfMonth?: number;
		retentionDays: number;
		lastRun: string | null;
		nextRun: string | null;
	}

	interface Props {
		schedule: Schedule;
		onSave: (s: Schedule) => void;
	}

	let { schedule, onSave }: Props = $props();

	let editing = $state(false);
	let draft = $state<Schedule>({ ...untrack(() => schedule) });

	function startEdit() { draft = { ...schedule }; editing = true; }
	function cancel() { editing = false; }
	function save() { onSave(draft); editing = false; toasts.success('Backup schedule updated'); }

	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	function formatNext(iso: string | null): string {
		if (!iso) return 'Not scheduled';
		return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-[var(--color-text)]">Backup Schedule</h2>
			<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Automate recurring encrypted backups</p>
		</div>
		{#if !editing}
			<button onclick={startEdit} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Configure</button>
		{/if}
	</div>

	{#if editing}
		<div class="mt-5 space-y-5">
			<label class="flex min-h-[44px] cursor-pointer items-center gap-3">
				<input type="checkbox" bind:checked={draft.enabled} class="h-5 w-5 rounded accent-[var(--color-primary)]" />
				<span class="text-sm font-medium text-[var(--color-text)]">Enable scheduled backups</span>
			</label>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-1.5">
					<label for="freq" class="block text-sm font-medium text-[var(--color-text)]">Frequency</label>
					<select id="freq" bind:value={draft.frequency} class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none">
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
						<option value="monthly">Monthly</option>
					</select>
				</div>

				<div class="space-y-1.5">
					<label for="time" class="block text-sm font-medium text-[var(--color-text)]">Time (UTC)</label>
					<input id="time" type="time" bind:value={draft.time} class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none" />
				</div>
			</div>

			{#if draft.frequency === 'weekly'}
				<div class="space-y-1.5">
					<label for="dow" class="block text-sm font-medium text-[var(--color-text)]">Day of week</label>
					<select id="dow" bind:value={draft.dayOfWeek} class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none">
						{#each dayNames as day, i}<option value={i}>{day}</option>{/each}
					</select>
				</div>
			{/if}

			{#if draft.frequency === 'monthly'}
				<div class="space-y-1.5">
					<label for="dom" class="block text-sm font-medium text-[var(--color-text)]">Day of month</label>
					<select id="dom" bind:value={draft.dayOfMonth} class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none">
						{#each Array.from({ length: 28 }, (_, i) => i + 1) as d}<option value={d}>{d}</option>{/each}
					</select>
				</div>
			{/if}

			<div class="space-y-1.5">
				<label for="ret" class="block text-sm font-medium text-[var(--color-text)]">Retention (days)</label>
				<select id="ret" bind:value={draft.retentionDays} class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none">
					<option value={30}>30 days</option>
					<option value={90}>90 days</option>
					<option value={180}>180 days</option>
					<option value={365}>365 days</option>
				</select>
			</div>

			<div class="flex gap-2 pt-2">
				<button onclick={cancel} class="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]">Cancel</button>
				<button onclick={save} class="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">Save Schedule</button>
			</div>
		</div>
	{:else}
		<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Status</p>
				<p class="mt-1 text-sm font-semibold {schedule.enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}">{schedule.enabled ? 'Active' : 'Disabled'}</p>
			</div>
			<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Frequency</p>
				<p class="mt-1 text-sm font-semibold capitalize text-[var(--color-text)]">{schedule.frequency} at {schedule.time} UTC</p>
			</div>
			<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Next backup</p>
				<p class="mt-1 text-sm font-semibold text-[var(--color-text)]">{formatNext(schedule.nextRun)}</p>
			</div>
			<div class="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
				<p class="text-xs text-[var(--color-text-secondary)]">Retention</p>
				<p class="mt-1 text-sm font-semibold text-[var(--color-text)]">{schedule.retentionDays} days</p>
			</div>
		</div>
	{/if}
</section>
