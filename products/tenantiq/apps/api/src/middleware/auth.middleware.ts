// Consolidated into ./auth.ts. This shim preserves legacy imports.
// Do not add new logic here — edit ./auth.ts instead.
export {
	authMiddleware,
	tenantScopingMiddleware,
	requireRole,
	extractToken,
	SESSION_COOKIE,
	type AuthPayload,
} from './auth';
