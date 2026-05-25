import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

interface CacheEntry {
  key: string;
  data: any;
  timestamp: string;
  expiry?: string;
  size: number;
  metadata?: any;
}

interface CacheConfig {
  maxSize: number; // MB
  maxAge: number; // milliseconds
  cleanupInterval: number; // milliseconds
  compressionEnabled: boolean;
}

interface CacheStats {
  totalSize: number;
  entryCount: number;
  hitCount: number;
  missCount: number;
  oldestEntry?: string;
  newestEntry?: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 20, // 20MB
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  compressionEnabled: true,
};

export class CacheService {
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalSize: 0,
      entryCount: 0,
      hitCount: 0,
      missCount: 0,
    };
    this.initialize();
  }

  private initialize = async () => {
    // Load existing stats
    await this.loadStats();

    // Start periodic cleanup
    this.startCleanupInterval();
  };

  private startCleanupInterval = () => {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.config.cleanupInterval);
  };

  public set = async (
    key: string,
    data: any,
    maxAge?: number,
    metadata?: any
  ): Promise<void> => {
    try {
      const serializedData = JSON.stringify(data);
      const dataSize = new Blob([serializedData]).size;

      const entry: CacheEntry = {
        key,
        data,
        timestamp: new Date().toISOString(),
        expiry: maxAge
          ? new Date(Date.now() + maxAge).toISOString()
          : undefined,
        size: dataSize,
        metadata,
      };

      // Check if we need to make space
      await this.ensureSpace(dataSize);

      // Store the entry
      await this.storeEntry(entry);

      // Update stats
      this.updateStats(key, 'set', dataSize);

    } catch (error) {
      console.error('Failed to cache data:', error);
      throw error;
    }
  };

  public get = async <T = any>(key: string): Promise<T | null> => {
    try {
      const entry = await this.getEntry(key);

      if (!entry) {
        this.stats.missCount++;
        await this.saveStats();
        return null;
      }

      // Check if entry has expired
      if (entry.expiry && new Date(entry.expiry) < new Date()) {
        await this.delete(key);
        this.stats.missCount++;
        await this.saveStats();
        return null;
      }

      this.stats.hitCount++;
      await this.saveStats();

      return entry.data as T;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      this.stats.missCount++;
      await this.saveStats();
      return null;
    }
  };

  public getWithMetadata = async <T = any>(key: string): Promise<{ data: T; metadata?: any } | null> => {
    try {
      const entry = await this.getEntry(key);

      if (!entry) {
        this.stats.missCount++;
        await this.saveStats();
        return null;
      }

      // Check if entry has expired
      if (entry.expiry && new Date(entry.expiry) < new Date()) {
        await this.delete(key);
        this.stats.missCount++;
        await this.saveStats();
        return null;
      }

      this.stats.hitCount++;
      await this.saveStats();

      return {
        data: entry.data as T,
        metadata: entry.metadata,
      };
    } catch (error) {
      console.error('Failed to get cached data with metadata:', error);
      this.stats.missCount++;
      await this.saveStats();
      return null;
    }
  };

  public delete = async (key: string): Promise<void> => {
    try {
      const entry = await this.getEntry(key);
      await AsyncStorage.removeItem(`cache_${key}`);

      if (entry) {
        this.updateStats(key, 'delete', -entry.size);
      }
    } catch (error) {
      console.error('Failed to delete cached data:', error);
    }
  };

  public clear = async (): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);

      // Reset stats
      this.stats = {
        totalSize: 0,
        entryCount: 0,
        hitCount: 0,
        missCount: 0,
      };
      await this.saveStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  public getKeys = async (): Promise<string[]> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      return cacheKeys.map(key => key.replace('cache_', ''));
    } catch (error) {
      console.error('Failed to get cache keys:', error);
      return [];
    }
  };

  public getStats = async (): Promise<CacheStats> => {
    // Recalculate actual stats to ensure accuracy
    await this.recalculateStats();
    return { ...this.stats };
  };

  private storeEntry = async (entry: CacheEntry): Promise<void> => {
    const key = `cache_${entry.key}`;
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  };

  private getEntry = async (key: string): Promise<CacheEntry | null> => {
    try {
      const data = await AsyncStorage.getItem(`cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get cache entry:', error);
      return null;
    }
  };

  private ensureSpace = async (requiredSize: number): Promise<void> => {
    const currentSize = this.stats.totalSize;
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;

    if (currentSize + requiredSize <= maxSizeBytes) {
      return; // Enough space available
    }

    // Need to make space - remove oldest entries first
    const entries = await this.getAllEntries();
    entries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let freedSpace = 0;
    for (const entry of entries) {
      await this.delete(entry.key);
      freedSpace += entry.size;

      if (currentSize - freedSpace + requiredSize <= maxSizeBytes) {
        break;
      }
    }
  };

  private getAllEntries = async (): Promise<CacheEntry[]> => {
    try {
      const keys = await this.getKeys();
      const entries: CacheEntry[] = [];

      for (const key of keys) {
        const entry = await this.getEntry(key);
        if (entry) {
          entries.push(entry);
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to get all entries:', error);
      return [];
    }
  };

  private cleanup = async (): Promise<void> => {
    try {
      const entries = await this.getAllEntries();
      const now = new Date();
      let removedCount = 0;

      for (const entry of entries) {
        // Remove expired entries
        if (entry.expiry && new Date(entry.expiry) < now) {
          await this.delete(entry.key);
          removedCount++;
        }
      }

      // If no expired entries, check max age
      if (removedCount === 0) {
        const maxAgeTimestamp = new Date(now.getTime() - this.config.maxAge);

        for (const entry of entries) {
          if (new Date(entry.timestamp) < maxAgeTimestamp) {
            await this.delete(entry.key);
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        console.log(`Cache cleanup: removed ${removedCount} expired entries`);
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  };

  private updateStats = (key: string, operation: 'set' | 'delete', sizeChange: number): void => {
    switch (operation) {
      case 'set':
        // Check if this is updating an existing entry
        if (this.stats.totalSize > 0) {
          this.stats.totalSize += sizeChange;
        } else {
          this.stats.totalSize = sizeChange;
          this.stats.entryCount = 1;
        }
        break;
      case 'delete':
        this.stats.totalSize = Math.max(0, this.stats.totalSize + sizeChange);
        this.stats.entryCount = Math.max(0, this.stats.entryCount - 1);
        break;
    }
    this.saveStats();
  };

  private recalculateStats = async (): Promise<void> => {
    try {
      const entries = await this.getAllEntries();

      this.stats = {
        totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
        entryCount: entries.length,
        hitCount: this.stats.hitCount, // Preserve hit/miss counts
        missCount: this.stats.missCount,
        oldestEntry: entries.length > 0
          ? entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0].timestamp
          : undefined,
        newestEntry: entries.length > 0
          ? entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
          : undefined,
      };

      await this.saveStats();
    } catch (error) {
      console.error('Failed to recalculate stats:', error);
    }
  };

  private loadStats = async (): Promise<void> => {
    try {
      const statsData = await AsyncStorage.getItem('cache_stats');
      if (statsData) {
        this.stats = JSON.parse(statsData);
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  private saveStats = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem('cache_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('Failed to save cache stats:', error);
    }
  };

  public cleanup = (): void => {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  };
}

// Global cache service instance
export const cacheService = new CacheService();