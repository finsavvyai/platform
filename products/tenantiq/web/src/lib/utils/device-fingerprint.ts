/**
 * Device fingerprinting for TokenForge.
 *
 * Generates a stable fingerprint from browser/device characteristics
 * and a keypair hash for device-bound token validation.
 * Values are persisted in localStorage so they survive page reloads.
 */

const STORAGE_KEY = 'tq_device_fp';
const KEY_STORAGE_KEY = 'tq_device_key';
const NAME_STORAGE_KEY = 'tq_device_name';

/** Collect raw signals that identify this browser/device. */
function collectSignals(): string {
	const parts = [
		navigator.userAgent,
		navigator.language,
		`${screen.width}x${screen.height}x${screen.colorDepth}`,
		Intl.DateTimeFormat().resolvedOptions().timeZone,
		navigator.hardwareConcurrency?.toString() ?? '0',
		navigator.platform ?? '',
	];
	return parts.join('|');
}

/** SHA-256 hex hash of an input string. */
async function sha256(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const buf = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Generate a random 256-bit key and return its hex hash. */
async function generateKeyHash(): Promise<string> {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return sha256(hex);
}

/** Guess a short device name from the user agent. */
function guessDeviceName(): string {
	const ua = navigator.userAgent;
	if (/Mac/i.test(ua)) return 'Mac';
	if (/Windows/i.test(ua)) return 'Windows PC';
	if (/Linux/i.test(ua)) return 'Linux';
	if (/iPhone/i.test(ua)) return 'iPhone';
	if (/Android/i.test(ua)) return 'Android';
	return 'Browser';
}

export interface DeviceIdentity {
	fingerprint: string;
	publicKeyHash: string;
	deviceName: string;
}

/**
 * Get or create a stable device identity.
 * Fingerprint + key are cached in localStorage for consistency.
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
	let fingerprint = localStorage.getItem(STORAGE_KEY);
	let publicKeyHash = localStorage.getItem(KEY_STORAGE_KEY);
	let deviceName = localStorage.getItem(NAME_STORAGE_KEY);

	if (!fingerprint) {
		fingerprint = await sha256(collectSignals());
		localStorage.setItem(STORAGE_KEY, fingerprint);
	}

	if (!publicKeyHash) {
		publicKeyHash = await generateKeyHash();
		localStorage.setItem(KEY_STORAGE_KEY, publicKeyHash);
	}

	if (!deviceName) {
		deviceName = guessDeviceName();
		localStorage.setItem(NAME_STORAGE_KEY, deviceName);
	}

	return { fingerprint, publicKeyHash, deviceName };
}

/** Clear stored device identity (e.g. on logout). */
export function clearDeviceIdentity(): void {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(KEY_STORAGE_KEY);
	localStorage.removeItem(NAME_STORAGE_KEY);
}
