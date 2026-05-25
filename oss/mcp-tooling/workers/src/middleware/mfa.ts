/**
 * MFA (Multi-Factor Authentication) Middleware
 * TOTP-based second factor authentication for MCPOverflow
 */

import { Context, Next } from 'hono';
import type { Env } from './auth';

// TOTP configuration
const TOTP_CONFIG = {
    digits: 6,
    period: 30,         // 30 second window
    algorithm: 'SHA-1',
    issuer: 'MCPOverflow',
};

// Generate a random secret for TOTP
export async function generateMFASecret(): Promise<string> {
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    return base32Encode(array);
}

// Base32 encoding for TOTP secrets
function base32Encode(buffer: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
}

// Base32 decoding
function base32Decode(input: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanInput = input.toUpperCase().replace(/[^A-Z2-7]/g, '');

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleanInput.length; i++) {
        const idx = alphabet.indexOf(cleanInput[i]);
        if (idx === -1) continue;

        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(output);
}

// Generate HOTP value
async function generateHOTP(secret: Uint8Array, counter: number): Promise<string> {
    // Convert counter to 8-byte buffer
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setBigUint64(0, BigInt(counter), false);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
        'raw',
        secret,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    // Generate HMAC
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        counterBuffer
    );

    const hmac = new Uint8Array(signature);

    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
    return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

// Generate TOTP for current time
export async function generateTOTP(secret: string): Promise<string> {
    const secretBytes = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);
    return generateHOTP(secretBytes, counter);
}

// Verify TOTP token (with 1-step window tolerance)
export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
    const secretBytes = base32Decode(secret);
    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);

    // Check current and adjacent time windows
    for (let i = -1; i <= 1; i++) {
        const expectedToken = await generateHOTP(secretBytes, currentCounter + i);
        if (expectedToken === token) {
            return true;
        }
    }

    return false;
}

// Generate otpauth:// URL for authenticator apps
export function generateOTPAuthURL(secret: string, email: string): string {
    const issuer = encodeURIComponent(TOTP_CONFIG.issuer);
    const account = encodeURIComponent(email);
    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
}

// MFA Service for database operations
export class MFAService {
    private db: D1Database;
    private kv: KVNamespace;

    constructor(db: D1Database, kv: KVNamespace) {
        this.db = db;
        this.kv = kv;
    }

    // Check if user has MFA enabled
    async isMFAEnabled(userId: string): Promise<boolean> {
        const result = await this.db
            .prepare('SELECT mfa_enabled FROM users WHERE id = ?')
            .bind(userId)
            .first<{ mfa_enabled: number }>();

        return result?.mfa_enabled === 1;
    }

    // Get user's MFA secret
    async getMFASecret(userId: string): Promise<string | null> {
        const result = await this.db
            .prepare('SELECT mfa_secret FROM users WHERE id = ?')
            .bind(userId)
            .first<{ mfa_secret: string | null }>();

        return result?.mfa_secret || null;
    }

    // Setup MFA for user (returns secret and QR URL)
    async setupMFA(userId: string, email: string): Promise<{ secret: string; otpAuthUrl: string }> {
        const secret = await generateMFASecret();
        const otpAuthUrl = generateOTPAuthURL(secret, email);

        // Store secret temporarily until verified
        await this.kv.put(`mfa:pending:${userId}`, secret, { expirationTtl: 600 }); // 10 min expiry

        return { secret, otpAuthUrl };
    }

    // Verify and enable MFA
    async enableMFA(userId: string, token: string): Promise<boolean> {
        const pendingSecret = await this.kv.get(`mfa:pending:${userId}`);
        if (!pendingSecret) {
            throw new Error('No pending MFA setup found. Please start setup again.');
        }

        const isValid = await verifyTOTP(pendingSecret, token);
        if (!isValid) {
            return false;
        }

        // Enable MFA in database
        await this.db
            .prepare("UPDATE users SET mfa_enabled = 1, mfa_secret = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(pendingSecret, userId)
            .run();

        // Clean up pending secret
        await this.kv.delete(`mfa:pending:${userId}`);

        return true;
    }

    // Disable MFA
    async disableMFA(userId: string, token: string): Promise<boolean> {
        // Verify token before disabling
        const secret = await this.getMFASecret(userId);
        if (!secret) {
            throw new Error('MFA is not enabled for this account.');
        }

        const isValid = await verifyTOTP(secret, token);
        if (!isValid) {
            return false;
        }

        // Disable MFA
        await this.db
            .prepare("UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, updated_at = datetime('now') WHERE id = ?")
            .bind(userId)
            .run();

        return true;
    }

    // Verify MFA token for login
    async verifyMFAToken(userId: string, token: string): Promise<boolean> {
        const secret = await this.getMFASecret(userId);
        if (!secret) {
            return false;
        }

        return verifyTOTP(secret, token);
    }

    // Generate backup codes
    async generateBackupCodes(userId: string): Promise<string[]> {
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
            const array = new Uint8Array(4);
            crypto.getRandomValues(array);
            const code = Array.from(array)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();
            codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
        }

        // Hash and store backup codes
        const hashedCodes = await Promise.all(
            codes.map(async (code) => {
                const encoder = new TextEncoder();
                const data = encoder.encode(code.replace('-', ''));
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            })
        );

        await this.db
            .prepare("UPDATE users SET mfa_backup_codes = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(JSON.stringify(hashedCodes), userId)
            .run();

        return codes;
    }
}

// Middleware to require MFA verification
export const requireMFA = async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);
    const mfaEnabled = await mfaService.isMFAEnabled(user.id);

    if (!mfaEnabled) {
        return next();
    }

    // Check for MFA verification in session
    const mfaVerified = await c.env.MCP_KV.get(`mfa:verified:${user.id}`);
    if (!mfaVerified) {
        return c.json({
            error: 'MFA Required',
            message: 'Please verify your identity with your authenticator app.',
            mfaRequired: true
        }, 403);
    }

    return next();
};
