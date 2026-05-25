/**
 * TokenForge device binding — wires @opensyber/tokenforge/client to the
 * same-origin /api/tf/bind proxy on tenantiq's API. The proxy forwards to
 * tokenforge-api.opensyber.cloud/v1/bind with the server-held API key,
 * so the browser never sees the TokenForge secret.
 *
 * After init, the SDK installs a fetch interceptor that signs every outbound
 * request with the device's ECDSA private key. tenantiq's middleware
 * forwards the signature to the TokenForge cloud verifier.
 */
import { tenant } from '$stores/tenant';
import { auth } from '$stores/auth';
import { get } from 'svelte/store';
import { TokenForge } from '@opensyber/tokenforge/client';

const BOUND_KEY = 'tq_tf_bound';
const API_BASE = import.meta.env.PUBLIC_API_URL ?? 'https://api.tenantiq.app';

let tfInstance: TokenForge | null = null;

export async function bindCurrentDevice(): Promise<void> {
	const tenantState = get(tenant);
	const tid = tenantState.currentTenantId;
	if (!tid) return;

	const boundKey = `${BOUND_KEY}:${tid}`;
	if (sessionStorage.getItem(boundKey)) return;

	try {
		if (!tfInstance) {
			tfInstance = new TokenForge({
				apiBase: API_BASE, // SDK appends /api/tf/bind — resolves to tenantiq same-origin proxy
				getSessionId: () => {
					const a = get(auth);
					return (a.user?.id as string | undefined) ?? a.user?.email ?? null;
				},
				onDeviceBound: (deviceId: string) => {
					console.info('[TokenForge] device bound', deviceId);
				},
			});
		}
		await tfInstance.init();
		sessionStorage.setItem(boundKey, '1');
	} catch (err) {
		console.warn('[TokenForge] init failed, running without signatures', err);
	}
}
