<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface Props {
		onConnected: () => void;
	}

	let { onConnected }: Props = $props();

	let apiUser = $state('');
	let apiSecret = $state('');
	let trackingId = $state('');
	let zoneUrl = $state('');

	let testing = $state(false);
	let connecting = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	let canSubmit = $derived(
		apiUser.trim() && apiSecret.trim() && trackingId.trim() && zoneUrl.trim()
	);

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			const res = await api.post<{ success: boolean; message: string }>('/integrations/datto/test', {
				apiUser: apiUser.trim(), apiSecret: apiSecret.trim(),
				trackingId: trackingId.trim(), zoneUrl: zoneUrl.trim()
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
			await api.post('/integrations/datto/connect', {
				apiUser: apiUser.trim(), apiSecret: apiSecret.trim(),
				trackingId: trackingId.trim(), zoneUrl: zoneUrl.trim()
			});
			toasts.success('Datto Autotask connected successfully');
			onConnected();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Connection failed');
		} finally { connecting = false; }
	}

	const fields = [
		{ id: 'apiUser', label: 'API User', placeholder: 'Your Autotask API username', type: 'text' },
		{ id: 'apiSecret', label: 'API Secret', placeholder: 'Your Autotask API secret', type: 'password' },
		{ id: 'trackingId', label: 'Tracking ID', placeholder: 'Your Autotask integration tracking ID', type: 'text' },
		{ id: 'zoneUrl', label: 'Zone URL', placeholder: 'https://webservicesX.autotask.net', type: 'url' }
	] as const;

	function getBindValue(id: string): string {
		const map: Record<string, string> = { apiUser, apiSecret, trackingId, zoneUrl };
		return map[id] ?? '';
	}

	function setBindValue(id: string, value: string) {
		if (id === 'apiUser') apiUser = value;
		else if (id === 'apiSecret') apiSecret = value;
		else if (id === 'trackingId') trackingId = value;
		else if (id === 'zoneUrl') zoneUrl = value;
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h2 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Connect to Datto Autotask</h2>
	<p class="mb-5 text-xs text-[var(--color-text-secondary)]">
		Enter your Autotask API credentials. You can find these in Admin &gt; Extensions &amp; Integrations &gt; Other &gt; API.
	</p>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each fields as f}
			<div class:sm:col-span-2={f.id === 'zoneUrl'}>
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
