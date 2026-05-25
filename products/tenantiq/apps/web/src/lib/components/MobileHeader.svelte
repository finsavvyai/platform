<script lang="ts">
	import { Menu } from 'lucide-svelte';
	import NotificationBell from '$components/NotificationBell.svelte';
	import ThemeToggle from '$components/ThemeToggle.svelte';

	interface Props {
		onToggleSidebar: () => void;
	}

	let { onToggleSidebar }: Props = $props();
</script>

<header class="mobile-header flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-glass)] px-4 backdrop-blur-xl md:hidden">
	<div class="flex items-center gap-2.5">
		<button
			type="button"
			onclick={onToggleSidebar}
			aria-label="Open navigation menu"
			class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
		>
			<Menu size={20} strokeWidth={2} />
		</button>
		<div class="flex items-center gap-1.5">
			<img src="/brand/app-icon.png" alt="" aria-hidden="true" width="24" height="24" class="h-6 w-6 rounded-lg" />
			<span class="text-[15px] font-bold tracking-tight text-[var(--color-text)]">TenantIQ</span>
		</div>
	</div>
	<div class="flex items-center gap-1.5">
		<ThemeToggle />
		<NotificationBell />
	</div>
</header>
