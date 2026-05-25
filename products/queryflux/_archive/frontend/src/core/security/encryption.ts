/**
 * PCI DSS Compliant Encryption Services
 *
 * Provides encryption, decryption, and key management services
 * compliant with PCI DSS requirements for handling sensitive data.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
  algorithm: string;
  keyLength: number;
  tag?: string;
}

export interface KeyDerivationOptions {
  salt: string;
  iterations: number;
  keyLength: number;
  algorithm: string;
}

/**
 * PCI DSS Compliant Encryption Service
 *
 * Implements strong encryption standards required for PCI DSS compliance:
 * - AES-256-GCM for data at rest
 * - Strong key derivation with scrypt
 * - Secure random IV generation
 * - Authentication tags for integrity
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly SCRYPT_ITERATIONS = 32768; // OWASP recommended

  /**
   * Master encryption key (should be stored in HSM or KMS in production)
   * In production, this should be retrieved from a secure key management system
   */
  private static readonly MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ||
    'CHANGE_ME_IN_PRODUCTION_USE_ENVIRONMENT_VARIABLE_OR_HSM';

  /**
   * Encrypt sensitive data using AES-256-GCM
   *
   * @param plaintext - Data to encrypt
   * @param password - Optional password for key derivation
   * @returns Encrypted data with all necessary components for decryption
   */
  static encrypt(plaintext: string, password?: string): EncryptionResult {
    try {
      // Generate random salt for key derivation
      const salt = randomBytes(this.SALT_LENGTH);

      // Derive encryption key using scrypt
      const key = this.deriveKey(password || this.MASTER_KEY, salt);

      // Generate random IV
      const iv = randomBytes(this.IV_LENGTH);

      // Create cipher
      const cipher = createCipheriv(this.ALGORITHM, key, iv);

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Return all components needed for decryption
      return {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: this.ALGORITHM,
        keyLength: this.KEY_LENGTH,
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   *
   * @param encryptionResult - Encrypted data with all components
   * @param password - Optional password used during encryption
   * @returns Decrypted plaintext
   */
  static decrypt(encryptionResult: EncryptionResult, password?: string): string {
    try {
      const { encrypted, iv, salt, tag } = encryptionResult;

      // Validate required components
      if (!encrypted || !iv || !salt || !tag) {
        throw new Error('Invalid encryption result: missing required components');
      }

      // Derive key using same parameters
      const key = this.deriveKey(password || this.MASTER_KEY, Buffer.from(salt, 'hex'));

      // Create decipher
      const decipher = createDecipheriv(
        encryptionResult.algorithm,
        key,
        Buffer.from(iv, 'hex')
      );

      // Set authentication tag
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Log security incident but don't expose details
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed: invalid or corrupted data');
    }
  }

  /**
   * Derive encryption key using scrypt
   *
   * @param password - Password or master key
   * @param salt - Salt for key derivation
   * @returns Derived key
   */
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return scryptSync(
      password,
      salt,
      this.KEY_LENGTH,
      { N: this.SCRYPT_ITERATIONS }
    );
  }

  /**
   * Hash sensitive data (for passwords, etc.)
   *
   * @param data - Data to hash
   * @param salt - Optional salt
   * @returns Hashed data
   */
  static hash(data: string, salt?: string): string {
    const hashInput = salt ? `${data}${salt}` : data;
    return createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Generate cryptographically secure random token
   *
   * @param length - Token length in bytes
   * @returns Random token
   */
  static generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate secure API key with prefix
   *
   * @param prefix - API key prefix (e.g., 'qf_')
   * @returns Formatted API key
   */
  static generateApiKey(prefix: string = 'qf_'): string {
    const token = this.generateToken(32);
    return `${prefix}${token}`;
  }

  /**
   * Validate encrypted data format
   *
   * @param data - Data to validate
   * @returns True if format is valid
   */
  static isValidEncryptedFormat(data: any): data is EncryptionResult {
    return data &&
           typeof data === 'object' &&
           typeof data.encrypted === 'string' &&
           typeof data.iv === 'string' &&
           typeof data.salt === 'string' &&
           typeof data.algorithm === 'string' &&
           typeof data.keyLength === 'number' &&
           data.encrypted.length > 0 &&
           data.iv.length > 0 &&
           data.salt.length > 0;
  }

  /**
   * Encrypt database connection credentials
   *
   * @param credentials - Database credentials
   * @param masterKey - Master encryption key
   * @returns Encrypted credentials
   */
  static encryptCredentials(credentials: {
    username?: string;
    password?: string;
    certificate?: string;
    privateKey?: string;
  }, masterKey?: string): Record<string, EncryptionResult> {
    const encrypted: Record<string, EncryptionResult> = {};

    if (credentials.username) {
      encrypted.username = this.encrypt(credentials.username, masterKey);
    }

    if (credentials.password) {
      encrypted.password = this.encrypt(credentials.password, masterKey);
    }

    if (credentials.certificate) {
      encrypted.certificate = this.encrypt(credentials.certificate, masterKey);
    }

    if (credentials.privateKey) {
      encrypted.privateKey = this.encrypt(credentials.privateKey, masterKey);
    }

    return encrypted;
  }

  /**
   * Decrypt database connection credentials
   *
   * @param encryptedCredentials - Encrypted credentials
   * @param masterKey - Master encryption key
   * @returns Decrypted credentials
   */
  static decryptCredentials(
    encryptedCredentials: Record<string, EncryptionResult>,
    masterKey?: string
  ): {
    username?: string;
    password?: string;
    certificate?: string;
    privateKey?: string;
  } {
    const credentials: any = {};

    if (encryptedCredentials.username) {
      credentials.username = this.decrypt(encryptedCredentials.username, masterKey);
    }

    if (encryptedCredentials.password) {
      credentials.password = this.decrypt(encryptedCredentials.password, masterKey);
    }

    if (encryptedCredentials.certificate) {
      credentials.certificate = this.decrypt(encryptedCredentials.certificate, masterKey);
    }

    if (encryptedCredentials.privateKey) {
      credentials.privateKey = this.decrypt(encryptedCredentials.privateKey, masterKey);
    }

    return credentials;
  }

  /**
   * Rotate encryption keys for PCI DSS compliance
   *
   * @param oldMasterKey - Current master key
   * @param newMasterKey - New master key
   * @param encryptedData - Data encrypted with old key
   * @returns Data re-encrypted with new key
   */
  static rotateKeys(
    oldMasterKey: string,
    newMasterKey: string,
    encryptedData: Record<string, EncryptionResult>
  ): Record<string, EncryptionResult> {
    const reEncrypted: Record<string, EncryptionResult> = {};

    for (const [key, value] of Object.entries(encryptedData)) {
      try {
        // Decrypt with old key
        const decrypted = this.decrypt(value, oldMasterKey);

        // Re-encrypt with new key
        reEncrypted[key] = this.encrypt(decrypted, newMasterKey);
      } catch (error) {
        console.error(`Failed to rotate key for ${key}:`, error);
        throw new Error(`Key rotation failed for field: ${key}`);
      }
    }

    return reEncrypted;
  }

  /**
   * Validate password strength according to PCI DSS requirements
   *
   * @param password - Password to validate
   * @returns Validation result
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
    requirements: {
      minLength: boolean;
      uppercase: boolean;
      lowercase: boolean;
      numbers: boolean;
      specialChars: boolean;
      noCommonPatterns: boolean;
    };
  } {
    const requirements = {
      minLength: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      specialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noCommonPatterns: !/(.)\1{2,}|123|abc|password|qwerty/i.test(password)
    };

    const feedback: string[] = [];

    if (!requirements.minLength) feedback.push('Password must be at least 12 characters long');
    if (!requirements.uppercase) feedback.push('Password must contain uppercase letters');
    if (!requirements.lowercase) feedback.push('Password must contain lowercase letters');
    if (!requirements.numbers) feedback.push('Password must contain numbers');
    if (!requirements.specialChars) feedback.push('Password must contain special characters');
    if (!requirements.noCommonPatterns) feedback.push('Password cannot contain common patterns or repeated characters');

    const score = Object.values(requirements).filter(Boolean).length;
    const isValid = score === 6;

    return {
      isValid,
      score,
      feedback,
      requirements
    };
  }

  /**
   * Generate secure session token
   *
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param expiresAt - Expiration time
   * @returns Secure session token
   */
  static generateSessionToken(
    userId: string,
    sessionId: string,
    expiresAt: Date
  ): string {
    const payload = `${userId}:${sessionId}:${expiresAt.getTime()}:${this.generateToken(16)}`;
    const signature = this.hash(payload, process.env.SESSION_SECRET || 'default-secret');

    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * Validate session token
   *
   * @param token - Session token
   * @returns Token validation result
   */
  static validateSessionToken(token: string): {
    isValid: boolean;
    userId?: string;
    sessionId?: string;
    expiresAt?: Date;
    error?: string;
  } {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const [userId, sessionId, expiresTimestamp, nonce, signature] = decoded.split(':');

      if (!userId || !sessionId || !expiresTimestamp || !signature) {
        return { isValid: false, error: 'Invalid token format' };
      }

      const expiresAt = new Date(parseInt(expiresTimestamp));
      if (expiresAt < new Date()) {
        return { isValid: false, error: 'Token expired' };
      }

      const payload = `${userId}:${sessionId}:${expiresTimestamp}:${nonce}`;
      const expectedSignature = this.hash(payload, process.env.SESSION_SECRET || 'default-secret');

      if (signature !== expectedSignature) {
        return { isValid: false, error: 'Invalid token signature' };
      }

      return {
        isValid: true,
        userId,
        sessionId,
        expiresAt
      };
    } catch (error) {
      return { isValid: false, error: 'Token validation failed' };
    }
  }
}

/**
 * PCI DSS Compliant Tokenization Service
 *
 * Replaces sensitive data with non-sensitive tokens for storage
 */
export class TokenizationService {
  private static readonly TOKEN_PREFIX = 'tok_';
  private static readonly VAULT_PREFIX = 'vault_';

  /**
   * Tokenize sensitive data
   *
   * @param sensitiveData - Data to tokenize
   * @param context - Context for tokenization (e.g., 'credit_card', 'ssn')
   * @returns Token representing the sensitive data
   */
  static tokenize(sensitiveData: string, context: string = 'default'): string {
    const timestamp = Date.now().toString();
    const hash = EncryptionService.hash(`${sensitiveData}:${context}:${timestamp}`);
    return `${this.TOKEN_PREFIX}${context}_${hash}`;
  }

  /**
   * Check if a value is a token
   *
   * @param value - Value to check
   * @returns True if value is a token
   */
  static isToken(value: string): boolean {
    return value.startsWith(this.TOKEN_PREFIX);
  }

  /**
   * Generate vault reference for secure storage
   *
   * @param dataType - Type of data being stored
   * @param userId - User ID
   * @returns Vault reference
   */
  static generateVaultReference(dataType: string, userId: string): string {
    const timestamp = Date.now().toString();
    const random = EncryptionService.generateToken(16);
    return `${this.VAULT_PREFIX}${dataType}_${userId}_${timestamp}_${random}`;
  }
}

export default EncryptionService;
