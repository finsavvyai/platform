<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface Props {
		onConnected: () => void;
	}

	let { onConnected }: Props = $props();

	let apiUrl = $state('');
	let apiKey = $state('');
	let tenantId = $state('');

	let testing = $state(false);
	let connecting = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	let canSubmit = $derived(
		apiUrl.trim() && apiKey.trim() && tenantId.trim()
	);

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			const res = await api.post<{ success: boolean; message: string }>('/integrations/kaseya/test', {
				apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), tenantId: tenantId.trim()
			});
			testResult = res;
			if (res.success) toasts.success('Connection test passed');
			else toasts.error(res.message);
		} catch (e) {
			testResult = { success: false, message: e instanceof Error ? e.message : 'Test failed' };
			toasts.error(testResult.message);
		} finally { testing = false; }
	}

	async function connect() {
		connecting = true;
		try {
			await api.post('/integrations/kaseya/connect', {
				apiUrl: apiUrl.trim(), apiKey: apiKey.trim(), tenantId: tenantId.trim()
			});
			toasts.success('Kaseya BMS connected successfully');
			onConnected();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Connection failed');
		} finally { connecting = false; }
	}

	const fields = [
		{ id: 'apiUrl', label: 'API URL', placeholder: 'https://bms.kaseya.com/api', type: 'url' },
		{ id: 'apiKey', label: 'API Key', placeholder: 'Your Kaseya BMS API key', type: 'password' },
		{ id: 'tenantId', label: 'Tenant ID', placeholder: 'Your Kaseya BMS tenant ID', type: 'text' }
	] as const;

	function getBindValue(id: string): string {
		const map: Record<string, string> = { apiUrl, apiKey, tenantId };
		return map[id] ?? '';
	}

	function setBindValue(id: string, value: string) {
		if (id === 'apiUrl') apiUrl = value;
		else if (id === 'apiKey') apiKey = value;
		else if (id === 'tenantId') tenantId = value;
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h2 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Connect to Kaseya BMS</h2>
	<p class="mb-5 text-xs text-[var(--color-text-secondary)]">
		Enter your Kaseya BMS API credentials. You can find these in Settings &gt; API &gt; Manage Keys.
	</p>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each fields as f}
			<div class:sm:col-span-2={f.id === 'apiUrl'}>
				<label for={f.id} class="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{f.label}</label>
				<input
					id={f.id}
					type={f.type}
					placeholder={f.placeholder}
					value={getBindValue(f.id)}
					oninput={(e) => setBindValue(f.id, e.currentTarget.value)}
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
				/>
			</div>
		{/each}
	</div>

	{#if testResult}
		<div
			class="mt-4 rounded-md px-3 py-2 text-xs {testResult.success ? 'bg-green-500/10 text-[var(--color-success)]' : 'bg-red-500/10 text-[var(--color-danger)]'}"
		>
			{testResult.message}
		</div>
	{/if}

	<div class="mt-5 flex gap-3">
		<button
			onclick={testConnection}
			disabled={!canSubmit || testing}
			class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
		>
			{testing ? 'Testing...' : 'Test Connection'}
		</button>
		<button
			onclick={connect}
			disabled={!canSubmit || connecting}
			class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
		>
			{connecting ? 'Connecting...' : 'Connect'}
		</button>
	</div>
</div>
