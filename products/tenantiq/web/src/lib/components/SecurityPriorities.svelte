<script lang="ts">
	/**
	 * Security Priorities Panel
	 *
	 * Displays top 5 industry-tailored security controls
	 * from the tenant's security baseline.
	 */
	import { api } from '$api/client';
	import { onMount } from 'svelte';

	interface Props {
		tenantId: string;
	}

	let { tenantId }: Props = $props();

	interface SecurityControl {
		priority: number;
		category: string;
		control: string;
		description: string;
		status: 'required' | 'recommended' | 'optional';
		regulations: string[];
		industryRelevance: string;
	}

	interface BaselineResponse {
		baseline: SecurityControl[];
		industry: string;
		compliance?: string[];
	}

	let baseline = $state<SecurityControl[]>([]);
	let industry = $state('');
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await api.get<BaselineResponse>(
				`/tenants/${tenantId}/security-baseline`,
			);
			if (res?.baseline?.length) {
				baseline = res.baseline.slice(0, 5);
				industry = res.industry || '';
			}
		} catch {
			// Silently fail - section simply won't render
		} finally {
			loading = false;
		}
	});

	function statusBadge(status: string): { label: string; classes: string } {
		if (status === 'required') {
			return {
				label: 'Required',
				classes: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
			};
		}
		if (status === 'recommended') {
			return {
				label: 'Recommended',
				classes: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
			};
		}
		return {
			label: 'Optional',
			classes: 'bg-[var(--color-text-tertiary)]/10 text-[var(--color-text-tertiary)]',
		};
	}

	function formatIndustry(raw: string): string {
		if (!raw) return '';
		return raw.charAt(0).toUpperCase() + raw.slice(1);
	}
</script>

{#if !loading && baseline.length > 0}
	<section class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-[var(--color-text)]">
				Security Priorities{industry ? ` for ${formatIndustry(industry)}` : ''}
			</h2>
			<a
				href="/security"
				class="text-xs font-medium text-[var(--color-primary)] hover:underline"
			>
				View all
			</a>
		</div>
		<div class="space-y-3">
			{#each baseline as control (control.priority)}
				{@const badge = statusBadge(control.status)}
				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]"
					>
						{control.priority}
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-[var(--color-text)]">
								{control.control}
							</span>
							<span
								class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold {badge.classes}"
							>
								{badge.label}
							</span>
						</div>
						<p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">
							{control.description}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
