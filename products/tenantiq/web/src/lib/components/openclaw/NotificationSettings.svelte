<script lang="ts">
	interface Props {
		notificationMode: 'realtime' | 'digest';
		minSeverity: 'low' | 'medium' | 'high' | 'critical';
		categories: string[];
		onModeChange: (val: 'realtime' | 'digest') => void;
		onSeverityChange: (val: string) => void;
		onCategoriesChange: (val: string[]) => void;
	}

	let { notificationMode, minSeverity, categories, onModeChange, onSeverityChange, onCategoriesChange }: Props = $props();

	const availableCategories = [
		{ id: 'security', label: 'Security', icon: '🔒' },
		{ id: 'licenses', label: 'License Optimization', icon: '💰' },
		{ id: 'users', label: 'User Management', icon: '👥' },
		{ id: 'compliance', label: 'Compliance', icon: '📋' },
		{ id: 'tenants', label: 'Tenant Management', icon: '🏢' }
	];

	function toggleCategory(id: string) {
		const next = categories.includes(id) ? categories.filter(c => c !== id) : [...categories, id];
		onCategoriesChange(next);
	}
</script>

<section class="space-y-5 border-b border-[var(--color-border)] pb-6">
	<h3 class="text-sm font-semibold text-[var(--color-text)]">Notification Settings</h3>

	<div class="space-y-2">
		<p class="text-sm font-medium text-[var(--color-text)]">Notification Mode</p>
		<div class="grid grid-cols-2 gap-3">
			{#each [
				{ value: 'realtime', label: 'Real-time', desc: 'Send notifications immediately' },
				{ value: 'digest', label: 'Digest', desc: 'Batch notifications (hourly summary)' }
			] as option}
				<label
					class="flex min-h-[44px] cursor-pointer flex-col rounded-lg border-2 p-3 transition-colors
						{notificationMode === option.value
							? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
							: 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40'}"
				>
					<div class="flex items-center gap-2">
						<input
							type="radio"
							name="mode"
							value={option.value}
							checked={notificationMode === option.value}
							onchange={() => onModeChange(option.value as 'realtime' | 'digest')}
							class="accent-[var(--color-primary)]"
						/>
						<span class="text-sm font-semibold text-[var(--color-text)]">{option.label}</span>
					</div>
					<p class="mt-1 pl-6 text-xs text-[var(--color-text-secondary)]">{option.desc}</p>
				</label>
			{/each}
		</div>
	</div>

	<div class="space-y-1.5">
		<label for="min-severity" class="block text-sm font-medium text-[var(--color-text)]">Minimum Severity</label>
		<select
			id="min-severity"
			value={minSeverity}
			onchange={(e) => onSeverityChange((e.target as HTMLSelectElement).value)}
			class="min-h-[44px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors focus:border-[var(--color-primary)] focus:outline-none"
		>
			<option value="low">Low</option>
			<option value="medium">Medium</option>
			<option value="high">High</option>
			<option value="critical">Critical</option>
		</select>
		<p class="text-xs text-[var(--color-text-secondary)]">Only send notifications for alerts at or above this severity</p>
	</div>
</section>

<section class="space-y-4 border-b border-[var(--color-border)] pb-6">
	<h3 class="text-sm font-semibold text-[var(--color-text)]">Alert Categories</h3>
	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
		{#each availableCategories as cat}
			<label
				class="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 transition-colors
					{categories.includes(cat.id)
						? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
						: 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40'}"
			>
				<input
					type="checkbox"
					checked={categories.includes(cat.id)}
					onchange={() => toggleCategory(cat.id)}
					class="h-4 w-4 accent-[var(--color-primary)]"
				/>
				<span class="text-lg">{cat.icon}</span>
				<span class="text-sm font-medium text-[var(--color-text)]">{cat.label}</span>
			</label>
		{/each}
	</div>
</section>
