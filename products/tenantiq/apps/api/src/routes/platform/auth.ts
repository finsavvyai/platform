import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody } from '../../middleware/validation.middleware';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { generateToken, verifyPassword } from '../../lib/auth';
import type { AppEnv } from '../../index';
import {
	findUserByEmail,
	findUserById,
	getBearerToken,
	getOrganizationSummary,
	type OrganizationSummary,
	verifyBearerToken,
} from './auth-helpers';

/**
 * Platform Authentication Routes
 *
 * Email/password authentication for platform admins and tenant users
 */

const auth = new Hono<AppEnv>();

// TODO: Add IP-based rate limiting for auth endpoints
// Note: standardRateLimit requires tenantId which platform auth doesn't have yet

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

/**
 * POST /platform/auth/login
 *
 * Email/password login for platform admins and tenant users
 */
auth.post('/login', validateBody(loginSchema), async (c) => {
	const { email, password } = await c.req.json();

	try {
		const db = getDb(c.env);

		// Find user by email
		const user = await findUserByEmail(db, email);
		if (!user) {
			return c.json({ error: 'Unauthorized', message: 'Invalid credentials' }, 401);
		}

		// Check if user is active
		if (user.status !== 'active') {
			return c.json({ error: 'Forbidden', message: 'User account is not active' }, 403);
		}

		// Verify password
		if (!user.passwordHash) {
			return c.json({ error: 'Unauthorized', message: 'Password authentication not available for this user' }, 401);
		}

		const isValidPassword = await verifyPassword(password, user.passwordHash);
		if (!isValidPassword) {
			return c.json({ error: 'Unauthorized', message: 'Invalid credentials' }, 401);
		}

		// Generate JWT token
		const token = await generateToken(
			{
				sub: user.id,
				email: user.email,
				name: user.name || 'User',
				role: user.role as 'platform_admin' | 'tenant_admin' | 'tenant_operator' | 'tenant_viewer',
				orgId: user.organizationId || undefined,
			},
			c.env.JWT_SECRET,
			'7d' // 7 days expiration
		);

		// Update last login timestamp
		const now = new Date().toISOString();
		await db
			.update(schema.platformUsers)
			.set({
				lastLoginAt: now,
				updatedAt: now,
			})
			.where(eq(schema.platformUsers.id, user.id));

		// Get organization details if applicable
		let organization: OrganizationSummary | null = null;
		if (user.organizationId) {
			organization = await getOrganizationSummary(db, user.organizationId);
		}

		return c.json({
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				organizationId: user.organizationId,
				emailVerified: Boolean(user.emailVerified),
			},
			organization,
		});
	} catch (error) {
		console.error('Login failed:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

/**
 * POST /platform/auth/verify
 *
 * Verify JWT token and return user information
 */
auth.post('/verify', async (c) => {
	const token = getBearerToken(c.req.header('Authorization'));
	if (!token) {
		return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
	}

	try {
		const payload = await verifyBearerToken(token, c.env.JWT_SECRET);

		const db = getDb(c.env);
		const user = await findUserById(db, payload.sub);
		if (!user || user.status !== 'active') {
			return c.json({ error: 'Unauthorized', message: 'Invalid or inactive user' }, 401);
		}

		return c.json({
			valid: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
				organizationId: user.organizationId,
			},
		});
	} catch (error) {
		return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401);
	}
});

/**
 * GET /platform/auth/me
 *
 * Get current user information (requires authentication)
 */
auth.get('/me', async (c) => {
	const token = getBearerToken(c.req.header('Authorization'));
	if (!token) {
		return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
	}

	try {
		const payload = await verifyBearerToken(token, c.env.JWT_SECRET);

		const db = getDb(c.env);
		const user = await findUserById(db, payload.sub);
		if (!user) {
			return c.json({ error: 'Not Found', message: 'User not found' }, 404);
		}

		// Get organization if applicable
		let organization: OrganizationSummary | null = null;
		if (user.organizationId) {
			organization = await getOrganizationSummary(db, user.organizationId, true);
		}

		return c.json({
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			status: user.status,
			emailVerified: Boolean(user.emailVerified),
			organizationId: user.organizationId,
			createdAt: user.createdAt,
			lastLoginAt: user.lastLoginAt,
			organization,
		});
	} catch (error) {
		return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401);
	}
});

export default auth;
