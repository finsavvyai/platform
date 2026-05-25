import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { config as dotenvConfig } from 'dotenv';

interface Config {
  app: {
    name: string;
    version: string;
    description: string;
    environment: string;
    debug: boolean;
    logLevel: string;
  };
  server: {
    host: string;
    port: number;
    cors: {
      origin: string[];
      credentials: boolean;
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };
  database: {
    host: string;
    port: number;
    name: string;
    ssl: boolean | { rejectUnauthorized: boolean };
    pool: {
      min: number;
      max: number;
    };
  };
  redis: {
    host: string;
    port: number;
    db: number;
    ttl: number;
  };
  auth: {
    jwt: {
      algorithm: string;
      expiresIn: string;
      refreshExpiresIn: string;
    };
    oauth: {
      google: {
        enabled: boolean;
        clientId: string;
      };
      github: {
        enabled: boolean;
        clientId: string;
      };
    };
  };
  ai: {
    openai: {
      enabled: boolean;
      model: string;
      maxTokens: number;
      temperature: number;
    };
    huggingface: {
      enabled: boolean;
      model: string;
    };
  };
  testing: {
    engines: {
      playwright: {
        enabled: boolean;
        timeout: number;
        retries: number;
      };
      maestro: {
        enabled: boolean;
        timeout: number;
        retries: number;
      };
    };
    recording: {
      enabled: boolean;
      maxDuration: number;
      autoSave: boolean;
    };
  };
  mobile: {
    platforms: string[];
    ios: {
      minimumVersion: string;
      bundleId: string;
    };
    android: {
      minimumVersion: string;
      packageName: string;
    };
  };
  extensions: {
    vscode: {
      enabled: boolean;
      minimumVersion: string;
      commands: {
        voiceCommands: boolean;
        testGeneration: boolean;
        securityScanning: boolean;
        performanceTesting: boolean;
      };
    };
    browser: {
      enabled: boolean;
      supportedBrowsers: string[];
      permissions: string[];
    };
  };
  notifications: {
    email: {
      enabled: boolean;
      provider: string;
      from: string;
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
    };
    teams: {
      enabled: boolean;
      webhookUrl: string;
    };
  };
  monitoring: {
    telemetry: {
      enabled: boolean;
      provider: string;
    };
    analytics: {
      enabled: boolean;
      provider: string;
    };
    errorReporting: {
      enabled: boolean;
      provider: string;
      dsn?: string;
    };
    logging: {
      level: string;
      format: string;
      transport: string;
    };
  };
  security: {
    encryption: {
      algorithm: string;
      keyLength: number;
    };
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
    csp: {
      enabled: boolean;
      directives: Record<string, string[]>;
    };
  };
  performance: {
    caching: {
      enabled: boolean;
      ttl: number;
      strategy: string;
    };
    compression: {
      enabled: boolean;
      algorithm: string;
    };
    optimization: {
      bundleSplitting: boolean;
      codeSplitting: boolean;
      treeShaking: boolean;
    };
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    cloud: {
      enabled: boolean;
      provider: string;
      bucket?: string;
      region?: string;
      accessKey?: string;
      secretKey?: string;
    };
  };
  api: {
    version: string;
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  websocket: {
    enabled: boolean;
    port: number;
    path: string;
    transports: string[];
  };
  ci: {
    enabled: boolean;
    provider: string;
    pipelines: {
      test: boolean;
      build: boolean;
      deploy: boolean;
    };
  };
  deployment: {
    environment: string;
    provider: string;
    domains: {
      api: string;
      app: string;
      docs: string;
    };
  };
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private environment: string;

  private constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    // Load environment variables
    const envPath = resolve(process.cwd(), `.env.${this.environment}`);
    const defaultEnvPath = resolve(process.cwd(), '.env');

    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath });
    } else if (existsSync(defaultEnvPath)) {
      dotenvConfig({ path: defaultEnvPath });
    }

    // Load configuration files
    const configPath = join(__dirname, '..');
    const defaultConfigPath = join(configPath, 'default.json');
    const envConfigPath = join(configPath, `${this.environment}.json`);

    let config: Partial<Config> = {};

    // Load default config
    if (existsSync(defaultConfigPath)) {
      const defaultConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
      config = this.mergeConfig(config, defaultConfig);
    }

    // Load environment-specific config
    if (existsSync(envConfigPath)) {
      const envConfig = JSON.parse(readFileSync(envConfigPath, 'utf8'));
      config = this.mergeConfig(config, envConfig);
    }

    // Override with environment variables
    config = this.applyEnvironmentVariables(config);

    this.config = config as Config;
  }

  private mergeConfig(base: Partial<Config>, override: Partial<Config>): Partial<Config> {
    const result = { ...base };

    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfig(result[key] || {}, override[key] as any);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  private applyEnvironmentVariables(config: Partial<Config>): Partial<Config> {
    const envMappings: Record<string, { path: string; transform?: (value: string) => any }> = {
      'PORT': { path: 'server.port', transform: Number },
      'DATABASE_URL': {
        path: 'database.url',
        transform: (value: string) => {
          try {
            const url = new URL(value);
            return {
              host: url.hostname,
              port: parseInt(url.port) || (url.protocol === 'postgres:' ? 5432 : 3306),
              name: url.pathname.substring(1),
              ssl: url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== 'disable'
            };
          } catch {
            return value;
          }
        }
      },
      'REDIS_URL': { path: 'redis.url' },
      'JWT_SECRET': { path: 'auth.jwt.secret' },
      'OPENAI_API_KEY': { path: 'ai.openai.apiKey' },
      'HUGGINGFACE_API_KEY': { path: 'ai.huggingface.apiKey' },
      'SENTRY_DSN': { path: 'monitoring.errorReporting.dsn' },
      'FRONTEND_URL': {
        path: 'server.cors.origin',
        transform: (value: string) => [value]
      },
      'ENABLE_LOGGING': {
        path: 'monitoring.logging.enabled',
        transform: (value: string) => value === 'true'
      },
      'LOG_LEVEL': { path: 'monitoring.logging.level' },
      'AWS_ACCESS_KEY_ID': { path: 'storage.cloud.accessKey' },
      'AWS_SECRET_ACCESS_KEY': { path: 'storage.cloud.secretKey' }
    };

    for (const [envVar, { path, transform }] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedProperty(config, path, transform ? transform(value) : value);
      }
    }

    return config;
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
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

  public get(): Config {
    return this.config;
  }

  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  public getPath(path: string): any {
    return this.getNestedProperty(this.config, path);
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  public isDevelopment(): boolean {
    return this.environment === 'development';
  }

  public isProduction(): boolean {
    return this.environment === 'production';
  }

  public isStaging(): boolean {
    return this.environment === 'staging';
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public reload(): void {
    this.loadConfig();
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();
export { config as Config };
export type { Config };

// Export environment-specific getters
export const isDev = config.isDevelopment();
export const isProd = config.isProduction();
export const isStaging = config.isStaging();
export const env = config.getEnvironment();

// Export common configuration getters
export const serverConfig = config.get('server');
export const databaseConfig = config.get('database');
export const redisConfig = config.get('redis');
export const authConfig = config.get('auth');
export const aiConfig = config.get('ai');
export const monitoringConfig = config.get('monitoring');
export const mobileConfig = config.get('mobile');
export const extensionsConfig = config.get('extensions');