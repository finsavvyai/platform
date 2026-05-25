/**
 * @finsavvyai/auth — Shared authentication for FinsavvyAI portfolio
 *
 * Features:
 * - JWT token generation and verification
 * - Express middleware with optional DB validation
 * - Role-based access control
 * - Configurable issuer/audience for multi-project support
 */

export {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  configureTokens,
  type TokenPayload,
  type TokenPair,
  type TokenConfig,
} from './tokens.js';

export {
  authenticateToken,
  requireRole,
  configureAuthMiddleware,
  type AuthMiddlewareConfig,
} from './middleware.js';
