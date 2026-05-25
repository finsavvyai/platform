// Tests for SecurityUtils

import { SecurityUtils } from '../../src/utils';

describe('SecurityUtils', () => {
  describe('generateSecureRandom', () => {
    it('should generate random string of default length', () => {
      const random = SecurityUtils.generateSecureRandom();
      expect(random).toHaveLength(32);
      expect(typeof random).toBe('string');
    });

    it('should generate random string of specified length', () => {
      const random = SecurityUtils.generateSecureRandom(16);
      expect(random).toHaveLength(16);
    });

    it('should generate different values on multiple calls', () => {
      const random1 = SecurityUtils.generateSecureRandom();
      const random2 = SecurityUtils.generateSecureRandom();
      expect(random1).not.toBe(random2);
    });
  });

  describe('maskPII', () => {
    it('should mask email addresses', () => {
      const text = 'Contact john.doe@example.com for support';
      const masked = SecurityUtils.maskPII(text);
      expect(masked).toMatch(/j\*{3,}\.d\*{3,}@example\.com/);
    });

    it('should mask phone numbers', () => {
      const text = 'Call (555) 123-4567 for help';
      const masked = SecurityUtils.maskPII(text);
      expect(masked).toMatch(/\(\*\*\*\)-\*\*\*-\d{4}/);
    });

    it('should mask SSNs', () => {
      const text = 'SSN: 123-45-6789';
      const masked = SecurityUtils.maskPII(text);
      expect(masked).toBe('SSN: ***-**-****');
    });

    it('should mask credit card numbers', () => {
      const text = 'Card: 4111 1111 1111 1111';
      const masked = SecurityUtils.maskPII(text);
      expect(masked).toBe('Card: ****-****-****-1111');
    });

    it('should respect masking options', () => {
      const text = 'Email: test@example.com, Phone: (555) 123-4567';
      const masked = SecurityUtils.maskPII(text, { phone: false });
      expect(masked).toMatch(/t\*{3,}@example\.com/);
      expect(masked).toContain('(555) 123-4567');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Sensitive data';
      const encrypted = SecurityUtils.encrypt(plaintext);
      const decrypted = SecurityUtils.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should use custom key', () => {
      const plaintext = 'Secret message';
      const key = 'custom-key-123';

      const encrypted = SecurityUtils.encrypt(plaintext, key);
      const decrypted = SecurityUtils.decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', () => {
      const plaintext = 'Secret message';
      const key1 = 'key1';
      const key2 = 'key2';

      const encrypted = SecurityUtils.encrypt(plaintext, key1);

      expect(() => {
        SecurityUtils.decrypt(encrypted, key2);
      }).toThrow();
    });
  });
});
