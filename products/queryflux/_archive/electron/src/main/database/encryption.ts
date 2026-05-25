import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly SALT_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  // Generate a key from password using scrypt
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return scryptSync(password, salt, 32);
  }

  // Encrypt sensitive data
  static encrypt(data: string, password: string): string {
    const salt = randomBytes(this.SALT_LENGTH);
    const iv = randomBytes(this.IV_LENGTH);
    const key = this.deriveKey(password, salt);

    const cipher = createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine all components for storage
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);

    return combined.toString('base64');
  }

  // Decrypt sensitive data
  static decrypt(encryptedData: string, password: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');

      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = combined.slice(
        this.SALT_LENGTH + this.IV_LENGTH,
        this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
      );
      const encrypted = combined.slice(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

      const key = this.deriveKey(password, salt);

      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt data. Invalid password or corrupted data.');
    }
  }

  // Generate a secure random password
  static generatePassword(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  // Check if data appears to be encrypted (basic validation)
  static isEncrypted(data: string): boolean {
    try {
      const combined = Buffer.from(data, 'base64');
      return combined.length >= this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH;
    } catch {
      return false;
    }
  }
}