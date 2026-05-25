<script lang="ts">
	import type { Severity } from '@tenantiq/shared';

	interface Props {
		severity: Severity;
		size?: 'sm' | 'md';
	}

	let { severity, size = 'sm' }: Props = $props();

	const config: Record<Severity, { bg: string; text: string; dot: string; glow: string; border: string }> = {
		critical: {
			bg: 'bg-gradient-to-r from-red-500/12 to-red-600/8',
			text: 'text-red-600 dark:text-red-400',
			dot: 'bg-red-500',
			glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]',
			border: 'border-red-500/20',
		},
		high: {
			bg: 'bg-gradient-to-r from-amber-500/12 to-orange-500/8',
			text: 'text-amber-600 dark:text-amber-400',
			dot: 'bg-amber-500',
			glow: 'shadow-[0_0_6px_rgba(245,158,11,0.4)]',
			border: 'border-amber-500/20',
		},
		medium: {
			bg: 'bg-gradient-to-r from-yellow-500/10 to-amber-500/6',
			text: 'text-yellow-600 dark:text-yellow-400',
			dot: 'bg-yellow-500',
			glow: '',
			border: 'border-yellow-500/15',
		},
		low: {
			bg: 'bg-gradient-to-r from-blue-500/10 to-indigo-500/6',
			text: 'text-blue-600 dark:text-blue-400',
			dot: 'bg-blue-500',
			glow: '',
			border: 'border-blue-500/15',
		},
	};

	const sizeClasses = $derived(size === 'md' ? 'px-3 py-1 text-sm gap-2' : 'px-2.5 py-0.5 text-xs gap-1.5');
	const dotSize = $derived(size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5');
	const c = $derived(config[severity]);
</script>

<span class="inline-flex items-center rounded-full border font-semibold capitalize tracking-tight {sizeClasses} {c.bg} {c.text} {c.border}" role="status">
	<span class="rounded-full {dotSize} {c.dot} {c.glow} {severity === 'critical' ? 'pulse-critical' : ''}"></span>
	{severity}
</span>
