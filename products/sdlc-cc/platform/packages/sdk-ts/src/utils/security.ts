// Security utilities for the SDLC.ai JavaScript SDK

import CryptoJS from 'crypto-js';
import { isNode, isBrowser } from './environment';

export class SecurityUtils {
  private static readonly ENCRYPTION_KEY = 'sdlc-sdk-encryption-key';

  /**
   * Encrypt sensitive data using AES-256
   */
  static encrypt(data: string, key?: string): string {
    const encryptionKey = key || this.ENCRYPTION_KEY;
    return CryptoJS.AES.encrypt(data, encryptionKey).toString();
  }

  /**
   * Decrypt encrypted data using AES-256
   */
  static decrypt(encryptedData: string, key?: string): string {
    const encryptionKey = key || this.ENCRYPTION_KEY;
    const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Generate a secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);

    if (isNode && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    for (let i = 0; i < length; i++) {
      result += chars.charAt((array[i] ?? 0) % chars.length);
    }

    return result;
  }

  /**
   * Calculate SHA-256 hash
   */
  static async sha256(data: string): Promise<string> {
    if (isNode && typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (isBrowser && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback using CryptoJS
      return CryptoJS.SHA256(data).toString();
    }
  }

  /**
   * Mask PII in text
   */
  static maskPII(text: string, options?: {
    email?: boolean;
    phone?: boolean;
    ssn?: boolean;
    creditCard?: boolean;
  }): string {
    const opts = {
      email: true,
      phone: true,
      ssn: true,
      creditCard: true,
      ...options
    };

    let masked = text;

    if (opts.email) {
      masked = masked.replace(
        /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
        (_match: string, local: string, domain: string) => {
          const maskedLocal = local.length > 2
            ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
            : '*'.repeat(local.length);
          return maskedLocal + '@' + domain;
        }
      );
    }

    if (opts.phone) {
      masked = masked.replace(
        /\b(\+?1[\s-]?)?\(?([0-9]{3})\)?[\s-]?([0-9]{3})[\s-]?([0-9]{4})\b/g,
        (_match: string, prefix: string, _area: string, _prefix3: string, line4: string) => {
          return prefix ? `${prefix}(***)-***-${line4}` : '(***)-***-' + line4;
        }
      );
    }

    if (opts.ssn) {
      masked = masked.replace(
        /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
        '***-**-****'
      );
    }

    if (opts.creditCard) {
      masked = masked.replace(
        /\b(\d{4}[\s-]?){3}\d{4}\b/g,
        (match) => {
          const cleaned = match.replace(/[\s-]/g, '');
          return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
        }
      );
    }

    return masked;
  }
}
