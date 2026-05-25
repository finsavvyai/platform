import { describe, it, expect } from 'vitest';
import { classifyKey, type KeyClass } from './device-telemetry.js';

describe('classifyKey', () => {
  it('returns browser_software for a JWK EC P-256 key', () => {
    const jwk = JSON.stringify({
      kty: 'EC',
      crv: 'P-256',
      x: 'abc',
      y: 'def',
    });
    expect(classifyKey(jwk)).toBe<KeyClass>('browser_software');
  });

  it('returns unknown for non-EC JWK', () => {
    const jwk = JSON.stringify({ kty: 'RSA', n: 'abc', e: 'AQAB' });
    expect(classifyKey(jwk)).toBe<KeyClass>('unknown');
  });

  it('returns unknown for malformed JSON', () => {
    expect(classifyKey('{not-json')).toBe<KeyClass>('unknown');
  });

  it('returns unknown for PEM SPKI (native SDK key)', () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nMFkwEw==\n-----END PUBLIC KEY-----';
    expect(classifyKey(pem)).toBe<KeyClass>('unknown');
  });

  it('returns unknown for an empty or unrecognised value', () => {
    expect(classifyKey('')).toBe<KeyClass>('unknown');
    expect(classifyKey('not-a-key')).toBe<KeyClass>('unknown');
  });

  it('handles whitespace-padded JWK strings', () => {
    const jwk = `\n  ${JSON.stringify({ kty: 'EC', crv: 'P-256' })}  \n`;
    expect(classifyKey(jwk)).toBe<KeyClass>('browser_software');
  });

  it('treats a P-384 EC JWK as unknown — only P-256 is the bound curve', () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-384', x: 'abc', y: 'def' });
    expect(classifyKey(jwk)).toBe<KeyClass>('unknown');
  });

  it('returns secure_enclave for Apple Safari (macOS / iOS / iPadOS) JWK keys', () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' });
    const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const iPhoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1';
    expect(classifyKey(jwk, macSafari)).toBe<KeyClass>('secure_enclave');
    expect(classifyKey(jwk, iPhoneSafari)).toBe<KeyClass>('secure_enclave');
  });

  it('returns tpm2 for Windows Chrome/Edge JWK keys (Chrome 146+ DBSC uses TPM-backed keys)', () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' });
    const winChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
    const winEdge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0';
    expect(classifyKey(jwk, winChrome)).toBe<KeyClass>('tpm2');
    expect(classifyKey(jwk, winEdge)).toBe<KeyClass>('tpm2');
  });

  it('falls back to browser_software for non-matching platforms (Linux Chrome, macOS Chrome, Firefox anywhere)', () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' });
    const linuxChrome = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146.0.0.0 Safari/537.36';
    const macChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/146.0.0.0 Safari/537.36';
    const winFirefox = 'Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0';
    expect(classifyKey(jwk, linuxChrome)).toBe<KeyClass>('browser_software');
    expect(classifyKey(jwk, macChrome)).toBe<KeyClass>('browser_software');
    expect(classifyKey(jwk, winFirefox)).toBe<KeyClass>('browser_software');
  });

  it('UA hint of null/undefined keeps existing browser_software default for JWK keys', () => {
    const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' });
    expect(classifyKey(jwk, null)).toBe<KeyClass>('browser_software');
    expect(classifyKey(jwk, undefined)).toBe<KeyClass>('browser_software');
    expect(classifyKey(jwk)).toBe<KeyClass>('browser_software');
  });
});
