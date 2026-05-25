<script lang="ts">
	import { theme, type ThemeMode } from '$stores/theme';
	import { Sun, Moon, Monitor } from 'lucide-svelte';

	const options: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
		{ mode: 'light', icon: Sun, label: 'Light' },
		{ mode: 'dark', icon: Moon, label: 'Dark' },
		{ mode: 'auto', icon: Monitor, label: 'Auto' },
	];
</script>

<div class="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
	{#each options as opt}
		<button
			onclick={() => theme.setTheme(opt.mode)}
			class="flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200
				{$theme === opt.mode
					? 'bg-[var(--color-primary)] text-white shadow-sm'
					: 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}"
			title={opt.label}
			aria-label="{opt.label} theme"
		>
			<opt.icon size={16} />
		</button>
	{/each}
</div>
