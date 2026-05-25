/**
 * Webhook Signature Generation & Verification
 * HMAC-SHA256 via crypto.subtle with constant-time comparison.
 */

import type { WebhookEvent } from './types';

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

function bytesToHex(bytes: ArrayBuffer): string {
	const arr = new Uint8Array(bytes);
	let out = '';
	for (let i = 0; i < arr.length; i++) {
		out += arr[i].toString(16).padStart(2, '0');
	}
	return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) {
		r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return r === 0;
}

export async function generateSignature(secret: string, event: WebhookEvent): Promise<string> {
	const payload = JSON.stringify(event);
	const key = await importKey(secret);
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return `sha256=${bytesToHex(mac)}`;
}

export async function verifySignature(
	secret: string,
	event: WebhookEvent,
	signature: string,
): Promise<boolean> {
	const expected = await generateSignature(secret, event);
	return timingSafeEqualHex(expected, signature);
}
