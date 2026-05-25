/**
 * Sync polling helper for onboarding wizard.
 * Polls the tenant sync status endpoint and reports progress.
 */

import { api } from '$api/client';

interface SyncStatus {
	status: string;
	progress: number;
	message?: string;
}

interface SyncCallbacks {
	onProgress: (progress: number, message: string) => void;
	onComplete: () => void;
	onError: (msg: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
	users: 'Syncing users...',
	licenses: 'Checking licenses...',
	security: 'Scanning security...',
	policies: 'Reviewing policies...'
};

function labelFor(status: string): string {
	return STATUS_LABELS[status] ?? 'Syncing your tenant...';
}

export function startSyncPoller(
	tenantId: string,
	callbacks: SyncCallbacks
): () => void {
	let failures = 0;
	const timer = setInterval(async () => {
		try {
			const res = await api.get<SyncStatus>(
				`/tenants/${tenantId}/sync/status`
			);
			failures = 0;
			const progress = Math.min(res.progress, 100);
			const message = res.message ?? labelFor(res.status);
			callbacks.onProgress(progress, message);

			if (res.status === 'completed' || res.progress >= 100) {
				clearInterval(timer);
				callbacks.onComplete();
			}
		} catch {
			failures++;
			if (failures === 1) {
				callbacks.onProgress(50, 'Sync check failed, retrying...');
			} else if (failures === 2) {
				callbacks.onProgress(50, 'Still having trouble. Check your internet connection.');
			} else if (failures >= 3) {
				clearInterval(timer);
				callbacks.onError('Unable to complete sync. Please try again or contact support.');
			}
		}
	}, 2000);

	return () => clearInterval(timer);
}

export async function triggerSync(tenantId: string): Promise<void> {
	await api.post(`/tenants/${tenantId}/sync`);
}
