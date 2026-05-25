// Utility functions for the SDLC.ai JavaScript SDK

import { CryptoJS } from 'crypto-js';

// Environment detection
export const isNode = typeof process !== 'undefined' && process.versions?.node;
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export const isWebWorker = typeof self !== 'undefined' && typeof window === 'undefined';

// Security utilities
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
      result += chars.charAt(array[i] % chars.length);
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
      // Mask email addresses
      masked = masked.replace(
        /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
        (match, local, domain) => {
          const maskedLocal = local.length > 2
            ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
            : '*'.repeat(local.length);
          return maskedLocal + '@' + domain;
        }
      );
    }

    if (opts.phone) {
      // Mask phone numbers
      masked = masked.replace(
        /\b(\+?1[\s-]?)?\(?([0-9]{3})\)?[\s-]?([0-9]{3})[\s-]?([0-9]{4})\b/g,
        (match, prefix, area, prefix3, line4) => {
          return prefix ? `${prefix}(***)-***-${line4}` : '(***)-***-' + line4;
        }
      );
    }

    if (opts.ssn) {
      // Mask SSNs
      masked = masked.replace(
        /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
        '***-**-****'
      );
    }

    if (opts.creditCard) {
      // Mask credit card numbers
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

// Validation utilities
export class ValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate strong password
   */
  static isStrongPassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  static sanitizeHTML(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}

// Storage utilities
export class StorageUtils {
  /**
   * Get secure storage based on environment
   */
  private static getStorage(): Storage | null {
    if (isBrowser) {
      return window.localStorage;
    }
    return null;
  }

  /**
   * Store data securely with encryption
   */
  static setSecureItem(key: string, value: any, encrypt: boolean = true): void {
    const storage = this.getStorage();
    if (!storage) return;

    const data = {
      value,
      timestamp: Date.now(),
      encrypted: encrypt
    };

    const serialized = encrypt
      ? SecurityUtils.encrypt(JSON.stringify(data))
      : JSON.stringify(data);

    storage.setItem(`sdlc:${key}`, serialized);
  }

  /**
   * Retrieve and decrypt stored data
   */
  static getSecureItem<T = any>(key: string): T | null {
    const storage = this.getStorage();
    if (!storage) return null;

    const item = storage.getItem(`sdlc:${key}`);
    if (!item) return null;

    try {
      // Try to decrypt first
      let decrypted: string;
      try {
        decrypted = SecurityUtils.decrypt(item);
      } catch {
        // If decryption fails, assume it's not encrypted
        decrypted = item;
      }

      const data = JSON.parse(decrypted);
      return data.value;
    } catch {
      return null;
    }
  }

  /**
   * Remove stored item
   */
  static removeSecureItem(key: string): void {
    const storage = this.getStorage();
    if (!storage) return;

    storage.removeItem(`sdlc:${key}`);
  }

  /**
   * Clear all SDLC items
   */
  static clearSecureItems(): void {
    const storage = this.getStorage();
    if (!storage) return;

    const keys = Object.keys(storage);
    keys.forEach(key => {
      if (key.startsWith('sdlc:')) {
        storage.removeItem(key);
      }
    });
  }
}

// Network utilities
export class NetworkUtils {
  /**
   * Exponential backoff for retries
   */
  static async backoff(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    jitter: boolean = true
  ): Promise<void> {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;

    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Parse retry-after header
   */
  static parseRetryAfter(header?: string): number | null {
    if (!header) return null;

    // Try to parse as integer (seconds)
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try to parse as HTTP date
    const date = new Date(header);
    if (!isNaN(date.getTime())) {
      return date.getTime() - Date.now();
    }

    return null;
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: any): boolean {
    // Network errors are generally retryable
    if (error.code === 'ECONNRESET' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Get public IP address
   */
  static async getPublicIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }
}

// Date utilities
export class DateUtils {
  /**
   * Format date as ISO string with timezone
   */
  static toISOString(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Parse date from various formats
   */
  static parse(date: string | number | Date): Date {
    if (date instanceof Date) return date;
    if (typeof date === 'number') return new Date(date);

    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    return parsed;
  }

  /**
   * Add time to date
   */
  static add(date: Date, amount: number, unit: 'ms' | 's' | 'm' | 'h' | 'd'): Date {
    const result = new Date(date);

    switch (unit) {
      case 'ms':
        result.setMilliseconds(result.getMilliseconds() + amount);
        break;
      case 's':
        result.setSeconds(result.getSeconds() + amount);
        break;
      case 'm':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'h':
        result.setHours(result.getHours() + amount);
        break;
      case 'd':
        result.setDate(result.getDate() + amount);
        break;
    }

    return result;
  }

  /**
   * Check if date is expired
   */
  static isExpired(date: Date | string | number, bufferMs: number = 0): boolean {
    const expiry = this.parse(date);
    return Date.now() >= expiry.getTime() - bufferMs;
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Token utilities
export class TokenUtils {
  /**
   * Parse JWT token (without verification)
   */
  static parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string, bufferSeconds: number = 30): boolean {
    try {
      const payload = this.parseJWT(token);
      return payload.exp <= Date.now() / 1000 + bufferSeconds;
    } catch {
      return true;
    }
  }

  /**
   * Get time until token expires
   */
  static getTokenTTL(token: string): number {
    try {
      const payload = this.parseJWT(token);
      return Math.max(0, payload.exp * 1000 - Date.now());
    } catch {
      return 0;
    }
  }
}

// Object utilities
export class ObjectUtils {
  /**
   * Deep merge objects
   */
  static deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if value is an object
   */
  static isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Deep clone object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const clonedObj = {} as { [key: string]: any };
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj as T;
    }
    return obj;
  }

  /**
   * Omit keys from object
   */
  static omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
  }

  /**
   * Pick keys from object
   */
  static pick<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }
}

// String utilities
export class StringUtils {
  /**
   * Generate slug from string
   */
  static slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Truncate string with ellipsis
   */
  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  }

  /**
   * Capitalize first letter
   */
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Generate unique ID
   */
  static uniqueId(prefix: string = ''): string {
    return prefix + Math.random().toString(36).substr(2, 9);
  }
}

// Export all utilities
export {
  SecurityUtils as Security,
  ValidationUtils as Validation,
  StorageUtils as Storage,
  NetworkUtils as Network,
  DateUtils as Date,
  TokenUtils as Token,
  ObjectUtils as Object,
  StringUtils as String
};
