/**
 * Auth Routes - Email verification
 */

import { Hono } from 'hono';
import '../types';
import { requireAuth, type User } from '../auth-secure';
import { hashAPIKey } from '../crypto-utils';
import type { Env } from './types';

const emailVerificationRoutes = new Hono<{ Bindings: Env }>();

/** POST /send-verification-email - Send email verification token */
emailVerificationRoutes.post('/send-verification-email', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    if (user.email_verified) {
      return c.json({
        error: 'Already verified',
        message: 'Email is already verified',
      }, 400);
    }

    const tokenId = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();
    const tokenHash = await hashAPIKey(verificationToken);
    const tokenPrefix = verificationToken.substring(0, 8);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_email_verification_tokens (
        id, user_id, token_hash, token_prefix, purpose, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      tokenId,
      user.id,
      tokenHash,
      tokenPrefix,
      'email_verification',
      expiresAt
    ).run();

    return c.json({
      success: true,
      message: 'Verification email sent',
      verificationToken,
      verifyUrl: `/auth/verify-email?token=${verificationToken}`,
    });
  } catch (error) {
    console.error('Send verification email error:', error);
    return c.json({
      error: 'Failed to send verification email',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/** GET /verify-email - Verify email with token */
emailVerificationRoutes.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'Invalid request',
        message: 'Verification token is required',
      }, 400);
    }

    const tokenHash = await hashAPIKey(token);

    const tokenRecord = await c.env.DASHBOARD_DB.prepare(`
      SELECT * FROM dashboard_email_verification_tokens
      WHERE token_hash = ? AND purpose = 'email_verification' AND used_at IS NULL
    `).bind(tokenHash).first();

    if (!tokenRecord) {
      return c.json({
        error: 'Invalid token',
        message: 'Verification token is invalid or has already been used',
      }, 400);
    }

    const expiresAt = new Date(tokenRecord.expires_at as string);
    if (expiresAt < new Date()) {
      return c.json({
        error: 'Token expired',
        message: 'Verification token has expired. Please request a new one.',
      }, 400);
    }

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET email_verified = 1
      WHERE id = ?
    `).bind(tokenRecord.user_id).run();

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_email_verification_tokens
      SET used_at = datetime('now')
      WHERE id = ?
    `).bind(tokenRecord.id).run();

    return c.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default emailVerificationRoutes;
