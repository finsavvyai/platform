/**
 * FinSavvy Shield - Shared Auth Exports
 */

// Unified auth service and types
export {
    UnifiedAuthService,
    createAuthMiddleware,
    sharedAuthConfig,
    type UnifiedJWTClaims,
    type UnifiedAPIKey,
} from './unified-auth';

// Configuration
export {
    getAuthConfig,
    TIER_RATE_LIMITS,
    TIER_MONTHLY_LIMITS,
    ROLE_PERMISSIONS,
    type AuthConfig,
    type Role,
    type PricingTier,
} from './config';
