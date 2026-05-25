import Store from 'electron-store';
import { EventEmitter } from 'events';

export interface AppSettings {
  // General
  autoStart: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  checkForUpdates: boolean;

  // Appearance
  theme: 'dark' | 'light' | 'auto';
  language: string;
  fontSize: 'small' | 'medium' | 'large';

  // Editor
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  enableSyntaxHighlighting: boolean;
  autoSaveQueries: boolean;

  // Database
  defaultConnectionTimeout: number;
  maxQueryExecutionTime: number;
  autoReconnect: boolean;
  connectionPoolSize: number;

  // Notifications
  enableNotifications: boolean;
  enableSoundNotifications: boolean;
  notifyOnQueryComplete: boolean;
  notifyOnConnectionError: boolean;

  // Security
  sessionTimeout: number;
  requirePasswordOnStart: boolean;
  encryptStoredCredentials: boolean;

  // Advanced
  enableDebugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxLogFiles: number;
  enableTelemetry: boolean;

  // Backend
  backendUrl: string;
  enableRealTimeUpdates: boolean;
  metricsUpdateInterval: number;

  // Window
  rememberWindowSize: boolean;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized?: boolean;
  };
}

export interface DefaultSettings extends AppSettings {}

export class SettingsManager extends EventEmitter {
  private store: Store<AppSettings>;
  private defaults: DefaultSettings;

  constructor() {
    super();

    this.defaults = {
      // General
      autoStart: false,
      minimizeToTray: true,
      startMinimized: false,
      checkForUpdates: true,

      // Appearance
      theme: 'auto',
      language: 'en',
      fontSize: 'medium',

      // Editor
      tabSize: 4,
      wordWrap: true,
      showLineNumbers: true,
      enableSyntaxHighlighting: true,
      autoSaveQueries: true,

      // Database
      defaultConnectionTimeout: 30,
      maxQueryExecutionTime: 300,
      autoReconnect: true,
      connectionPoolSize: 5,

      // Notifications
      enableNotifications: true,
      enableSoundNotifications: false,
      notifyOnQueryComplete: true,
      notifyOnConnectionError: true,

      // Security
      sessionTimeout: 3600, // 1 hour
      requirePasswordOnStart: false,
      encryptStoredCredentials: true,

      // Advanced
      enableDebugMode: false,
      logLevel: 'info',
      maxLogFiles: 10,
      enableTelemetry: true,

      // Backend
      backendUrl: process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080'
        : 'https://api.queryflux.com',
      enableRealTimeUpdates: true,
      metricsUpdateInterval: 5000, // 5 seconds

      // Window
      rememberWindowSize: true,
      windowBounds: {
        width: 1400,
        height: 900,
        maximized: false,
      },
    };

    this.store = new Store<AppSettings>({
      defaults: this.defaults,
      name: 'queryflux-settings',
      fileExtension: 'json',
      encryptionKey: 'queryflux-settings-key',
      clearInvalidConfig: true,
    });

    this.migrateSettings();
  }

  private migrateSettings(): void {
    const currentVersion = this.get('appVersion');
    const appVersion = process.env.npm_package_version || '1.0.0';

    if (currentVersion !== appVersion) {
      // Perform settings migration for new version
      this.performMigration(currentVersion, appVersion);
      this.set('appVersion', appVersion);
    }
  }

  private performMigration(fromVersion: string | undefined, toVersion: string): void {
    console.log(`Migrating settings from ${fromVersion || 'unknown'} to ${toVersion}`);

    // Example migrations
    if (!fromVersion || this.compareVersions(fromVersion, '1.1.0') < 0) {
      // Migrate settings for version 1.1.0
      this.migrateTo1_1_0();
    }

    if (this.compareVersions(fromVersion || '0.0.0', '1.2.0') < 0) {
      // Migrate settings for version 1.2.0
      this.migrateTo1_2_0();
    }
  }

  private migrateTo1_1_0(): void {
    // Add new settings introduced in 1.1.0
    if (this.store.get('enableTelemetry') === undefined) {
      this.set('enableTelemetry', this.defaults.enableTelemetry);
    }
  }

  private migrateTo1_2_0(): void {
    // Add new settings introduced in 1.2.0
    if (this.store.get('metricsUpdateInterval') === undefined) {
      this.set('metricsUpdateInterval', this.defaults.metricsUpdateInterval);
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }

    return 0;
  }

  // Public API methods

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const oldValue = this.get(key);
    this.store.set(key, value);

    this.emit('setting:changed', { key, value, oldValue });
    this.emit(`setting:changed:${key}`, { value, oldValue });
  }

  getAll(): AppSettings {
    return this.store.store;
  }

  reset(): void {
    this.store.clear();
    this.emit('settings:reset');
  }

  resetKey<K extends keyof AppSettings>(key: K): void {
    this.store.delete(key);
    this.emit('setting:reset', { key });
    this.emit(`setting:reset:${key}`, { key });
  }

  // Validation methods

  validateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): { valid: boolean; error?: string } {
    switch (key) {
      case 'fontSize':
        if (!['small', 'medium', 'large'].includes(value as any)) {
          return { valid: false, error: 'Font size must be small, medium, or large' };
        }
        break;

      case 'language':
        if (typeof value !== 'string' || value.length !== 2) {
          return { valid: false, error: 'Language must be a valid 2-letter code' };
        }
        break;

      case 'tabSize':
        if (typeof value !== 'number' || value < 1 || value > 16) {
          return { valid: false, error: 'Tab size must be between 1 and 16' };
        }
        break;

      case 'defaultConnectionTimeout':
      case 'maxQueryExecutionTime':
      case 'sessionTimeout':
      case 'metricsUpdateInterval':
        if (typeof value !== 'number' || value < 1) {
          return { valid: false, error: 'Time values must be positive numbers' };
        }
        break;

      case 'connectionPoolSize':
        if (typeof value !== 'number' || value < 1 || value > 50) {
          return { valid: false, error: 'Connection pool size must be between 1 and 50' };
        }
        break;

      case 'maxLogFiles':
        if (typeof value !== 'number' || value < 1 || value > 100) {
          return { valid: false, error: 'Max log files must be between 1 and 100' };
        }
        break;

      case 'backendUrl':
        try {
          new URL(value as any);
        } catch {
          return { valid: false, error: 'Backend URL must be a valid URL' };
        }
        break;

      case 'windowBounds':
        if (!value || typeof value !== 'object') {
          return { valid: false, error: 'Window bounds must be an object' };
        }
        if ((value as any).width < 800 || (value as any).height < 600) {
          return { valid: false, error: 'Window dimensions must be at least 800x600' };
        }
        break;
    }

    return { valid: true };
  }

  setWithValidation<K extends keyof AppSettings>(key: K, value: AppSettings[K]): { success: boolean; error?: string } {
    const validation = this.validateSetting(key, value);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    this.set(key, value);
    return { success: true };
  }

  // Import/Export

  exportSettings(): string {
    const settings = this.getAll();
    const exportData = {
      version: process.env.npm_package_version || '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
    };

    return JSON.stringify(exportData, null, 2);
  }

  importSettings(settingsJson: string): { success: boolean; error?: string } {
    try {
      const importData = JSON.parse(settingsJson);

      if (!importData.settings || typeof importData.settings !== 'object') {
        return { success: false, error: 'Invalid settings file format' };
      }

      // Validate each setting before importing
      for (const [key, value] of Object.entries(importData.settings)) {
        const validation = this.validateSetting(key as keyof AppSettings, value as any);
        if (!validation.valid) {
          return { success: false, error: `Invalid setting ${key}: ${validation.error}` };
        }
      }

      // Apply settings
      for (const [key, value] of Object.entries(importData.settings)) {
        this.set(key as keyof AppSettings, value);
      }

      this.emit('settings:imported', { version: importData.version });
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to import settings: ${error}` };
    }
  }

  // Utility methods

  isDarkTheme(): boolean {
    const theme = this.get('theme');
    if (theme === 'dark') return true;
    if (theme === 'light') return false;

    // Auto mode - check system preference
    return require('electron').nativeTheme.shouldUseDarkColors;
  }

  getEffectiveLanguage(): string {
    const appLanguage = this.get('language');
    const systemLocale = require('electron').app.getLocale();

    // Use app language if set, otherwise fallback to system locale
    return appLanguage === 'en' ? systemLocale : appLanguage;
  }

  // Performance settings

  getPerformanceSettings(): {
    maxConcurrentQueries: number;
    cacheSize: number;
    enableCompression: boolean;
  } {
    return {
      maxConcurrentQueries: Math.min(this.get('connectionPoolSize'), 10),
      cacheSize: this.get('enableDebugMode') ? 100 : 50,
      enableCompression: !this.get('enableDebugMode'),
    };
  }

  // Security settings

  getSecuritySettings(): {
    sessionTimeout: number;
    requirePasswordOnStart: boolean;
    encryptStoredCredentials: boolean;
  } {
    return {
      sessionTimeout: this.get('sessionTimeout'),
      requirePasswordOnStart: this.get('requirePasswordOnStart'),
      encryptStoredCredentials: this.get('encryptStoredCredentials'),
    };
  }

  // Cleanup

  destroy(): void {
    this.removeAllListeners();
  }
}