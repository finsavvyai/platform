import { describe, it, expect, beforeEach } from 'vitest';
import { signToken, SignTokenInput } from '../src/jwt/sign';
import { verifyToken, verifyTokenSafe, TokenVerificationError } from '../src/jwt/verify';

const SECRET = 'test-secret-key-very-secure';
const EXPIRED_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('JWT Sign/Verify', () => {
  let payload: SignTokenInput;

  beforeEach(() => {
    payload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'user',
    };
  });

  it('should sign a valid token', () => {
    const token = signToken(payload, SECRET);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('should verify a valid token', () => {
    const token = signToken(payload, SECRET);
    const decoded = verifyToken(token, SECRET);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.iat).toBeTruthy();
    expect(decoded.exp).toBeTruthy();
  });

  it('should throw error for invalid secret', () => {
    const token = signToken(payload, SECRET);
    expect(() => verifyToken(token, 'wrong-secret')).toThrow();
  });

  it('should throw error for malformed token', () => {
    expect(() => verifyToken('invalid.token', SECRET)).toThrow();
  });

  it('should throw error for empty token', () => {
    expect(() => verifyToken('', SECRET)).toThrow();
  });

  it('should throw error for empty secret', () => {
    expect(() => signToken(payload, '')).toThrow();
  });

  it('should throw error for missing required payload fields', () => {
    const invalidPayload = { sub: 'user-123' } as unknown as SignTokenInput;
    expect(() => signToken(invalidPayload, SECRET)).toThrow();
  });

  it('should sign token with custom expiration', () => {
    const token = signToken(payload, SECRET, { expiresIn: '1h' });
    const decoded = verifyToken(token, SECRET);
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('should return null for invalid token in safe verification', () => {
    const result = verifyTokenSafe('invalid.token', SECRET);
    expect(result).toBeNull();
  });

  it('should successfully verify valid token in safe mode', () => {
    const token = signToken(payload, SECRET);
    const result = verifyTokenSafe(token, SECRET);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe(payload.sub);
  });

  it('should include iat and exp in decoded token', () => {
    const token = signToken(payload, SECRET);
    const decoded = verifyToken(token, SECRET);

    expect(decoded.iat).toBeTruthy();
    expect(typeof decoded.iat).toBe('number');
    expect(decoded.exp).toBeTruthy();
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('should throw TokenVerificationError for invalid tokens', () => {
    try {
      verifyToken('invalid', SECRET);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TokenVerificationError);
    }
  });
});
