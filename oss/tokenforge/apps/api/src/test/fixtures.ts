/**
 * Shared test fixtures: keys, app row, and a signed-DPoP helper.
 */

import { webcrypto } from 'node:crypto';
import { issueApiKey } from '../lib/api-key.js';
import type { App, Tenant } from '@tokenforge/db';
import { newAppId } from '../lib/ids.js';

const subtle = (webcrypto as unknown as Crypto).subtle;

export interface TestApp {
  app: App;
  liveKey: string;
  tenant: Tenant;
}

export async function createTestApp(): Promise<TestApp> {
  const id = newAppId();
  const tenantId = `tnt_${id.slice(-8)}`;
  const issued = await issueApiKey(id);
  const now = new Date();
  return {
    app: {
      id,
      tenantId,
      mode: 'customer',
      name: 'Test App',
      origin: 'https://app.example.com',
      apiKeyHash: issued.hash,
      shortCookieTtlSec: 300,
      longCookieTtlSec: 2_592_000,
      idpType: 'none',
      idpConfig: null,
      enforcePolicy: false,
      createdAt: now,
    } as App,
    liveKey: issued.liveKey,
    tenant: {
      id: tenantId,
      name: 'Test Tenant',
      ownerEmail: 'owner@test.dev',
      plan: 'free',
      lemonSubId: null,
      createdAt: now,
    } as Tenant,
  };
}

export interface KeyPairFixture {
  publicJwk: JsonWebKey;
  privateKey: CryptoKey;
}

export async function generateBrowserKey(): Promise<KeyPairFixture> {
  const pair = (await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const publicJwk = await subtle.exportKey('jwk', pair.publicKey);
  return { publicJwk: publicJwk as JsonWebKey, privateKey: pair.privateKey };
}

export async function signDpop(
  privateKey: CryptoKey,
  claims: { sub: string; nonce: string; iat?: number; exp?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: claims.sub,
    nonce: claims.nonce,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 30,
  };
  const header = { alg: 'ES256', typ: 'JWT' };
  const headerB64 = b64u(JSON.stringify(header));
  const payloadB64 = b64u(JSON.stringify(payload));
  const input = `${headerB64}.${payloadB64}`;
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(input),
  );
  const sigB64 = bytesToB64u(new Uint8Array(sig));
  return `${input}.${sigB64}`;
}

function b64u(s: string): string {
  return bytesToB64u(new TextEncoder().encode(s));
}

function bytesToB64u(b: Uint8Array): string {
  return Buffer.from(b)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
