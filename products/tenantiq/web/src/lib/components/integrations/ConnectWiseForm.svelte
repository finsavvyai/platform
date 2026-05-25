<script lang="ts">
	import { api } from '$api/client';
	import { toasts } from '$stores/toast';

	interface Props {
		onConnected: () => void;
	}

	let { onConnected }: Props = $props();

	let companyId = $state('');
	let publicKey = $state('');
	let privateKey = $state('');
	let siteUrl = $state('');
	let clientId = $state('');

	let testing = $state(false);
	let connecting = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	let canSubmit = $derived(
		companyId.trim() && publicKey.trim() && privateKey.trim() && siteUrl.trim() && clientId.trim()
	);

	async function testConnection() {
		testing = true;
		testResult = null;
		try {
			const res = await api.post<{ success: boolean; message: string }>('/integrations/connectwise/test', {
				companyId: companyId.trim(), publicKey: publicKey.trim(),
				privateKey: privateKey.trim(), siteUrl: siteUrl.trim(), clientId: clientId.trim()
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
			await api.post('/integrations/connectwise/connect', {
				companyId: companyId.trim(), publicKey: publicKey.trim(),
				privateKey: privateKey.trim(), siteUrl: siteUrl.trim(), clientId: clientId.trim()
			});
			toasts.success('ConnectWise connected successfully');
			onConnected();
		} catch (e) {
			toasts.error(e instanceof Error ? e.message : 'Connection failed');
		} finally { connecting = false; }
	}

	const fields = [
		{ id: 'companyId', label: 'Company ID', placeholder: 'e.g. mycompany', type: 'text' },
		{ id: 'siteUrl', label: 'Site URL', placeholder: 'https://na.myconnectwise.net', type: 'url' },
		{ id: 'clientId', label: 'Client ID', placeholder: 'Your ConnectWise Client ID', type: 'text' },
		{ id: 'publicKey', label: 'Public Key', placeholder: 'API public key', type: 'text' },
		{ id: 'privateKey', label: 'Private Key', placeholder: 'API private key', type: 'password' }
	] as const;

	function getBindValue(id: string): string {
		const map: Record<string, string> = { companyId, siteUrl, clientId, publicKey, privateKey };
		return map[id] ?? '';
	}

	function setBindValue(id: string, value: string) {
		if (id === 'companyId') companyId = value;
		else if (id === 'siteUrl') siteUrl = value;
		else if (id === 'clientId') clientId = value;
		else if (id === 'publicKey') publicKey = value;
		else if (id === 'privateKey') privateKey = value;
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
	<h2 class="mb-1 text-sm font-semibold text-[var(--color-text)]">Connect to ConnectWise PSA</h2>
	<p class="mb-5 text-xs text-[var(--color-text-secondary)]">
		Enter your ConnectWise API credentials. You can find these in System &gt; Members &gt; API Members.
	</p>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each fields as f}
			<div class:sm:col-span-2={f.id === 'siteUrl'}>
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
