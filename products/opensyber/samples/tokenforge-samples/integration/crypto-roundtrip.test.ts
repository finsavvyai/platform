/**
 * REAL Integration Test: Client Signing ↔ Server Verification
 *
 * Tests the actual ECDSA P-256 crypto pipeline end-to-end:
 * 1. Client generates a keypair (like the browser SDK does)
 * 2. Client exports the public key as JWK (sent during binding)
 * 3. Server imports the JWK public key
 * 4. Client signs a challenge payload with the private key
 * 5. Server verifies the signature with the stored public key
 *
 * NO MOCKS. Real Web Crypto API calls throughout.
 */
import { describe, it, expect } from 'vitest';
import { importPublicKey, verifySignature } from '../../packages/tokenforge/src/server/crypto.js';
import { generateKeyPair, exportPublicKeyJwk, signPayload, generateNonce } from './crypto-helpers.js';

describe('Real Crypto Roundtrip: Client Sign → Server Verify', () => {
  it('should verify a valid signature from a real keypair', async () => {
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);

    const sessionId = 'session-real-001';
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    // Client signs
    const signature = await signPayload(keyPair.privateKey, sessionId, nonce, timestamp);

    // Server verifies
    const serverKey = await importPublicKey(publicKeyJwk);
    const payload = `${sessionId}:${nonce}:${timestamp}`;
    const valid = await verifySignature(serverKey, signature, payload);

    expect(valid).toBe(true);
  });

  it('should reject a signature with tampered payload', async () => {
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = await signPayload(keyPair.privateKey, 'session-real', nonce, timestamp);

    const serverKey = await importPublicKey(publicKeyJwk);
    // Tamper: different session ID
    const valid = await verifySignature(serverKey, signature, `session-TAMPERED:${nonce}:${timestamp}`);

    expect(valid).toBe(false);
  });

  it('should reject a signature from a different keypair', async () => {
    const keyPairA = await generateKeyPair();
    const keyPairB = await generateKeyPair();
    const publicKeyJwkB = await exportPublicKeyJwk(keyPairB);
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    // Signed with key A
    const signature = await signPayload(keyPairA.privateKey, 'session-x', nonce, timestamp);

    // Verified with key B (should fail)
    const serverKey = await importPublicKey(publicKeyJwkB);
    const valid = await verifySignature(serverKey, signature, `session-x:${nonce}:${timestamp}`);

    expect(valid).toBe(false);
  });

  it('should reject a signature with tampered nonce', async () => {
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = await signPayload(keyPair.privateKey, 'sess', nonce, timestamp);

    const serverKey = await importPublicKey(publicKeyJwk);
    const valid = await verifySignature(serverKey, signature, `sess:TAMPERED-NONCE:${timestamp}`);

    expect(valid).toBe(false);
  });

  it('should reject a signature with tampered timestamp', async () => {
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = await signPayload(keyPair.privateKey, 'sess', nonce, timestamp);

    const serverKey = await importPublicKey(publicKeyJwk);
    const valid = await verifySignature(serverKey, signature, `sess:${nonce}:${timestamp + 1}`);

    expect(valid).toBe(false);
  });

  it('should handle multiple sequential verifications with the same key', async () => {
    const keyPair = await generateKeyPair();
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const serverKey = await importPublicKey(publicKeyJwk);

    for (let i = 0; i < 10; i++) {
      const nonce = generateNonce();
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signPayload(keyPair.privateKey, 'multi-sess', nonce, ts);
      const valid = await verifySignature(serverKey, sig, `multi-sess:${nonce}:${ts}`);
      expect(valid).toBe(true);
    }
  });

  it('should produce unique signatures for the same payload (ECDSA is non-deterministic)', async () => {
    const keyPair = await generateKeyPair();
    const nonce = 'fixed-nonce';
    const ts = 1700000000;

    const sig1 = await signPayload(keyPair.privateKey, 's', nonce, ts);
    const sig2 = await signPayload(keyPair.privateKey, 's', nonce, ts);

    // ECDSA produces different signatures each time (random k)
    expect(sig1).not.toBe(sig2);

    // But both should verify
    const publicKeyJwk = await exportPublicKeyJwk(keyPair);
    const serverKey = await importPublicKey(publicKeyJwk);
    expect(await verifySignature(serverKey, sig1, `s:${nonce}:${ts}`)).toBe(true);
    expect(await verifySignature(serverKey, sig2, `s:${nonce}:${ts}`)).toBe(true);
  });
});
