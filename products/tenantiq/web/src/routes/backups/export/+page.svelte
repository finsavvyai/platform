<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';
	import { auth } from '$stores/auth';
	import { ArrowLeft, Download, FileJson, Diff } from 'lucide-svelte';

	const CATEGORIES = [
		{ key: 'conditionalAccess', label: 'Conditional Access Policies' },
		{ key: 'authMethods', label: 'Authentication Methods' },
		{ key: 'securityDefaults', label: 'Security Defaults' },
		{ key: 'dlpPolicies', label: 'DLP Policies' },
		{ key: 'sharingSettings', label: 'Sharing Settings' },
	] as const;

	let loading = $state(false);
	let exportResult = $state<Record<string, unknown> | null>(null);
	let selectedCategories = $state<Set<string>>(new Set());
	let showJson = $state(false);

	function toggleCategory(key: string) {
		const next = new Set(selectedCategories);
		if (next.has(key)) next.delete(key); else next.add(key);
		selectedCategories = next;
	}

	function toggleAll() {
		if (selectedCategories.size === CATEGORIES.length) {
			selectedCategories = new Set();
		} else {
			selectedCategories = new Set(CATEGORIES.map((c) => c.key));
		}
	}

	async function handleExport() {
		loading = true;
		try {
			const cats = [...selectedCategories];
			const res = await api.post<{ export: Record<string, unknown> }>('/config/export', {
				categories: cats.length > 0 ? cats : undefined,
			});
			exportResult = res.export;
			showJson = true;
			toasts.success('Config exported successfully');
		} catch { toasts.error('Failed to export configuration'); }
		finally { loading = false; }
	}

	function downloadJson() {
		if (!exportResult) return;
		const blob = new Blob([JSON.stringify(exportResult, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `config-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	let jsonPreview = $derived(
		exportResult ? JSON.stringify(exportResult, null, 2) : '',
	);
</script>

<svelte:head><title>Config Export | TenantIQ</title></svelte:head>

<div class="page-container">
	<header class="page-header">
		<a href="/backups" class="back-link"><ArrowLeft size={16} /> Backups</a>
		<h1><FileJson size={24} /> Configuration-as-Code Export</h1>
		<p class="subtitle">Export your M365 configuration as JSON for GitOps workflows.</p>
	</header>

	<section class="category-section">
		<div class="category-header">
			<h2>Select Categories</h2>
			<button class="btn-text" onclick={toggleAll}>
				{selectedCategories.size === CATEGORIES.length ? 'Deselect All' : 'Select All'}
			</button>
		</div>

		<div class="category-grid">
			{#each CATEGORIES as cat}
				<label class="category-card" class:selected={selectedCategories.has(cat.key)}>
					<input type="checkbox" checked={selectedCategories.has(cat.key)}
						onchange={() => toggleCategory(cat.key)} />
					<span>{cat.label}</span>
				</label>
			{/each}
		</div>
	</section>

	<div class="actions">
		<button class="btn-primary" disabled={loading} onclick={handleExport}>
			{#if loading}Exporting...{:else}<Download size={16} /> Export Config{/if}
		</button>
		{#if exportResult}
			<button class="btn-secondary" onclick={downloadJson}>
				<Download size={16} /> Download JSON
			</button>
			<button class="btn-secondary" onclick={() => showJson = !showJson}>
				<Diff size={16} /> {showJson ? 'Hide' : 'Show'} JSON
			</button>
		{/if}
	</div>

	{#if showJson && exportResult}
		<section class="json-preview">
			<h3>Export Preview</h3>
			<pre><code>{jsonPreview}</code></pre>
		</section>
	{/if}
</div>

<style>
	.page-container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; margin: 0.5rem 0; }
	.subtitle { color: var(--text-secondary, #6b7280); margin: 0; }
	.back-link { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; }
	.category-section { margin-bottom: 1.5rem; }
	.category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
	.category-header h2 { font-size: 1rem; margin: 0; }
	.btn-text { background: none; border: none; color: var(--color-primary, #2563eb); cursor: pointer; font-size: 0.8125rem; }
	.category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
	.category-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border: 1px solid var(--border, #d1d5db); border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; transition: border-color 0.15s; }
	.category-card.selected { border-color: var(--color-primary, #2563eb); background: var(--surface-active, #eff6ff); }
	.category-card input { accent-color: var(--color-primary, #2563eb); }
	.actions { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
	.btn-primary { padding: 0.5rem 1.25rem; border-radius: 0.375rem; background: var(--color-primary, #2563eb); color: #fff; border: none; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.375rem; }
	.btn-primary:disabled { opacity: 0.5; }
	.btn-secondary { padding: 0.5rem 1.25rem; border-radius: 0.375rem; background: var(--surface, #f3f4f6); color: var(--text-primary); border: 1px solid var(--border); font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.375rem; }
	.json-preview { border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden; }
	.json-preview h3 { padding: 0.75rem 1rem; margin: 0; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
	.json-preview pre { padding: 1rem; margin: 0; font-size: 0.75rem; overflow-x: auto; max-height: 500px; background: var(--surface, #f9fafb); }

	:global(.dark) .category-card { border-color: #4b5563; }
	:global(.dark) .category-card.selected { border-color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
	:global(.dark) .json-preview pre { background: #1f2937; }
</style>
