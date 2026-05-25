<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { tenant } from '$stores/tenant';
	import { untrack } from 'svelte';

	interface Schedule {
		frequency: 'daily' | 'weekly' | 'none';
		enabled: boolean;
		cronHour: number;
		updatedBy: string;
		updatedAt: string;
	}

	let schedule = $state<Schedule | null>(null);
	let frequency = $state<'daily' | 'weekly' | 'none'>('none');
	let loading = $state(true);
	let saving = $state(false);

	$effect(() => { if ($tenant.currentTenantId) untrack(() => loadSchedule()); });

	async function loadSchedule() {
		loading = true;
		try {
			const res = await api.get<{ schedule: Schedule }>('/config-snapshots/schedule');
			schedule = res.schedule;
			frequency = res.schedule.frequency;
		} catch { schedule = null; }
		finally { loading = false; }
	}

	async function saveSchedule() {
		saving = true;
		try {
			const res = await api.post<{ success: boolean; schedule: Schedule; error?: string }>(
				'/config-snapshots/schedule',
				{ frequency },
			);
			if (res.error) { toasts.error(res.error); return; }
			schedule = res.schedule;
			toasts.success(frequency === 'none' ? 'Scheduled snapshots disabled' : `Snapshots set to ${frequency}`);
		} catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save schedule'); }
		finally { saving = false; }
	}

	const hasChanged = $derived(schedule ? frequency !== schedule.frequency : false);
</script>

<div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Snapshot Schedule</h3>
	<p class="mb-4 text-xs text-[var(--color-text-secondary)]">
		Automatically capture config snapshots on a recurring basis.
	</p>

	{#if loading}
		<div class="h-10 skeleton rounded-lg"></div>
	{:else}
		<div class="flex items-center gap-3">
			<label for="schedule-freq" class="text-xs font-medium text-[var(--color-text-secondary)]">Frequency</label>
			<select id="schedule-freq" bind:value={frequency} class="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
				<option value="none">Disabled</option>
				<option value="daily">Daily (02:00 UTC)</option>
				<option value="weekly">Weekly (Sundays 02:00 UTC)</option>
			</select>
			<button onclick={saveSchedule} disabled={saving || !hasChanged} class="cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:shadow-[var(--shadow-md)] disabled:opacity-50">
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
		{#if schedule?.updatedBy}
			<p class="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
				Last updated by {schedule.updatedBy} on {new Date(schedule.updatedAt).toLocaleString()}
			</p>
		{/if}
	{/if}
</div>
