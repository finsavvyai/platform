/**
 * JWT utilities for token creation, verification, and refresh.
 * Uses HMAC-SHA256 (HS256) for signing.
 */

import type { TokenPayload, RefreshTokenPayload, JWTOptions } from './types.js';

interface JWTHeader {
  alg: string;
  typ: string;
}

export class JWTError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JWTError';
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) base64 += '='.repeat(4 - padding);
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return new Uint8Array(signature);
}

async function verifyHmacSha256(secret: string, data: string, signature: Uint8Array): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature as unknown as ArrayBuffer, messageData);
}

export async function createToken(payload: TokenPayload, options: JWTOptions): Promise<string> {
  const header: JWTHeader = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = typeof options.expiresIn === 'string' ? 3600 : options.expiresIn ?? 3600;

  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerStr = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadStr = base64UrlEncode(new TextEncoder().encode(JSON.stringify(tokenPayload)));
  const message = `${headerStr}.${payloadStr}`;

  const signature = await hmacSha256(options.secret, message);
  const signatureStr = base64UrlEncode(signature);

  return `${message}.${signatureStr}`;
}

export async function verifyToken(token: string, options: JWTOptions): Promise<TokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JWTError('Invalid token format');

  const [headerStr, payloadStr, signatureStr] = parts;
  const message = `${headerStr}.${payloadStr}`;

  const signature = base64UrlDecode(signatureStr!);
  const isValid = await verifyHmacSha256(options.secret, message, signature);
  if (!isValid) throw new JWTError('Invalid signature');

  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadStr!));
  const payload = JSON.parse(payloadJson) as TokenPayload;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new JWTError('Token expired');

  return payload;
}

export async function refreshToken(token: string, options: JWTOptions): Promise<string> {
  const payload = await verifyToken(token, options);
  const newPayload: TokenPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  };
  return createToken(newPayload, options);
}

export async function parseJWT(token: string): Promise<Partial<TokenPayload>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JWTError('Invalid token format');

  const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]!));
  return JSON.parse(payloadJson) as Partial<TokenPayload>;
}
