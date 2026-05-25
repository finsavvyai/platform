/**
 * WebAuthn / passkey client.
 *
 * Wraps @simplewebauthn/browser with the TenantIQ API endpoints. Uses cookie
 * auth (credentials: 'include') so the user must be signed in to register
 * but NOT to authenticate (auth flow accepts an email + assertion).
 */
import {
	startRegistration,
	startAuthentication,
	browserSupportsWebAuthn,
	platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { toasts } from '$stores/toast';

const API_BASE = import.meta.env.PUBLIC_API_URL
	? `${import.meta.env.PUBLIC_API_URL}/api`
	: 'https://api.tenantiq.app/api';

export async function isWebAuthnSupported(): Promise<boolean> {
	if (!browserSupportsWebAuthn()) return false;
	// Platform authenticator (TouchID/FaceID/Windows Hello) preferred but not required.
	try { return await platformAuthenticatorIsAvailable(); } catch { return browserSupportsWebAuthn(); }
}

/** Register a new passkey for the currently authenticated user. */
export async function registerPasskey(deviceName?: string): Promise<boolean> {
	try {
		const optsRes = await fetch(`${API_BASE}/auth/webauthn/register/options`, {
			method: 'POST',
			credentials: 'include',
		});
		if (!optsRes.ok) {
			toasts.error('Could not start passkey registration');
			return false;
		}
		const options = await optsRes.json();

		const attestation = await startRegistration({ optionsJSON: options });

		const verifyRes = await fetch(`${API_BASE}/auth/webauthn/register/verify`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ response: attestation, deviceName }),
		});
		if (!verifyRes.ok) {
			toasts.error('Passkey verification failed');
			return false;
		}
		toasts.success('Passkey registered — biometric login enabled');
		return true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'unknown error';
		if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('aborted')) return false;
		toasts.error(`Passkey error: ${msg}`);
		return false;
	}
}

/** Sign in with a passkey. Returns { token, user } on success. */
export async function authenticateWithPasskey(email?: string): Promise<{ token: string; user: { id: string; email: string; role: string } } | null> {
	try {
		const optsRes = await fetch(`${API_BASE}/auth/webauthn/auth/options`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		});
		if (!optsRes.ok) return null;
		const options = await optsRes.json();

		const assertion = await startAuthentication({ optionsJSON: options });

		const verifyRes = await fetch(`${API_BASE}/auth/webauthn/auth/verify`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ response: assertion }),
		});
		if (!verifyRes.ok) return null;

		const data = await verifyRes.json();
		if (!data.verified) return null;
		toasts.success('Signed in with passkey');
		return { token: data.token, user: data.user };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'unknown error';
		if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('aborted')) return null;
		toasts.error(`Passkey sign-in failed: ${msg}`);
		return null;
	}
}
