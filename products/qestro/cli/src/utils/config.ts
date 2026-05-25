/**
 * Configuration Management for Questro CLI
 * Handles profiles, authentication, and application settings
 */

import { Conf } from 'conf';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { logger } from './logger';

export interface QuestroConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  auth: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    profileId?: string;
    organizationId?: string;
  };
  defaults: {
    project?: string;
    workspace?: string;
    region?: string;
    outputFormat?: 'json' | 'yaml' | 'table';
    pageSize?: number;
  };
  integrations: {
    maestro?: {
      executablePath?: string;
      version?: string;
    };
    playwright?: {
      executablePath?: string;
      browser?: string;
      headless?: boolean;
    };
    slack?: {
      webhookUrl?: string;
      channelId?: string;
    };
    email?: {
      smtp?: {
        host?: string;
        port?: number;
        secure?: boolean;
        auth?: {
          user?: string;
          pass?: string;
        };
      };
    };
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}

class ConfigManager {
  private config: Conf<QuestroConfig>;
  private currentProfile: string = 'default';
  private profiles: Map<string, Conf<QuestroConfig>> = new Map();

  constructor() {
    const configDir = join(homedir(), '.qestro');

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    this.config = new Conf<QuestroConfig>({
      projectName: 'qestro-cli',
      projectVersion: '1.0.0',
      cwd: configDir,
      defaults: {
        api: {
          baseUrl: 'https://api.questro.io',
          timeout: 30000,
          retries: 3,
        },
        auth: {},
        defaults: {
          region: 'us-east-1',
          outputFormat: 'table',
          pageSize: 25,
        },
        integrations: {},
        logging: {
          level: 'info',
        },
      },
    });

    this.loadProfiles();
  }

  private loadProfiles(): void {
    const profiles = this.get('profiles') || {};
    Object.keys(profiles).forEach(profileName => {
      if (profileName !== 'default') {
        const profileConfig = new Conf<QuestroConfig>({
          projectName: 'qestro-cli',
          projectVersion: '1.0.0',
          cwd: join(homedir(), '.qestro', 'profiles', profileName),
          defaults: this.config.store,
        });
        this.profiles.set(profileName, profileConfig);
      }
    });
  }

  get<K extends keyof QuestroConfig>(key: K): QuestroConfig[K] {
    const activeConfig = this.getActiveConfig();
    return activeConfig.get(key);
  }

  set<K extends keyof QuestroConfig>(key: K, value: QuestroConfig[K]): void {
    const activeConfig = this.getActiveConfig();
    activeConfig.set(key, value);
  }

  getActiveConfig(): Conf<QuestroConfig> {
    return this.profiles.get(this.currentProfile) || this.config;
  }

  setProfile(profileName: string): void {
    if (!this.profiles.has(profileName) && profileName !== 'default') {
      // Create new profile
      const profileConfig = new Conf<QuestroConfig>({
        projectName: 'qestro-cli',
        projectVersion: '1.0.0',
        cwd: join(homedir(), '.qestro', 'profiles', profileName),
        defaults: this.config.store,
      });
      this.profiles.set(profileName, profileConfig);

      // Save to main config
      const profiles = this.get('profiles') || {};
      profiles[profileName] = true;
      this.config.set('profiles', profiles);
    }

    this.currentProfile = profileName;
    logger.debug(`Switched to profile: ${profileName}`);
  }

  getCurrentProfile(): string {
    return this.currentProfile;
  }

  listProfiles(): string[] {
    const profiles = this.get('profiles') || {};
    return ['default', ...Object.keys(profiles)];
  }

  deleteProfile(profileName: string): void {
    if (profileName === 'default') {
      throw new Error('Cannot delete the default profile');
    }

    if (this.profiles.has(profileName)) {
      const profileConfig = this.profiles.get(profileName)!;
      profileConfig.clear();
      this.profiles.delete(profileName);

      // Remove from main config
      const profiles = this.get('profiles') || {};
      delete profiles[profileName];
      this.config.set('profiles', profiles);

      logger.info(`Profile '${profileName}' deleted successfully`);
    } else {
      throw new Error(`Profile '${profileName}' not found`);
    }
  }

  setRegion(region: string): void {
    this.set('defaults.region', region);
  }

  setOutputFormat(format: 'json' | 'yaml' | 'table'): void {
    this.set('defaults.outputFormat', format);
  }

  isAuthenticated(): boolean {
    const auth = this.get('auth');
    return !!(auth.accessToken && auth.tokenExpiry && auth.tokenExpiry > Date.now());
  }

  getAuthHeaders(): Record<string, string> {
    const auth = this.get('auth');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth.accessToken) {
      headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }

    return headers;
  }

  setAuthToken(token: string, refreshToken?: string, expiresIn?: number): void {
    const auth = {
      accessToken: token,
      refreshToken,
      tokenExpiry: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
    this.set('auth', auth);
  }

  clearAuth(): void {
    this.set('auth', {});
  }

  getApiUrl(): string {
    return this.get('api.baseUrl');
  }

  getTimeout(): number {
    return this.get('api.timeout');
  }

  getRetries(): number {
    return this.get('api.retries');
  }

  // Integration-specific getters
  getMaestroConfig() {
    return this.get('integrations.maestro') || {};
  }

  getPlaywrightConfig() {
    return this.get('integrations.playwright') || {};
  }

  getSlackConfig() {
    return this.get('integrations.slack') || {};
  }

  // Configuration validation
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const apiConfig = this.get('api');
      if (!apiConfig.baseUrl) {
        errors.push('API base URL is required');
      }

      const defaults = this.get('defaults');
      if (!defaults.region) {
        errors.push('Default region is required');
      }

      if (!['json', 'yaml', 'table'].includes(defaults.outputFormat || '')) {
        errors.push('Output format must be json, yaml, or table');
      }
    } catch (error) {
      errors.push(`Configuration error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Reset configuration
  reset(): void {
    this.config.clear();
    this.profiles.forEach(profile => profile.clear());
    this.profiles.clear();
    this.currentProfile = 'default';
    logger.info('Configuration reset to defaults');
  }

  // Export configuration
  export(includeAuth: boolean = false): Partial<QuestroConfig> {
    const config = { ...this.getActiveConfig().store };

    if (!includeAuth) {
      delete config.auth;
    }

    return config;
  }

  // Import configuration
  import(configData: Partial<QuestroConfig>, merge: boolean = false): void {
    if (merge) {
      const current = this.getActiveConfig().store;
      this.getActiveConfig().store = { ...current, ...configData };
    } else {
      this.getActiveConfig().store = configData;
    }

    logger.info('Configuration imported successfully');
  }
}

export const config = new ConfigManager();
export { QuestroConfig };