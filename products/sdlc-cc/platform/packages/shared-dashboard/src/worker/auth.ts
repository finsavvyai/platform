/**
 * Authentication module for Unified Dashboard
 *
 * This file re-exports the secure auth implementation.
 * All consumers should import from './auth-secure' directly.
 * Kept for backwards compatibility.
 */

export {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  generateToken,
  createSession,
  destroySession,
  getUserById,
  getUserByEmail,
  hashPassword,
  verifyPassword,
  hashAPIKey,
  setJWTSecret,
  getJWTSecret,
} from './auth-secure';

export type { User, AuthContext } from './auth-secure';
