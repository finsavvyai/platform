// Public API — shipped in the npm package.
// The cloud-managed verification middleware is the only published entry point.
// Self-hosted routes (binding, step-up) and internal crypto utilities (trust-score,
// verify, crypto) are kept internal and excluded via package.json `files`.
export { tokenForgeMiddleware } from './middleware.js';
export type { TokenForgeOptions } from './middleware.js';
// FIDO2/WebAuthn server-side verification (Sprint E1).
export {
  verifyWebAuthnAttestation,
  verifyWebAuthnAssertion,
  verifyClientDataJSON,
} from './webauthn-verify.js';
export type { AttestationVerifyResult } from './webauthn-verify.js';
