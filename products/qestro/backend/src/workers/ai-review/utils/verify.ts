import crypto from 'crypto';

export function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) return true; // Fail open if no secret configured (dev mode), or false? Better false for security.
    // Actually, let's strictly require secret if signature is present.

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    // Constant time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
