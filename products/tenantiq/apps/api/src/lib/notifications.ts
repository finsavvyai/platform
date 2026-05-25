/**
 * Notification helpers — KV-backed notification system for background events.
 * Stores up to 50 notifications per tenant with 30-day TTL.
 */

export interface Notification {
	id: string;
	type: 'sync' | 'alert' | 'cis' | 'security' | 'info';
	title: string;
	message: string;
	timestamp: string;
	read: boolean;
}

const MAX_NOTIFICATIONS = 50;
const TTL_SECONDS = 86400 * 30; // 30 days

function kvKey(tenantId: string): string {
	return `notifications:${tenantId}`;
}

export async function getNotifications(
	kv: KVNamespace,
	tenantId: string,
	limit = 20,
): Promise<Notification[]> {
	const raw = await kv.get(kvKey(tenantId), 'json').catch(() => null);
	const all = Array.isArray(raw) ? (raw as Notification[]) : [];
	return all.slice(0, limit);
}

export async function addNotification(
	kv: KVNamespace,
	tenantId: string,
	notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
): Promise<void> {
	const existing = await getNotifications(kv, tenantId, MAX_NOTIFICATIONS);

	const entry: Notification = {
		id: crypto.randomUUID(),
		type: notification.type,
		title: notification.title,
		message: notification.message,
		timestamp: new Date().toISOString(),
		read: false,
	};

	const updated = [entry, ...existing].slice(0, MAX_NOTIFICATIONS);
	await kv.put(kvKey(tenantId), JSON.stringify(updated), {
		expirationTtl: TTL_SECONDS,
	});
}

export async function markNotificationRead(
	kv: KVNamespace,
	tenantId: string,
	notificationId: string,
): Promise<boolean> {
	const all = await getNotifications(kv, tenantId, MAX_NOTIFICATIONS);
	const target = all.find((n) => n.id === notificationId);
	if (!target) return false;

	target.read = true;
	await kv.put(kvKey(tenantId), JSON.stringify(all), {
		expirationTtl: TTL_SECONDS,
	});
	return true;
}

export async function markAllRead(
	kv: KVNamespace,
	tenantId: string,
): Promise<number> {
	const all = await getNotifications(kv, tenantId, MAX_NOTIFICATIONS);
	let count = 0;
	for (const n of all) {
		if (!n.read) {
			n.read = true;
			count++;
		}
	}
	if (count > 0) {
		await kv.put(kvKey(tenantId), JSON.stringify(all), {
			expirationTtl: TTL_SECONDS,
		});
	}
	return count;
}
