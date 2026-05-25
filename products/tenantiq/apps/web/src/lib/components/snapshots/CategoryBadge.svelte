<script lang="ts">
	interface Props {
		category: string;
		size?: 'sm' | 'md';
	}

	let { category, size = 'sm' }: Props = $props();

	const CATEGORY_COLORS: Record<string, string> = {
		conditional_access: 'bg-red-500/10 text-red-600 dark:text-red-400',
		security_defaults: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
		auth_methods: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
		authorization: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
		directory_roles: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
		app_consent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
		cross_tenant: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
		sensitivity_labels: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
		named_locations: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
		directory_settings: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
	};

	let colorClass = $derived(CATEGORY_COLORS[category] ?? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]');
	let label = $derived(category.replace(/_/g, ' '));
	let sizeClass = $derived(size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]');
</script>

<span class="inline-flex items-center rounded-full font-medium capitalize {colorClass} {sizeClass}">
	{label}
</span>
