<script lang="ts">
	import { api } from '$api/client';
	import { onMount } from 'svelte';

	interface Props {
		tenantId: string;
		onComplete: () => void;
	}

	interface SyncStatus {
		status: string;
		progress: number;
		message: string;
	}

	let { tenantId, onComplete }: Props = $props();

	let progress = $state(0);
	let message = $state('Starting sync...');
	let phase = $state('starting');
	let visible = $state(true);
	let polling = $state(true);
	let displayProgress = $state(0);

	const phaseIcons: Record<string, string> = {
		users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
		licenses: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75',
		security: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
		complete: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
	};

	const currentIcon = $derived(phaseIcons[phase] ?? phaseIcons.users);

	// Smooth progress animation
	$effect(() => {
		const target = progress;
		const step = () => {
			if (displayProgress < target) {
				displayProgress = Math.min(displayProgress + 2, target);
				requestAnimationFrame(step);
			}
		};
		requestAnimationFrame(step);
	});

	onMount(() => {
		const interval = setInterval(async () => {
			if (!polling) return;
			try {
				const data = await api.get<SyncStatus>(`/tenants/${tenantId}/sync/status`);
				progress = data.progress;
				message = data.message;
				phase = data.status;

				if (data.status === 'complete' || data.status === 'idle') {
					polling = false;
					progress = 100;
					message = data.status === 'complete' ? 'Sync complete' : data.message;
					setTimeout(() => { visible = false; onComplete(); }, 3000);
				}
				if (data.status === 'error') {
					polling = false;
					setTimeout(() => { visible = false; }, 5000);
				}
			} catch {
				// Keep polling on network errors
			}
		}, 2000);

		return () => clearInterval(interval);
	});
</script>

{#if visible}
	<div class="animate-fade-up overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
		<div class="flex items-center gap-3 px-4 py-3">
			<svg xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4 flex-shrink-0 {phase === 'complete' ? 'text-[var(--color-success)]' : phase === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}"
				fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d={currentIcon}/>
			</svg>
			<span class="flex-1 text-sm font-medium text-[var(--color-text)]">{message}</span>
			<span class="text-xs tabular-nums text-[var(--color-text-tertiary)]">{displayProgress}%</span>
		</div>
		<div class="h-1 w-full bg-[var(--color-border)]">
			<div
				class="h-full transition-all duration-500 ease-out {phase === 'complete' ? 'bg-[var(--color-success)]' : phase === 'error' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-primary)]'}"
				style="width: {displayProgress}%"
			></div>
		</div>
	</div>
{/if}
