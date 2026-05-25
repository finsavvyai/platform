import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from './verify-webhook-signature';

async function hmacHex(body: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyWebhookSignature', () => {
    const secret = 'test-secret-key';
    const body = '{"chain":"hello","payload":{}}';

    it('returns true for a valid signature', async () => {
        const sig = await hmacHex(body, secret);
        expect(await verifyWebhookSignature(body, sig, secret)).toBe(true);
    });

    it('accepts sha256= prefix', async () => {
        const sig = await hmacHex(body, secret);
        expect(await verifyWebhookSignature(body, `sha256=${sig}`, secret)).toBe(true);
    });

    it('rejects when secret is missing', async () => {
        const sig = await hmacHex(body, secret);
        expect(await verifyWebhookSignature(body, sig, undefined)).toBe(false);
    });

    it('rejects when header is missing', async () => {
        expect(await verifyWebhookSignature(body, undefined, secret)).toBe(false);
    });

    it('rejects malformed signature header', async () => {
        expect(await verifyWebhookSignature(body, 'not-hex-or-prefix', secret)).toBe(false);
        expect(await verifyWebhookSignature(body, 'a'.repeat(63), secret)).toBe(false);
        expect(await verifyWebhookSignature(body, 'g'.repeat(64), secret)).toBe(false);
    });

    it('rejects tampered body', async () => {
        const sig = await hmacHex(body, secret);
        expect(await verifyWebhookSignature(body + 'x', sig, secret)).toBe(false);
    });

    it('rejects wrong secret', async () => {
        const sig = await hmacHex(body, 'other');
        expect(await verifyWebhookSignature(body, sig, secret)).toBe(false);
    });
});
