/**
 * EncryptionEngine - Data encryption and decryption with key management
 */

import crypto from 'crypto';
import {
  DLPConfig,
  ProcessedData,
  EncryptionParams,
  EncryptedData,
} from '../../types/dlp';

export class EncryptionEngine {
  private config: DLPConfig['encryption'];
  private keys: Map<string, string> = new Map();

  constructor(config: DLPConfig['encryption']) {
    this.config = config;
    this.initializeKeys();
  }

  async encrypt(data: ProcessedData | string, params: EncryptionParams): Promise<EncryptedData> {
    const algorithm = params.algorithm || 'AES-256-GCM';
    const keyId = params.keyId || 'default';

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('dlp-encryption'));

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm,
      keyId,
      timestamp: new Date().toISOString()
    };
  }

  async decrypt(encryptedData: EncryptedData): Promise<unknown> {
    const { encrypted, iv, authTag, algorithm, keyId } = encryptedData;

    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${keyId}`);
    }

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('dlp-encryption'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private initializeKeys(): void {
    // In production, load from a secure key management system
    this.keys.set('default', crypto.randomBytes(32).toString('hex'));
  }
}
