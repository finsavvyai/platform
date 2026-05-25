// Storage utilities for the SDLC.ai JavaScript SDK

import { isBrowser } from './environment';
import { SecurityUtils } from './security';

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
  static setSecureItem(key: string, value: unknown, encrypt: boolean = true): void {
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
  static getSecureItem<T = unknown>(key: string): T | null {
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
