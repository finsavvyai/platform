import type { SessionStore } from "../adapters/session-store.js";
import { randomTokenId } from "../token-utils.js";
import type { WebAuthnChallenge } from "../types.js";
import type { WebAuthnConfig } from "./config.js";

const keyFor = (userId: string): string => `webauthn:challenge:${userId}`;

export const generateChallenge = (userId: string, ttlSeconds: number): WebAuthnChallenge => {
  const now = Date.now();
  return {
    challenge: randomTokenId(32),
    userId,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  };
};

export const storeChallenge = async (
  store: SessionStore<WebAuthnChallenge>,
  challenge: WebAuthnChallenge,
  config: WebAuthnConfig,
): Promise<void> => {
  await store.set(keyFor(challenge.userId), challenge, config.challengeTtlSeconds);
};

export const consumeChallenge = async (
  store: SessionStore<WebAuthnChallenge>,
  userId: string,
): Promise<WebAuthnChallenge | undefined> => {
  const found = await store.get(keyFor(userId));
  if (!found) return undefined;
  await store.delete(keyFor(userId));
  if (found.expiresAt < Date.now()) return undefined;
  return found;
};

export const startChallenge = async (
  store: SessionStore<WebAuthnChallenge>,
  config: WebAuthnConfig,
  userId: string,
): Promise<WebAuthnChallenge> => {
  const challenge = generateChallenge(userId, config.challengeTtlSeconds);
  await storeChallenge(store, challenge, config);
  return challenge;
};
