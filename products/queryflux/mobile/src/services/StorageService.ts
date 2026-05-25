/**
 * Storage service for managing local data persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';

class StorageServiceClass {
  // Regular AsyncStorage methods
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to store item ${key}:`, error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  // JSON storage methods
  async setObject(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Failed to store object ${key}:`, error);
      throw error;
    }
  }

  async getObject<T = any>(key: string): Promise<T | null> {
    try {
      const jsonValue = await this.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Failed to get object ${key}:`, error);
      return null;
    }
  }

  // Secure storage methods using Keychain
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials(key, key, value);
    } catch (error) {
      console.error(`Failed to store secure item ${key}:`, error);
      throw error;
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(key);
      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get secure item ${key}:`, error);
      return null;
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(key);
    } catch (error) {
      console.error(`Failed to remove secure item ${key}:`, error);
      throw error;
    }
  }

  // Batch operations
  async setMultiple(keyValuePairs: Array<[string, string]>): Promise<void> {
    try {
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error) {
      console.error('Failed to set multiple items:', error);
      throw error;
    }
  }

  async getMultiple(keys: string[]): Promise<Array<[string, string | null]>> {
    try {
      return await AsyncStorage.multiGet(keys);
    } catch (error) {
      console.error('Failed to get multiple items:', error);
      throw error;
    }
  }

  async removeMultiple(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Failed to remove multiple items:', error);
      throw error;
    }
  }

  // Utility methods
  async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }

  async getStorageSize(): Promise<number> {
    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await this.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  // Cache management
  async setCacheItem(key: string, value: any, expirationMinutes: number = 60): Promise<void> {
    const cacheData = {
      value,
      expiration: Date.now() + (expirationMinutes * 60 * 1000),
    };

    await this.setObject(`cache_${key}`, cacheData);
  }

  async getCacheItem<T = any>(key: string): Promise<T | null> {
    try {
      const cacheData = await this.getObject<{value: T; expiration: number}>(`cache_${key}`);
      
      if (!cacheData) {
        return null;
      }

      if (Date.now() > cacheData.expiration) {
        // Cache expired, remove it
        await this.removeItem(`cache_${key}`);
        return null;
      }

      return cacheData.value;
    } catch (error) {
      console.error(`Failed to get cache item ${key}:`, error);
      return null;
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));

      for (const key of cacheKeys) {
        const cacheData = await this.getObject<{expiration: number}>(key);
        if (cacheData && Date.now() > cacheData.expiration) {
          await this.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }

  // Settings management
  async setSetting(key: string, value: any): Promise<void> {
    await this.setObject(`setting_${key}`, value);
  }

  async getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
    const value = await this.getObject<T>(`setting_${key}`);
    return value !== null ? value : (defaultValue as T);
  }

  async removeSetting(key: string): Promise<void> {
    await this.removeItem(`setting_${key}`);
  }

  // Connection profiles management
  async saveConnectionProfile(profile: any): Promise<void> {
    const profiles = await this.getConnectionProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);

    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }

    await this.setObject('connection_profiles', profiles);
  }

  async getConnectionProfiles(): Promise<any[]> {
    return (await this.getObject('connection_profiles')) || [];
  }

  async removeConnectionProfile(profileId: string): Promise<void> {
    const profiles = await this.getConnectionProfiles();
    const filteredProfiles = profiles.filter(p => p.id !== profileId);
    await this.setObject('connection_profiles', filteredProfiles);
  }
}

export const StorageService = new StorageServiceClass();