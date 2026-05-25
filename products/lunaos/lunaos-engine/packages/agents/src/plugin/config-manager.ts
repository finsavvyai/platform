import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Joi from 'joi';
import {
  IPlugin,
  IPluginManifest,
  PluginContext,
  ILogger,
  IEventBus,
  IStorage
} from './interfaces';

/**
 * Plugin Configuration Schema
 */
export interface PluginConfigSchema {
  [key: string]: Joi.Schema;
}

/**
 * Plugin Configuration with Metadata
 */
export interface PluginConfig {
  config: any;
  schema?: PluginConfigSchema;
  defaults: any;
  encrypted: string[];
  readonly: string[];
  environment: string[];
  lastModified: Date;
  modifiedBy: string;
  version: string;
}

/**
 * Configuration Validation Result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: any;
}

/**
 * Configuration Change Event
 */
export interface ConfigChangeEvent {
  pluginName: string;
  oldConfig: any;
  newConfig: any;
  changedKeys: string[];
  timestamp: Date;
  source: 'user' | 'environment' | 'system';
}

/**
 * Plugin Configuration Manager
 * Handles configuration management with validation, encryption, and environment override support
 */
export class PluginConfigManager extends EventEmitter {
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly storage: IStorage;
  private readonly configDirectory: string;
  private readonly configs: Map<string, PluginConfig> = new Map();
  private readonly schemas: Map<string, PluginConfigSchema> = new Map();
  private readonly encryptionKey: string;
  private isInitialized = false;

  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    storage: IStorage,
    configDirectory: string,
    encryptionKey: string
  ) {
    super();

    this.logger = logger.child({ component: 'PluginConfigManager' });
    this.eventBus = eventBus;
    this.storage = storage;
    this.configDirectory = configDirectory;
    this.encryptionKey = encryptionKey;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Config manager is already initialized');
      return;
    }

    this.logger.info('Initializing plugin configuration manager');

    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory();

      // Load existing configurations
      await this.loadExistingConfigs();

      this.isInitialized = true;
      this.emit('config-manager-initialized');
      await this.eventBus.emit('plugin-config-manager-initialized', {
        timestamp: Date.now()
      });

      this.logger.info('Plugin configuration manager initialized successfully');

    } catch (error) {
      this.logger.error(`Failed to initialize config manager: ${error}`);
      throw error;
    }
  }

  async registerPlugin(plugin: IPlugin): Promise<void> {
    const pluginName = plugin.name;
    this.logger.info(`Registering configuration for plugin: ${pluginName}`);

    try {
      // Create or load plugin configuration
      let config = await this.loadPluginConfig(pluginName);

      if (!config) {
        // Create new configuration from defaults
        config = await this.createDefaultConfig(plugin);
        await this.savePluginConfig(pluginName, config);
      }

      // Store in memory
      this.configs.set(pluginName, config);

      // Register schema if provided
      if (plugin.manifest.configSchema) {
        await this.registerConfigSchema(pluginName, plugin.manifest.configSchema);
      }

      // Apply environment overrides
      await this.applyEnvironmentOverrides(pluginName);

      // Validate configuration
      const validation = await this.validateConfig(pluginName, config.config);
      if (!validation.valid) {
        this.logger.warn(`Invalid configuration for plugin ${pluginName}:`, validation.errors);
      }

      this.logger.info(`Configuration registered for plugin: ${pluginName}`);
      this.emit('plugin-config-registered', { pluginName });

    } catch (error) {
      this.logger.error(`Failed to register configuration for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  async unregisterPlugin(pluginName: string): Promise<void> {
    this.logger.info(`Unregistering configuration for plugin: ${pluginName}`);

    try {
      // Remove from memory
      this.configs.delete(pluginName);
      this.schemas.delete(pluginName);

      this.logger.info(`Configuration unregistered for plugin: ${pluginName}`);
      this.emit('plugin-config-unregistered', { pluginName });

    } catch (error) {
      this.logger.error(`Failed to unregister configuration for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  async getConfig(pluginName: string): Promise<any> {
    const config = this.configs.get(pluginName);
    if (!config) {
      throw new Error(`Configuration not found for plugin: ${pluginName}`);
    }

    // Return a deep copy to prevent external modifications
    return JSON.parse(JSON.stringify(config.config));
  }

  async setConfig(pluginName: string, newConfig: any, options?: {
    source?: 'user' | 'environment' | 'system';
    modifiedBy?: string;
    validate?: boolean;
    persist?: boolean;
  }): Promise<void> {
    const source = options?.source || 'user';
    const modifiedBy = options?.modifiedBy || 'system';
    const validate = options?.validate !== false;
    const persist = options?.persist !== false;

    this.logger.info(`Setting configuration for plugin: ${pluginName} (source: ${source})`);

    try {
      const currentConfig = this.configs.get(pluginName);
      if (!currentConfig) {
        throw new Error(`Configuration not found for plugin: ${pluginName}`);
      }

      const oldConfig = currentConfig.config;

      // Validate new configuration
      if (validate) {
        const validation = await this.validateConfig(pluginName, newConfig);
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Use sanitized configuration
        newConfig = validation.sanitized;
      }

      // Process configuration (encryption, etc.)
      const processedConfig = await this.processConfigForStorage(
        pluginName,
        newConfig,
        currentConfig
      );

      // Update configuration
      currentConfig.config = processedConfig;
      currentConfig.lastModified = new Date();
      currentConfig.modifiedBy = modifiedBy;

      // Persist if requested
      if (persist) {
        await this.savePluginConfig(pluginName, currentConfig);
      }

      // Detect changes
      const changedKeys = this.detectConfigChanges(oldConfig, newConfig);

      // Emit change event
      const changeEvent: ConfigChangeEvent = {
        pluginName,
        oldConfig,
        newConfig,
        changedKeys,
        timestamp: new Date(),
        source
      };

      this.emit('config-changed', changeEvent);
      await this.eventBus.emit('plugin-config-changed', changeEvent);

      this.logger.info(`Configuration updated for plugin: ${pluginName}`);

    } catch (error) {
      this.logger.error(`Failed to set configuration for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  async updateConfig(pluginName: string, updates: any, options?: {
    source?: 'user' | 'environment' | 'system';
    modifiedBy?: string;
    validate?: boolean;
    persist?: boolean;
  }): Promise<void> {
    const currentConfig = await this.getConfig(pluginName);
    const newConfig = { ...currentConfig, ...updates };

    await this.setConfig(pluginName, newConfig, options);
  }

  async resetConfig(pluginName: string, options?: {
    source?: 'user' | 'system';
    modifiedBy?: string;
    persist?: boolean;
  }): Promise<void> {
    this.logger.info(`Resetting configuration for plugin: ${pluginName}`);

    try {
      const currentConfig = this.configs.get(pluginName);
      if (!currentConfig) {
        throw new Error(`Configuration not found for plugin: ${pluginName}`);
      }

      // Reset to defaults
      const defaultConfig = currentConfig.defaults;
      await this.setConfig(pluginName, defaultConfig, {
        source: options?.source || 'user',
        modifiedBy: options?.modifiedBy || 'system',
        validate: true,
        persist: options?.persist !== false
      });

      this.logger.info(`Configuration reset for plugin: ${pluginName}`);
      this.emit('config-reset', { pluginName });

    } catch (error) {
      this.logger.error(`Failed to reset configuration for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  async validateConfig(pluginName: string, config: any): Promise<ConfigValidationResult> {
    const schema = this.schemas.get(pluginName);
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      let sanitized = config;

      if (schema) {
        // Validate against schema
        const { error, value } = schema.validate(config, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          errors.push(...error.details.map(detail => detail.message));
        }

        sanitized = value;
      }

      // Additional validation rules
      await this.performAdditionalValidation(pluginName, sanitized, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitized
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
        sanitized: config
      };
    }
  }

  async registerConfigSchema(pluginName: string, schema: PluginConfigSchema): Promise<void> {
    this.logger.info(`Registering configuration schema for plugin: ${pluginName}`);

    try {
      // Convert to Joi schema
      const joiSchema = Joi.object(schema);

      this.schemas.set(pluginName, schema);

      // Validate existing configuration
      const config = this.configs.get(pluginName);
      if (config) {
        const validation = await this.validateConfig(pluginName, config.config);
        if (!validation.valid) {
          this.logger.warn(`Existing configuration for plugin ${pluginName} is invalid:`, validation.errors);
        }
      }

      this.logger.info(`Configuration schema registered for plugin: ${pluginName}`);

    } catch (error) {
      this.logger.error(`Failed to register schema for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  async exportConfig(pluginName: string, options?: {
    includeDefaults?: boolean;
    includeEncrypted?: boolean;
    format?: 'json' | 'yaml';
  }): Promise<string> {
    const config = this.configs.get(pluginName);
    if (!config) {
      throw new Error(`Configuration not found for plugin: ${pluginName}`);
    }

    const includeDefaults = options?.includeDefaults !== false;
    const includeEncrypted = options?.includeEncrypted === true;
    const format = options?.format || 'json';

    let exportData: any;

    if (includeDefaults) {
      exportData = {
        defaults: config.defaults,
        current: config.config,
        schema: config.schema,
        metadata: {
          version: config.version,
          lastModified: config.lastModified,
          modifiedBy: config.modifiedBy
        }
      };
    } else {
      exportData = config.config;
    }

    // Filter out encrypted fields if not requested
    if (!includeEncrypted && config.encrypted.length > 0) {
      exportData = this.filterEncryptedFields(exportData, config.encrypted);
    }

    // Serialize based on format
    if (format === 'yaml') {
      const yaml = await import('js-yaml');
      return yaml.dump(exportData);
    } else {
      return JSON.stringify(exportData, null, 2);
    }
  }

  async importConfig(pluginName: string, configData: string, options?: {
    format?: 'json' | 'yaml';
    merge?: boolean;
    validate?: boolean;
    source?: 'user' | 'system';
    modifiedBy?: string;
  }): Promise<void> {
    const format = options?.format || 'json';
    const merge = options?.merge === true;
    const validate = options?.validate !== false;
    const source = options?.source || 'user';
    const modifiedBy = options?.modifiedBy || 'system';

    this.logger.info(`Importing configuration for plugin: ${pluginName}`);

    try {
      let parsedConfig: any;

      // Parse based on format
      if (format === 'yaml') {
        const yaml = await import('js-yaml');
        parsedConfig = yaml.load(configData);
      } else {
        parsedConfig = JSON.parse(configData);
      }

      // Extract actual config if it contains metadata
      let newConfig = parsedConfig;
      if (parsedConfig.current) {
        newConfig = parsedConfig.current;
      }

      // Merge with existing config if requested
      if (merge) {
        const existingConfig = await this.getConfig(pluginName);
        newConfig = { ...existingConfig, ...newConfig };
      }

      // Set the new configuration
      await this.setConfig(pluginName, newConfig, {
        source,
        modifiedBy,
        validate,
        persist: true
      });

      this.logger.info(`Configuration imported successfully for plugin: ${pluginName}`);

    } catch (error) {
      this.logger.error(`Failed to import configuration for plugin ${pluginName}: ${error}`);
      throw error;
    }
  }

  getConfigMetadata(pluginName: string): PluginConfig | null {
    const config = this.configs.get(pluginName);
    if (!config) {
      return null;
    }

    // Return metadata without the actual config
    return {
      config: {}, // Don't expose actual config
      defaults: config.defaults,
      encrypted: config.encrypted,
      readonly: config.readonly,
      environment: config.environment,
      lastModified: config.lastModified,
      modifiedBy: config.modifiedBy,
      version: config.version
    };
  }

  listConfiguredPlugins(): string[] {
    return Array.from(this.configs.keys());
  }

  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.configDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error}`);
    }
  }

  private async loadExistingConfigs(): Promise<void> {
    try {
      const files = await fs.readdir(this.configDirectory);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const pluginName = path.basename(file, '.json');
          try {
            const config = await this.loadPluginConfig(pluginName);
            if (config) {
              this.configs.set(pluginName, config);
            }
          } catch (error) {
            this.logger.warn(`Failed to load config for plugin ${pluginName}: ${error}`);
          }
        }
      }

      this.logger.info(`Loaded ${this.configs.size} existing configurations`);

    } catch (error) {
      this.logger.warn(`Failed to load existing configs: ${error}`);
    }
  }

  private async createDefaultConfig(plugin: IPlugin): Promise<PluginConfig> {
    const defaults = plugin.manifest.config || {};
    const manifestConfig = plugin.manifest;

    return {
      config: { ...defaults },
      defaults,
      schema: manifestConfig.configSchema,
      encrypted: manifestConfig.encryptedFields || [],
      readonly: manifestConfig.readonlyFields || [],
      environment: manifestConfig.environmentFields || [],
      lastModified: new Date(),
      modifiedBy: 'system',
      version: plugin.version
    };
  }

  private async loadPluginConfig(pluginName: string): Promise<PluginConfig | null> {
    try {
      const configPath = path.join(this.configDirectory, `${pluginName}.json`);
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Convert date strings back to Date objects
      config.lastModified = new Date(config.lastModified);

      return config;

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // Config file doesn't exist
      }
      throw error;
    }
  }

  private async savePluginConfig(pluginName: string, config: PluginConfig): Promise<void> {
    try {
      const configPath = path.join(this.configDirectory, `${pluginName}.json`);
      const configData = JSON.stringify(config, null, 2);
      await fs.writeFile(configPath, configData, 'utf-8');

    } catch (error) {
      throw new Error(`Failed to save config for plugin ${pluginName}: ${error}`);
    }
  }

  private async applyEnvironmentOverrides(pluginName: string): Promise<void> {
    const config = this.configs.get(pluginName);
    if (!config || !config.environment.length) {
      return;
    }

    for (const field of config.environment) {
      const envVar = `PLUGIN_${pluginName.toUpperCase()}_${field.toUpperCase()}`;
      const envValue = process.env[envVar];

      if (envValue !== undefined) {
        // Try to parse as JSON, fallback to string
        try {
          config.config[field] = JSON.parse(envValue);
        } catch {
          config.config[field] = envValue;
        }

        this.logger.debug(`Applied environment override for ${pluginName}.${field}: ${envVar}`);
      }
    }
  }

  private async processConfigForStorage(
    pluginName: string,
    config: any,
    currentConfig: PluginConfig
  ): Promise<any> {
    const processed = { ...config };

    // Encrypt sensitive fields
    for (const field of currentConfig.encrypted) {
      if (field in processed) {
        processed[field] = await this.encryptValue(processed[field]);
      }
    }

    return processed;
  }

  private async encryptValue(value: any): Promise<string> {
    // Simple encryption - in production, use proper encryption
    const crypto = await import('crypto');
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);

    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private async decryptValue(encryptedValue: string): Promise<any> {
    try {
      const crypto = await import('crypto');
      const algorithm = 'aes-256-gcm';
      const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);

    } catch (error) {
      this.logger.warn(`Failed to decrypt value: ${error}`);
      return null;
    }
  }

  private detectConfigChanges(oldConfig: any, newConfig: any): string[] {
    const changes: string[] = [];

    const findChanges = (obj1: any, obj2: any, prefix = '') => {
      const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

      for (const key of keys) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (!(key in obj1)) {
          changes.push(fullKey);
        } else if (!(key in obj2)) {
          changes.push(fullKey);
        } else if (typeof obj1[key] !== typeof obj2[key]) {
          changes.push(fullKey);
        } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
          findChanges(obj1[key], obj2[key], fullKey);
        } else if (obj1[key] !== obj2[key]) {
          changes.push(fullKey);
        }
      }
    };

    findChanges(oldConfig, newConfig);
    return changes;
  }

  private filterEncryptedFields(obj: any, encryptedFields: string[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const filtered = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in filtered) {
      if (encryptedFields.includes(key)) {
        delete filtered[key];
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = this.filterEncryptedFields(filtered[key], encryptedFields);
      }
    }

    return filtered;
  }

  private async performAdditionalValidation(
    pluginName: string,
    config: any,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Plugin-specific validation rules can be added here
    // For now, just basic checks

    if (config && typeof config === 'object') {
      // Check for unknown fields that might be typos
      const schema = this.schemas.get(pluginName);
      if (schema) {
        const schemaKeys = Object.keys(schema);
        const configKeys = Object.keys(config);

        for (const key of configKeys) {
          if (!schemaKeys.includes(key)) {
            warnings.push(`Unknown configuration field: ${key}`);
          }
        }
      }
    }
  }
}
