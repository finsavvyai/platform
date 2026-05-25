import { createHash, randomBytes, createHmac } from 'crypto';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import { join } from 'path';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Utility functions shared across all Questro components

export class CryptoUtils {
  static generateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  static generateToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  static generateApiKey(): string {
    const prefix = 'qsk'; // Questro Secret Key
    const key = randomBytes(32).toString('hex');
    return `${prefix}_${key}`;
  }

  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(password + actualSalt)
      .digest('hex');
    return { hash, salt: actualSalt };
  }

  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt);
    return computedHash === hash;
  }

  static hmacSign(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  static hmacVerify(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.hmacSign(data, secret);
    return signature === expectedSignature;
  }

  static encrypt(text: string, key: string): string {
    // Simple XOR encryption for non-sensitive data
    // For production, use proper encryption libraries
    const result = [];
    for (let i = 0; i < text.length; i++) {
      result.push(
        String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        )
      );
    }
    return btoa(result.join(''));
  }

  static decrypt(encryptedText: string, key: string): string {
    const text = atob(encryptedText);
    const result = [];
    for (let i = 0; i < text.length; i++) {
      result.push(
        String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        )
      );
    }
    return result.join('');
  }
}

export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static isValidPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  static sanitizeHtml(html: string): string {
    // Basic HTML sanitization - in production use proper sanitization library
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  static validateJson(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    return phoneRegex.test(phone);
  }
}

export class DateUtils {
  static formatDate(date: Date, format: 'iso' | 'readable' | 'timestamp' = 'iso'): string {
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'readable':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'timestamp':
        return date.getTime().toString();
      default:
        return date.toISOString();
    }
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static diffInSeconds(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime()) / 1000;
  }

  static diffInDays(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
  }

  static isExpired(date: Date, thresholdMs: number = 0): boolean {
    return date.getTime() + thresholdMs < Date.now();
  }

  static getStartOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  static getEndOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  static humanizeDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  }
}

export class FileUtils {
  static getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }

  static getFileNameWithoutExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.slice(0, -1).join('.');
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static isValidImageFile(fileName: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    return imageExtensions.includes(this.getFileExtension(fileName));
  }

  static isValidVideoFile(fileName: string): boolean {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    return videoExtensions.includes(this.getFileExtension(fileName));
  }

  static isValidAudioFile(fileName: string): boolean {
    const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
    return audioExtensions.includes(this.getFileExtension(fileName));
  }

  static joinPaths(...paths: string[]): string {
    return join(...paths);
  }
}

export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static camelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  static kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  static snakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  static slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  }

  static extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    return variables;
  }

  static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  static generateRandomString(length: number, chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export class ArrayUtils {
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  static sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  static flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((acc, val) => {
      return acc.concat(Array.isArray(val) ? this.flatten(val) : val);
    }, []);
  }

  static pick<T, K extends keyof T>(array: T[], keys: K[]): Pick<T, K>[] {
    return array.map(item => {
      const picked = {} as Pick<T, K>;
      for (const key of keys) {
        if (key in item) {
          picked[key] = item[key];
        }
      }
      return picked;
    });
  }

  static omit<T, K extends keyof T>(array: T[], keys: K[]): Omit<T, K>[] {
    return array.map(item => {
      const omitted = { ...item };
      for (const key of keys) {
        delete omitted[key];
      }
      return omitted as Omit<T, K>;
    });
  }
}

export class ObjectUtils {
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const clonedObj = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  }

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

  static isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  static isEmpty(value: any): boolean {
    if (value == null) return true;
    if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  static pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  static omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result as Omit<T, K>;
  }

  static get<T extends Record<string, any>>(obj: T, path: string, defaultValue?: any): any {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result == null || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    return result !== undefined ? result : defaultValue;
  }

  static set<T extends Record<string, any>>(obj: T, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }
}

export class CompressionUtils {
  static async compress(data: string): Promise<Buffer> {
    return await gzipAsync(data);
  }

  static async decompress(buffer: Buffer): Promise<string> {
    return (await gunzipAsync(buffer)).toString();
  }

  static async compressJson(data: any): Promise<Buffer> {
    return await this.compress(JSON.stringify(data));
  }

  static async decompressJson<T>(buffer: Buffer): Promise<T> {
    const decompressed = await this.decompress(buffer);
    return JSON.parse(decompressed);
  }
}

export class RetryUtils {
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
    backoff: number = 2
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await this.sleep(waitTime);
      }
    }

    throw lastError!;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async exponentialBackoff<T>(
    fn: () => Promise<T>,
    maxDelay: number = 30000
  ): Promise<T> {
    let delay = 1000;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        await this.sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }
}

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getResetTime(): Date {
    if (this.requests.length === 0) {
      return new Date();
    }
    const oldestRequest = Math.min(...this.requests);
    return new Date(oldestRequest + this.windowMs);
  }
}

export class EventEmitter {
  private listeners: Record<string, Function[]> = {};

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (!this.listeners[event]) return;
    const index = this.listeners[event].indexOf(listener);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(...args));
  }

  once(event: string, listener: Function): void {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  listenerCount(event: string): number {
    return this.listeners[event]?.length || 0;
  }
}

// Re-export commonly used functions
export const {
  generateId,
  generateToken,
  generateApiKey,
  hashPassword,
  verifyPassword
} = CryptoUtils;

export const {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isValidPassword
} = ValidationUtils;

export const {
  formatDate,
  addDays,
  addHours,
  addMinutes,
  humanizeDuration
} = DateUtils;

export const {
  capitalize,
  camelCase,
  kebabCase,
  snakeCase,
  slugify
} = StringUtils;

export const {
  chunk,
  unique,
  groupBy,
  sortBy
} = ArrayUtils;

export const {
  deepClone,
  deepMerge,
  isEmpty,
  get,
  set
} = ObjectUtils;