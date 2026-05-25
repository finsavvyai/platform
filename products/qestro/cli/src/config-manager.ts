/**
 * Advanced Configuration Manager
 * Handles profiles, settings, and configuration persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface QuestroConfigProfile {
  name: string;
  api?: {
    baseUrl?: string;
    timeout?: number;
    retries?: number;
  };
  auth?: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    profileId?: string;
    organizationId?: string;
  };
  defaults?: {
    region?: string;
    outputFormat?: 'json' | 'yaml' | 'table';
    pageSize?: number;
    timeout?: number;
  };
  features?: {
    analytics?: boolean;
    crashReporting?: boolean;
    autoUpdate?: boolean;
    experimental?: boolean;
  };
  integrations?: {
    slack?: {
      webhookUrl?: string;
      channel?: string;
    };
    email?: {
      smtp?: string;
      from?: string;
    };
    github?: {
      token?: string;
      defaultRepo?: string;
    };
  };
}

export interface QuestroGlobalConfig {
  version: string;
  currentProfile: string;
  profiles: Record<string, QuestroConfigProfile>;
  global: {
    analyticsId?: string;
    autoCheckUpdates?: boolean;
    lastUpdateCheck?: number;
    telemetry?: boolean;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: QuestroGlobalConfig;
  private readonly CONFIG_VERSION = '1.0.0';

  constructor() {
    this.configPath = path.join(os.homedir(), '.qestro', 'config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): QuestroGlobalConfig {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not load config: ${error.message}`));
    }

    // Return default config
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): QuestroGlobalConfig {
    return {
      version: this.CONFIG_VERSION,
      currentProfile: 'default',
      profiles: {
        default: {
          name: 'default',
          api: {
            baseUrl: 'https://api.qestro.io',
            timeout: 30000,
            retries: 3,
          },
          defaults: {
            region: 'us-east-1',
            outputFormat: 'table',
            pageSize: 20,
            timeout: 30000,
          },
          features: {
            analytics: true,
            crashReporting: true,
            autoUpdate: true,
            experimental: false,
          },
        },
      },
      global: {
        autoCheckUpdates: true,
        telemetry: true,
      },
    };
  }

  private saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get current profile configuration
   */
  getCurrentProfile(): QuestroConfigProfile {
    return this.config.profiles[this.config.currentProfile] || this.config.profiles.default;
  }

  /**
   * Get all profiles
   */
  getProfiles(): Record<string, QuestroConfigProfile> {
    return this.config.profiles;
  }

  /**
   * Switch to a different profile
   */
  switchProfile(profileName: string): void {
    if (!this.config.profiles[profileName]) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    this.config.currentProfile = profileName;
    this.saveConfig();

    console.log(chalk.green(`✅ Switched to profile: ${profileName}`));
  }

  /**
   * Create a new profile
   */
  createProfile(profileName: string, baseProfile?: string): void {
    if (this.config.profiles[profileName]) {
      throw new Error(`Profile "${profileName}" already exists`);
    }

    const base = baseProfile ? this.config.profiles[baseProfile] : this.config.profiles.default;
    const newProfile: QuestroConfigProfile = {
      ...base,
      name: profileName,
    };

    this.config.profiles[profileName] = newProfile;
    this.saveConfig();

    console.log(chalk.green(`✅ Created profile: ${profileName}`));
    if (baseProfile) {
      console.log(chalk.cyan(`  Based on: ${baseProfile}`));
    }
  }

  /**
   * Delete a profile
   */
  deleteProfile(profileName: string): void {
    if (profileName === 'default') {
      throw new Error('Cannot delete the default profile');
    }

    if (!this.config.profiles[profileName]) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    if (this.config.currentProfile === profileName) {
      this.config.currentProfile = 'default';
    }

    delete this.config.profiles[profileName];
    this.saveConfig();

    console.log(chalk.green(`✅ Deleted profile: ${profileName}`));
    if (this.config.currentProfile === 'default') {
      console.log(chalk.yellow('  Switched to default profile'));
    }
  }

  /**
   * Set configuration value in current profile
   */
  set(key: string, value: any): void {
    const profile = this.getCurrentProfile();
    this.setNestedValue(profile, key, value);
    this.saveConfig();

    console.log(chalk.green(`✅ Set ${key} = ${JSON.stringify(value)}`));
  }

  /**
   * Get configuration value from current profile
   */
  get(key: string): any {
    const profile = this.getCurrentProfile();
    return this.getNestedValue(profile, key);
  }

  /**
   * Set global configuration value
   */
  setGlobal(key: string, value: any): void {
    this.setNestedValue(this.config.global, key, value);
    this.saveConfig();

    console.log(chalk.green(`✅ Set global ${key} = ${JSON.stringify(value)}`));
  }

  /**
   * Get global configuration value
   */
  getGlobal(key: string): any {
    return this.getNestedValue(this.config.global, key);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
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

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Display current configuration
   */
  showConfig(): void {
    const currentProfile = this.getCurrentProfile();
    console.log(chalk.blue.bold('📋 Current Configuration'));
    console.log('==========================');

    console.log(chalk.green(`Current Profile: ${chalk.bold(this.config.currentProfile)}`));
    console.log();

    this.displayProfile(currentProfile);

    console.log();
    console.log(chalk.yellow('Global Settings:'));
    console.log(chalk.gray(`  Auto-check updates: ${this.config.global.autoCheckUpdates ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`  Telemetry: ${this.config.global.telemetry ? 'enabled' : 'disabled'}`));
  }

  /**
   * Display all profiles
   */
  listProfiles(): void {
    console.log(chalk.blue.bold('📋 Configuration Profiles'));
    console.log('=============================');

    for (const [name, profile] of Object.entries(this.config.profiles)) {
      const isCurrent = name === this.config.currentProfile;
      const marker = isCurrent ? chalk.green('→') : ' ';

      console.log(`${marker} ${chalk.bold(name)} ${isCurrent ? chalk.green('(current)') : ''}`);

      if (profile.api?.baseUrl) {
        console.log(chalk.gray(`   API: ${profile.api.baseUrl}`));
      }

      if (profile.defaults?.region) {
        console.log(chalk.gray(`   Region: ${profile.defaults.region}`));
      }

      console.log();
    }
  }

  private displayProfile(profile: QuestroConfigProfile): void {
    if (profile.api) {
      console.log(chalk.yellow('API Configuration:'));
      console.log(chalk.gray(`  Base URL: ${profile.api.baseUrl}`));
      console.log(chalk.gray(`  Timeout: ${profile.api.timeout}ms`));
      console.log(chalk.gray(`  Retries: ${profile.api.retries}`));
      console.log();
    }

    if (profile.auth?.accessToken) {
      console.log(chalk.yellow('Authentication:'));
      console.log(chalk.gray(`  Token: ${'*'.repeat(20)}${profile.auth.accessToken.slice(-10)}`));
      if (profile.auth.tokenExpiry) {
        const expiry = new Date(profile.auth.tokenExpiry);
        console.log(chalk.gray(`  Expires: ${expiry.toISOString()}`));
      }
      console.log();
    }

    if (profile.defaults) {
      console.log(chalk.yellow('Defaults:'));
      console.log(chalk.gray(`  Region: ${profile.defaults.region}`));
      console.log(chalk.gray(`  Output Format: ${profile.defaults.outputFormat}`));
      console.log(chalk.gray(`  Page Size: ${profile.defaults.pageSize}`));
      console.log();
    }

    if (profile.features) {
      console.log(chalk.yellow('Features:'));
      console.log(chalk.gray(`  Analytics: ${profile.features.analytics ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`  Crash Reporting: ${profile.features.crashReporting ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`  Auto Update: ${profile.features.autoUpdate ? 'enabled' : 'disabled'}`));
      console.log(chalk.gray(`  Experimental: ${profile.features.experimental ? 'enabled' : 'disabled'}`));
      console.log();
    }
  }

  /**
   * Validate current configuration
   */
  validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const profile = this.getCurrentProfile();

    // Validate API configuration
    if (!profile.api?.baseUrl) {
      errors.push('API base URL is required');
    } else {
      try {
        new URL(profile.api.baseUrl);
      } catch {
        errors.push('API base URL is not a valid URL');
      }
    }

    // Validate authentication
    if (profile.auth?.accessToken && !profile.auth.tokenExpiry) {
      warnings.push('Access token has no expiry date');
    }

    if (profile.auth?.tokenExpiry && Date.now() > profile.auth.tokenExpiry) {
      warnings.push('Access token has expired');
    }

    // Validate defaults
    const validFormats = ['json', 'yaml', 'table'];
    if (profile.defaults?.outputFormat && !validFormats.includes(profile.defaults.outputFormat)) {
      errors.push(`Invalid output format: ${profile.defaults.outputFormat}. Must be one of: ${validFormats.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Export configuration to file
   */
  exportConfig(filePath: string): void {
    const exportData = {
      version: this.CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      config: this.config
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    console.log(chalk.green(`✅ Configuration exported to: ${filePath}`));
  }

  /**
   * Import configuration from file
   */
  importConfig(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    try {
      const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (!importData.config) {
        throw new Error('Invalid configuration file format');
      }

      this.config = importData.config;
      this.saveConfig();

      console.log(chalk.green(`✅ Configuration imported from: ${filePath}`));
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }
}

export default ConfigManager;