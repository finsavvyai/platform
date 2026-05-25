import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';

/**
 * Authentication Utilities
 *
 * Handles JWT token generation, verification, and password hashing
 */

/**
 * JWT Payload structure
 */
export interface JWTPayload {
	sub: string; // User ID
	email: string;
	name: string;
	role: 'platform_admin' | 'tenant_admin' | 'tenant_operator' | 'tenant_viewer';
	orgId?: string; // Organization ID (null for platform admins)
	iat?: number;
	exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(
	payload: JWTPayload,
	secret: string,
	expiresIn: string = '7d'
): Promise<string> {
	const encoder = new TextEncoder();
	const secretKey = encoder.encode(secret);

	const token = await new SignJWT({
		sub: payload.sub,
		email: payload.email,
		name: payload.name,
		role: payload.role,
		orgId: payload.orgId,
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(secretKey);

	return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload> {
	const encoder = new TextEncoder();
	const secretKey = encoder.encode(secret);

	const { payload } = await jwtVerify(token, secretKey, {
		algorithms: ['HS256'],
	});

	return payload as unknown as JWTPayload;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = await bcrypt.genSalt(10);
	return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);

	for (let i = 0; i < length; i++) {
		result += chars[randomValues[i] % chars.length];
	}

	return result;
}
