/**
 * Auth Routes - Password reset
 */

import { Hono } from 'hono';
import '../types';
import { getUserByEmail } from '../auth-secure';
import { hashPassword, hashAPIKey } from '../crypto-utils';
import type { Env } from './types';

const passwordResetRoutes = new Hono<{ Bindings: Env }>();

/** POST /request-password-reset - Request password reset token */
passwordResetRoutes.post('/request-password-reset', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        error: 'Invalid request',
        message: 'Email is required',
      }, 400);
    }

    const user = await getUserByEmail(email, c.env.DASHBOARD_DB);

    if (!user) {
      return c.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    }

    const tokenId = crypto.randomUUID();
    const resetToken = crypto.randomUUID();
    const tokenHash = await hashAPIKey(resetToken);
    const tokenPrefix = resetToken.substring(0, 8);

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_email_verification_tokens (
        id, user_id, token_hash, token_prefix, purpose, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      tokenId,
      user.id,
      tokenHash,
      tokenPrefix,
      'password_reset',
      expiresAt
    ).run();

    return c.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent',
      resetToken,
      resetUrl: `/auth/reset-password?token=${resetToken}`,
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'Failed to send reset email',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/** POST /reset-password - Reset password with token */
passwordResetRoutes.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({
        error: 'Invalid request',
        message: 'Token and new password are required',
      }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({
        error: 'Weak password',
        message: 'Password must be at least 8 characters long',
      }, 400);
    }

    const tokenHash = await hashAPIKey(token);

    const tokenRecord = await c.env.DASHBOARD_DB.prepare(`
      SELECT * FROM dashboard_email_verification_tokens
      WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL
    `).bind(tokenHash).first();

    if (!tokenRecord) {
      return c.json({
        error: 'Invalid token',
        message: 'Reset token is invalid or has already been used',
      }, 400);
    }

    const expiresAt = new Date(tokenRecord.expires_at as string);
    if (expiresAt < new Date()) {
      return c.json({
        error: 'Token expired',
        message: 'Reset token has expired. Please request a new one.',
      }, 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET password_hash = ?
      WHERE id = ?
    `).bind(passwordHash, tokenRecord.user_id).run();

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_email_verification_tokens
      SET used_at = datetime('now')
      WHERE id = ?
    `).bind(tokenRecord.id).run();

    return c.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({
      error: 'Password reset failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default passwordResetRoutes;
