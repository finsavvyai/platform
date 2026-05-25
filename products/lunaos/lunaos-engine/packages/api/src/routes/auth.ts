/**
 * Auth routes — POST /auth/signup, POST /auth/login
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { signJWT } from '../utils/jwt';
import { sendWelcomeEmail } from '../services/email';
import { validateJson } from '../middleware/validation';
import { signupSchema, loginSchema } from '../schemas';
import { ipRateLimit } from '../middleware/ip-rate-limiter';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/signup
 * Body: { email, password, name? }
 * IP rate limited: 10 attempts per IP per 5 minutes
 */
authRoutes.post('/signup', ipRateLimit, validateJson(signupSchema), async (c) => {
    const { email, password, name } = c.req.valid('json');

    // Check if user exists
    const existing = await c.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) {
        return c.json({ error: 'Email already registered' }, 409);
    }

    // Hash password with Web Crypto
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        256
    );

    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    const passwordHash = `${saltHex}:${hashHex}`;

    // Create user
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
        `INSERT INTO users (id, email, name, password_hash, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, email.toLowerCase(), name || '', passwordHash, 'free', now, now).run();

    // Generate JWT
    const token = await signJWT(
        { sub: userId, email: email.toLowerCase(), tier: 'free' },
        c.env.JWT_SECRET,
        1 // 1 hour
    );

    // Send welcome email (non-blocking)
    if (c.env.RESEND_API_KEY) {
        sendWelcomeEmail(c.env.RESEND_API_KEY, {
            email: email.toLowerCase(),
            name: name || '',
        }).catch(() => { /* non-critical */ });
    }

    return c.json({
        token,
        user: {
            id: userId,
            email: email.toLowerCase(),
            name: name || '',
            tier: 'free',
        },
    }, 201);
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
authRoutes.post('/login', ipRateLimit, validateJson(loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    // Find user
    const user = await c.env.DB.prepare(
        'SELECT id, email, name, password_hash, tier FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{
        id: string;
        email: string;
        name: string;
        password_hash: string;
        tier: string;
    }>();

    if (!user) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const [saltHex, storedHash] = user.password_hash.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        256
    );

    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== storedHash) {
        return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate JWT
    const token = await signJWT(
        { sub: user.id, email: user.email, tier: user.tier },
        c.env.JWT_SECRET,
        1 // 1 hour
    );

    // Update last login
    await c.env.DB.prepare(
        'UPDATE users SET updated_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    return c.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            tier: user.tier,
        },
    });
});

/**
 * GET /auth/me — get current user info (requires auth)
 */
authRoutes.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Not authenticated' }, 401);
    }

    const { verifyJWT: verify } = await import('../utils/jwt');
    try {
        const payload = await verify(authHeader.slice(7), c.env.JWT_SECRET);
        const user = await c.env.DB.prepare(
            'SELECT id, email, name, tier, created_at FROM users WHERE id = ?'
        ).bind(payload.sub).first();

        if (!user) return c.json({ error: 'User not found' }, 404);
        return c.json({ user });
    } catch {
        return c.json({ error: 'Invalid token' }, 401);
    }
});
