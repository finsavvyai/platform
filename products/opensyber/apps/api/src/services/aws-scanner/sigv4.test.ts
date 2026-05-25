import { describe, it, expect } from 'vitest';
import { sha256, hmacSha256, deriveSigningKey, signString } from './sigv4.js';

describe('sigv4 utilities', () => {
  describe('sha256', () => {
    it('hashes empty string correctly', async () => {
      const result = await sha256('');
      expect(result).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    it('hashes a known string correctly', async () => {
      const result = await sha256('hello');
      expect(result).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    });

    it('returns lowercase hex', async () => {
      const result = await sha256('test');
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('hmacSha256', () => {
    it('returns a 32-byte Uint8Array', async () => {
      const key = new TextEncoder().encode('secret');
      const data = new TextEncoder().encode('message');
      const result = await hmacSha256(key, data);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it('produces consistent output for same inputs', async () => {
      const key = new TextEncoder().encode('key');
      const data = new TextEncoder().encode('data');
      const result1 = await hmacSha256(key, data);
      const result2 = await hmacSha256(key, data);
      expect(Array.from(result1)).toEqual(Array.from(result2));
    });

    it('produces different output for different keys', async () => {
      const data = new TextEncoder().encode('data');
      const result1 = await hmacSha256(new TextEncoder().encode('key1'), data);
      const result2 = await hmacSha256(new TextEncoder().encode('key2'), data);
      expect(Array.from(result1)).not.toEqual(Array.from(result2));
    });
  });

  describe('deriveSigningKey', () => {
    it('returns a 32-byte Uint8Array', async () => {
      const result = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it('matches official AWS SigV4 test vector', async () => {
      // Reference: https://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html
      const result = await deriveSigningKey(
        'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
        '20120215',
        'us-east-1',
        'iam',
      );
      const hex = Array.from(result)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(hex).toBe(
        'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d',
      );
    });

    it('produces consistent output for same inputs', async () => {
      const r1 = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const r2 = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      expect(Array.from(r1)).toEqual(Array.from(r2));
    });

    it('produces different keys for different regions', async () => {
      const r1 = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const r2 = await deriveSigningKey('secret', '20260306', 'eu-west-1', 'sts');
      expect(Array.from(r1)).not.toEqual(Array.from(r2));
    });

    it('produces different keys for different services', async () => {
      const r1 = await deriveSigningKey('secret', '20260306', 'us-east-1', 's3');
      const r2 = await deriveSigningKey('secret', '20260306', 'us-east-1', 'ec2');
      expect(Array.from(r1)).not.toEqual(Array.from(r2));
    });

    it('produces different keys for different dates', async () => {
      const r1 = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const r2 = await deriveSigningKey('secret', '20260307', 'us-east-1', 'sts');
      expect(Array.from(r1)).not.toEqual(Array.from(r2));
    });
  });

  describe('signString', () => {
    it('returns a 64-char hex string', async () => {
      const key = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const result = await signString(key, 'string-to-sign');
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces consistent output for same inputs', async () => {
      const key = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const r1 = await signString(key, 'string-to-sign');
      const r2 = await signString(key, 'string-to-sign');
      expect(r1).toBe(r2);
    });

    it('produces different output for different strings', async () => {
      const key = await deriveSigningKey('secret', '20260306', 'us-east-1', 'sts');
      const r1 = await signString(key, 'string1');
      const r2 = await signString(key, 'string2');
      expect(r1).not.toBe(r2);
    });
  });
});
