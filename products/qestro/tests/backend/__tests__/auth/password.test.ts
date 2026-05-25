import { hashPassword, verifyPassword } from '../../../../backend/src/auth/password';

describe('Password hashing (PBKDF2)', () => {
  it('should hash and verify a password round-trip', async () => {
    const stored = await hashPassword('MyP@ssw0rd');
    expect(typeof stored).toBe('string');
    expect(stored).toContain(':');

    const valid = await verifyPassword('MyP@ssw0rd', stored);
    expect(valid).toBe(true);
  });

  it('should reject a wrong password', async () => {
    const stored = await hashPassword('correct-password');
    const valid = await verifyPassword('wrong-password', stored);
    expect(valid).toBe(false);
  });

  it('should produce unique salts for the same password', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);

    const [salt1] = hash1.split(':');
    const [salt2] = hash2.split(':');
    expect(salt1).not.toBe(salt2);
  });

  it('should return false for malformed stored hash', async () => {
    const valid = await verifyPassword('any', 'not-a-valid-hash');
    expect(valid).toBe(false);
  });

  it('should return false for empty stored hash', async () => {
    const valid = await verifyPassword('any', '');
    expect(valid).toBe(false);
  });
});
