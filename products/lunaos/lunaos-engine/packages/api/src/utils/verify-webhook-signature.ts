/**
 * Verify HMAC-SHA256 webhook signature using Web Crypto.
 * Constant-time comparison via subtle.verify.
 */
export async function verifyWebhookSignature(
    rawBody: string,
    headerSignature: string | undefined,
    secret: string | undefined,
): Promise<boolean> {
    if (!secret || !headerSignature) return false;

    const sigHex = headerSignature.replace(/^sha256=/i, '').trim();
    if (sigHex.length !== 64 || !/^[a-f0-9]+$/i.test(sigHex)) return false;

    const sigBytes = new Uint8Array(
        sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );

    return crypto.subtle.verify(
        'HMAC',
        key,
        sigBytes,
        new TextEncoder().encode(rawBody),
    );
}
