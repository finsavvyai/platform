/**
 * Key Manager — generate, hash, and validate API keys
 *
 * API keys use the format: lnos_live_<32 random hex chars>
 * Keys are hashed with SHA-256 before storage (no bcrypt needed —
 * the key itself has enough entropy at 128 bits).
 */

const KEY_PREFIX = 'lnos_live_';

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generate a new API key with the lnos_ prefix.
 * Returns both the raw key (to show once) and its SHA-256 hash (for storage).
 */
export async function generateApiKey(): Promise<{
    rawKey: string;
    keyHash: string;
    keyPrefix: string;
}> {
    // Generate 32 bytes of randomness → 64 hex chars
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const rawKey = `${KEY_PREFIX}${hex}`;
    const keyHash = await hashKey(rawKey);
    const keyPrefix = `${KEY_PREFIX}${hex.substring(0, 8)}...`;

    return { rawKey, keyHash, keyPrefix };
}

// ─── Key Hashing ─────────────────────────────────────────────────────────────

/**
 * Hash an API key using SHA-256 (Web Crypto compatible).
 */
export async function hashKey(key: string): Promise<string> {
    const encoded = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ─── Key Validation ──────────────────────────────────────────────────────────

/**
 * Validate an API key format (starts with lnos_live_)
 */
export function isApiKey(value: string): boolean {
    return value.startsWith(KEY_PREFIX) && value.length === KEY_PREFIX.length + 64;
}

/**
 * Look up an API key by its hash in D1.
 * Returns the key record if found and not revoked.
 */
export async function validateApiKey(
    db: D1Database,
    rawKey: string,
): Promise<{
    valid: boolean;
    keyId?: string;
    userId?: string;
    name?: string;
    tier?: string;
} | null> {
    if (!isApiKey(rawKey)) {
        return { valid: false };
    }

    const keyHash = await hashKey(rawKey);

    const record = await db.prepare(`
    SELECT ak.id, ak.user_id, ak.name, ak.revoked_at,
           u.tier, u.email
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_hash = ? AND ak.revoked_at IS NULL
  `).bind(keyHash).first<{
        id: string;
        user_id: string;
        name: string;
        revoked_at: string | null;
        tier: string;
        email: string;
    }>();

    if (!record) {
        return { valid: false };
    }

    // Update last used timestamp (non-blocking)
    try {
        await db.prepare(
            'UPDATE api_keys SET last_used_at = ? WHERE id = ?'
        ).bind(new Date().toISOString(), record.id).run();
    } catch {
        // Non-critical
    }

    return {
        valid: true,
        keyId: record.id,
        userId: record.user_id,
        name: record.name,
        tier: record.tier,
    };
}
