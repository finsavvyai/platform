import { Hono } from 'hono';
import type { TokenForgeServerOptions } from '../shared/types.js';
import type { StepUpChallengeRecord } from './storage/interface.js';
import { verifyTotp } from './totp.js';

interface Variables {
  userId: string;
  sessionId: string;
}

const MAX_CHALLENGES_PER_WINDOW = 5;
const CHALLENGE_WINDOW_MINUTES = 15;
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

/**
 * Step-up authentication routes for TokenForge.
 * Mount at /api/tf/step-up on the main Hono app.
 * @param options - Server options (storage, email sender, passkey verifier).
 * @returns A Hono sub-app with /initiate and /complete routes.
 */
export function createStepUpRoutes(
  options: TokenForgeServerOptions,
): Hono<{ Variables: Variables }> {
  const stepUp = new Hono<{ Variables: Variables }>();

  stepUp.post('/initiate', async (c) => {
    const userId = c.get('userId');
    const sessionId = c.get('sessionId');
    if (!userId || !sessionId) return c.json({ error: 'unauthorized' }, 401);

    const count = await options.storage.countRecentChallenges(userId, CHALLENGE_WINDOW_MINUTES);
    if (count >= MAX_CHALLENGES_PER_WINDOW) {
      return c.json({ error: 'rate_limited', message: 'Too many step-up attempts. Try again later.' }, 429);
    }

    const { method } = await c.req.json<{ method?: string }>();
    const challengeMethod = (method || 'totp') as 'totp' | 'email_otp' | 'passkey';
    const challengeId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000).toISOString();

    const challenge: StepUpChallengeRecord = {
      id: challengeId, sessionId, userId,
      reason: 'trust_score_drop', method: challengeMethod,
      status: 'pending', expiresAt,
      createdAt: now.toISOString(), completedAt: null,
    };
    await options.storage.createChallenge(challenge);

    if (challengeMethod === 'email_otp') {
      const otp = generateOtp();
      await options.storage.storeOtp(challengeId, otp, CHALLENGE_TTL_SECONDS);
      if (options.sendEmail) {
        await options.sendEmail(userId, otp);
      } else {
        throw new Error('sendEmail handler not configured — cannot deliver OTP');
      }
    }

    if (challengeMethod === 'passkey') {
      // Generate WebAuthn challenge and return it
      const webauthnChallenge = generateWebAuthnChallenge();
      return c.json({ challengeId, method: challengeMethod, expiresAt, webauthnChallenge });
    }

    return c.json({ challengeId, method: challengeMethod, expiresAt });
  });

  stepUp.post('/complete', async (c) => {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'unauthorized' }, 401);

    const { challengeId, code, credential } = await c.req.json<{
      challengeId: string;
      code?: string;
      credential?: WebAuthnCredential;
    }>();

    const challenge = await options.storage.getChallenge(challengeId, userId) as StepUpChallengeRecord | null;
    if (!challenge) return c.json({ error: 'invalid_challenge' }, 400);

    if (new Date(challenge.expiresAt) < new Date()) {
      await options.storage.updateChallengeStatus(challengeId, 'expired');
      return c.json({ error: 'challenge_expired' }, 400);
    }

    let verified = false;

    if (challenge.method === 'email_otp') {
      const storedOtp = await options.storage.getOtp(challengeId);
      verified = storedOtp !== null && storedOtp === code;
      if (verified) await options.storage.deleteOtp(challengeId);
    } else if (challenge.method === 'totp' && code) {
      verified = await verifyTotp(code, userId, options);
    } else if (challenge.method === 'passkey' && credential) {
      const storedKey = options.getPasskeyPublicKey
        ? await options.getPasskeyPublicKey(userId, credential.id)
        : null;
      if (storedKey) {
        verified = await verifyPasskeyCredential(credential, storedKey, challengeId);
      }
    }

    if (!verified) {
      await options.storage.updateChallengeStatus(challengeId, 'failed');
      return c.json({ error: 'verification_failed' }, 401);
    }

    await options.storage.updateChallengeStatus(challengeId, 'completed', new Date().toISOString());

    const deviceId = c.req.header('X-TF-Device-ID');
    if (deviceId) {
      await options.storage.restoreTrust(deviceId, userId);
    }

    return c.json({ verified: true, trustScore: 100 });
  });

  return stepUp;
}

/** Generate a 6-digit OTP using CSPRNG */
function generateOtp(): string {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  return ((randomBytes[0]! % 900000) + 100000).toString();
}

/** Generate a WebAuthn challenge (32 random bytes, base64url encoded) */
function generateWebAuthnChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface WebAuthnCredential {
  id: string;
  rawId: string;
  response: { authenticatorData: string; clientDataJSON: string; signature: string };
}

/**
 * Verify a WebAuthn passkey credential against the stored public key.
 * Uses ECDSA P-256 signature verification via Web Crypto API.
 */
async function verifyPasskeyCredential(
  credential: WebAuthnCredential,
  publicKeySpki: ArrayBuffer,
  expectedChallenge: string,
): Promise<boolean> {
  try {
    if (!credential.id || !credential.response?.signature || !credential.response?.authenticatorData) {
      return false;
    }

    const clientDataJSON = atob(credential.response.clientDataJSON);
    const clientData = JSON.parse(clientDataJSON) as { challenge?: string; type?: string };
    if (clientData.type !== 'webauthn.get') return false;

    const decodedChallenge = atob(clientData.challenge?.replace(/-/g, '+').replace(/_/g, '/') ?? '');
    if (decodedChallenge !== expectedChallenge) return false;

    const key = await crypto.subtle.importKey(
      'spki', publicKeySpki,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );

    const authData = Uint8Array.from(atob(credential.response.authenticatorData), (ch) => ch.charCodeAt(0));
    const clientDataHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientDataJSON));
    const signedData = new Uint8Array(authData.length + clientDataHash.byteLength);
    signedData.set(authData, 0);
    signedData.set(new Uint8Array(clientDataHash), authData.length);

    const sigBytes = Uint8Array.from(atob(credential.response.signature), (ch) => ch.charCodeAt(0));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigBytes, signedData);
  } catch {
    return false;
  }
}

/** @deprecated Use createStepUpRoutes(options) instead */
export const stepUpRoutes = new Hono();
