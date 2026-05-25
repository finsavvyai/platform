<script lang="ts">
	import { toasts } from '$stores/toast';

	interface Template {
		id: string;
		name: string;
		description: string;
		actions: string[];
		icon: string;
	}

	interface Props {
		configureProduct: (productId: string) => Promise<void>;
		tenantId: string;
	}

	let { configureProduct, tenantId }: Props = $props();

	let selectedTemplate = $state<string | null>(null);
	let isApplying = $state(false);

	const templates: Template[] = [
		{
			id: 'basic',
			name: 'Basic Protection',
			description: 'Essential security features',
			icon: '🛡️',
			actions: ['defender', 'mfa-basic']
		},
		{
			id: 'standard',
			name: 'Standard Security',
			description: 'Recommended for most organizations',
			icon: '🔒',
			actions: ['defender', 'defender-advanced', 'conditional-access', 'safe-links']
		},
		{
			id: 'enterprise',
			name: 'Enterprise Hardening',
			description: 'Maximum security posture',
			icon: '🏢',
			actions: ['defender', 'defender-advanced', 'conditional-access', 'safe-links', 'dlp', 'audit-logging']
		}
	];

	async function applyTemplate(template: Template) {
		if (!tenantId || isApplying) return;
		isApplying = true;
		selectedTemplate = template.id;
		let successCount = 0;
		let failCount = 0;

		for (const action of template.actions) {
			try {
				await configureProduct(action);
				successCount++;
			} catch {
				failCount++;
			}
		}

		isApplying = false;
		const message = `Applied ${template.name}: ${successCount} features configured${failCount > 0 ? ` (${failCount} failed)` : ''}`;
		toasts.success(message);
		selectedTemplate = null;
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
	{#each templates as template (template.id)}
		<div class="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]">
			<div class="flex flex-1 flex-col space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div class="text-3xl">{template.icon}</div>
					<input
						type="radio"
						name="template"
						value={template.id}
						bind:group={selectedTemplate}
						class="h-4 w-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-primary)]"
					/>
				</div>

				<div>
					<h3 class="font-semibold text-[var(--color-text)]">{template.name}</h3>
					<p class="mt-1 text-xs text-[var(--color-text-secondary)]">{template.description}</p>
				</div>

				<div class="space-y-2 border-t border-[var(--color-border)] pt-4">
					<p class="text-xs font-medium uppercase text-[var(--color-text-secondary)]">Includes</p>
					<ul class="space-y-1.5">
						{#each template.actions.slice(0, 3) as action}
							<li class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
								<svg class="h-3.5 w-3.5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
								</svg>
								{action}
							</li>
						{/each}
						{#if template.actions.length > 3}
							<li class="text-xs text-[var(--color-text-tertiary)]">+{template.actions.length - 3} more</li>
						{/if}
					</ul>
				</div>

				<button
					onclick={() => applyTemplate(template)}
					disabled={isApplying}
					class="mt-auto w-full rounded-lg bg-[var(--color-primary)]/10 py-2 text-xs font-medium text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isApplying && selectedTemplate === template.id ? 'Applying...' : 'Apply Template'}
				</button>
			</div>
		</div>
	{/each}
</div>
