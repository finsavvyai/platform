/**
 * Hono adapter — re-export of the cloud-managed verification middleware.
 * Usage: import { tokenForgeMiddleware } from '@opensyber/tokenforge/hono'
 *
 * Self-hosted routes (createTokenForgeRoutes, createStepUpRoutes) are kept
 * internal — they require the full crypto stack which is excluded from the
 * published tarball. Self-hosting customers should use the source repo
 * directly instead of the npm package.
 */
export { tokenForgeMiddleware, requireFreshSig } from '../server/middleware.js';
export type { TokenForgeOptions } from '../server/middleware.js';
