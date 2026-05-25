/**
 * @tokenforge/hono — drop-in middleware for customer backends.
 *
 * Three-line integration per CISCO-dua.md §8:
 *
 *   import { tokenforge } from '@tokenforge/hono';
 *   app.use('*', tokenforge({ appId, apiKey, onLogin, onStepUp }));
 */

export { tokenforge } from './middleware.js';
export { TokenForgeClient } from './client.js';
export { toSetCookie, clearCookie } from './cookies.js';
export {
  TokenForgeError,
  type LoginResult,
  type TokenForgeMiddlewareOptions,
  type TfRegisterResponse,
  type TfRefreshResponse,
  type RegisterPassthroughBody,
} from './types.js';
