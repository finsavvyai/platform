import { signJWT, verifyJWT } from '../../../../backend/src/auth/jwt';

const SECRET = 'test-secret-key';

describe('JWT sign + verify', () => {
  it('should sign and verify a token round-trip', async () => {
    const payload = { userId: 'u1', email: 'a@b.com', role: 'admin' };
    const token = await signJWT(payload, SECRET, 3600);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await verifyJWT(token, SECRET);
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('a@b.com');
    expect(decoded.role).toBe('admin');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBe(3600);
  });

  it('should reject a token signed with a different secret', async () => {
    const token = await signJWT({ userId: 'u1' }, SECRET, 3600);
    await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow('Invalid signature');
  });

  it('should reject a tampered token payload', async () => {
    const token = await signJWT({ userId: 'u1' }, SECRET, 3600);
    const [header, , signature] = token.split('.');
    // Tamper with the payload
    const fakePayload = btoa(JSON.stringify({ userId: 'hacker', iat: 0, exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const tampered = `${header}.${fakePayload}.${signature}`;
    await expect(verifyJWT(tampered, SECRET)).rejects.toThrow('Invalid signature');
  });

  it('should reject an expired token', async () => {
    // Sign with -1 second expiry (already expired)
    const token = await signJWT({ userId: 'u1' }, SECRET, -1);
    await expect(verifyJWT(token, SECRET)).rejects.toThrow('Token expired');
  });

  it('should reject a malformed token (wrong number of parts)', async () => {
    await expect(verifyJWT('not.a.valid.token', SECRET)).rejects.toThrow();
    await expect(verifyJWT('nope', SECRET)).rejects.toThrow('Malformed token');
    await expect(verifyJWT('two.parts', SECRET)).rejects.toThrow('Malformed token');
  });

  it('should reject an empty string', async () => {
    await expect(verifyJWT('', SECRET)).rejects.toThrow('Malformed token');
  });

  it('should include iat and exp in every signed token', async () => {
    const token = await signJWT({}, SECRET, 60);
    const decoded = await verifyJWT(token, SECRET);
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });
});
