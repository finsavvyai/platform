/**
 * Auth Middleware Re-export
 * Re-exports auth middleware from auth.ts for alternate import paths
 */

export {
    authenticateToken,
    authenticateUser,
    requireRole,
    requireSubscription,
    requireFeature,
    checkUsageLimit,
    optionalAuth,
} from './auth.js';
