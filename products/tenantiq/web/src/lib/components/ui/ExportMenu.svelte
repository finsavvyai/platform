<script lang="ts">
	/**
	 * Reusable export dropdown menu.
	 * Supports CSV, JSON, and optional server-side formats.
	 */

	interface Props {
		onExportCsv?: () => void;
		onExportJson?: () => void;
		onExportPdf?: () => void;
		onCopyLink?: () => void;
		disabled?: boolean;
		label?: string;
	}

	let { onExportCsv, onExportJson, onExportPdf, onCopyLink, disabled = false, label = 'Export' }: Props = $props();
	let open = $state(false);

	function handleAction(fn?: () => void) {
		if (fn) fn();
		open = false;
	}

	$effect(() => {
		if (!open) return;
		function handleClickOutside(e: MouseEvent) {
			if (!(e.target as HTMLElement).closest('.export-menu')) open = false;
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="export-menu relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		{disabled}
		class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-bg-secondary)] hover:shadow-[var(--shadow-sm)] disabled:opacity-50"
		aria-haspopup="true"
		aria-expanded={open}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
		{label}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform {open ? 'rotate-180' : ''}" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
	</button>

	{#if open}
		<div class="absolute right-0 top-full z-50 mt-2 w-56 max-w-[90vw] animate-scale-in rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-glass)] p-1.5 shadow-[var(--shadow-xl)] backdrop-blur-xl" role="menu">
			{#if onExportCsv}
				<button onclick={() => handleAction(onExportCsv)} class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-text)] transition-all hover:bg-[var(--color-primary-muted)]" role="menuitem">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/15 to-green-600/10 text-[10px] font-bold text-green-600 transition-transform group-hover:scale-110">CSV</span>
					<div>
						<p class="font-semibold tracking-tight">Export CSV</p>
						<p class="text-[11px] text-[var(--color-text-tertiary)]">Spreadsheet-ready</p>
					</div>
				</button>
			{/if}
			{#if onExportJson}
				<button onclick={() => handleAction(onExportJson)} class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-text)] transition-all hover:bg-[var(--color-primary-muted)]" role="menuitem">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand-500)]/15 to-[var(--brand-600)]/10 text-[10px] font-bold text-[var(--brand-500)] transition-transform group-hover:scale-110">{'{ }'}</span>
					<div>
						<p class="font-semibold tracking-tight">Export JSON</p>
						<p class="text-[11px] text-[var(--color-text-tertiary)]">Structured data</p>
					</div>
				</button>
			{/if}
			{#if onExportPdf}
				<button onclick={() => handleAction(onExportPdf)} class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-text)] transition-all hover:bg-[var(--color-primary-muted)]" role="menuitem">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/15 to-red-600/10 text-[10px] font-bold text-red-600 transition-transform group-hover:scale-110">PDF</span>
					<div>
						<p class="font-semibold tracking-tight">Export PDF</p>
						<p class="text-[11px] text-[var(--color-text-tertiary)]">Print-ready report</p>
					</div>
				</button>
			{/if}
			{#if onCopyLink}
				<div class="my-1 mx-2 border-t border-[var(--color-border-subtle)]"></div>
				<button onclick={() => handleAction(onCopyLink)} class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-text)] transition-all hover:bg-[var(--color-primary-muted)]" role="menuitem">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] transition-transform group-hover:scale-110">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.518a4.5 4.5 0 00-6.364-6.364L4.5 8.25l1.757 1.757"/></svg>
					</span>
					<div>
						<p class="font-semibold tracking-tight">Copy Link</p>
						<p class="text-[11px] text-[var(--color-text-tertiary)]">Share this page</p>
					</div>
				</button>
			{/if}
		</div>
	{/if}
</div>
