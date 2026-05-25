/**
 * @tokenforge/browser — DBSC-aligned client SDK.
 *
 * Phase 4 ships the universal Web Crypto path. Phase 8 will fold in
 * native DBSC + WebAuthn under the same `TokenForge` surface.
 */

export const SDK_VERSION = '0.1.0' as const;

export { TokenForge } from './core/tokenforge.js';
export { signDpop } from './core/signer.js';
export {
  IndexedDBBindingStorage,
  MemoryBindingStorage,
  defaultStorage,
} from './core/storage.js';
export { makeInterceptingFetch } from './core/interceptor.js';
export { bindViaWebCrypto, RegisterError } from './transports/webcrypto.js';
export { detectNativeDbsc, primeNativeDbsc } from './transports/dbsc.js';
export type {
  BindArgs,
  BindingClass,
  BindingStorage,
  BoundSessionRecord,
  RegisterResponse,
  TokenForgeEvent,
  TokenForgeListener,
  TokenForgeOptions,
} from './types.js';
