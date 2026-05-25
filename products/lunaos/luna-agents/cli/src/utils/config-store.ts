/**
 * Config Store — unified config read/write for CLI commands
 *
 * Manages two layers of configuration:
 *   1. Global  ~/.luna/config.yaml     — user-wide defaults (provider, model)
 *   2. Project .luna/config.yaml       — per-project overrides
 *   3. Credentials ~/.luna/credentials.yaml — API keys & tokens
 *
 * Resolution order: project > global > defaults
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';

export interface LunaConfig {
    version?: string;
    project?: string;
    provider?: string;
    model?: string;
    output?: {
        dir?: string;
        format?: string;
    };
    agents?: {
        free?: string[];
    };
    cloud?: {
        apiUrl?: string;
    };
    [key: string]: any;
}

const GLOBAL_DIR = path.join(os.homedir(), '.luna');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_DIR, 'config.yaml');
const CRED_PATH = path.join(GLOBAL_DIR, 'credentials.yaml');

function projectConfigPath(): string {
    return path.join(process.cwd(), '.luna', 'config.yaml');
}

// ─── Read ────────────────────────────────────────────

function readYaml(filePath: string): Record<string, any> {
    try {
        if (fs.existsSync(filePath)) {
            return yaml.parse(fs.readFileSync(filePath, 'utf-8')) || {};
        }
    } catch { /* ignore */ }
    return {};
}

/**
 * Load merged config (project overrides global)
 */
export function loadConfig(): LunaConfig {
    const global = readYaml(GLOBAL_CONFIG_PATH);
    const project = readYaml(projectConfigPath());
    return { ...global, ...project };
}

/**
 * Load global config only
 */
export function loadGlobalConfig(): LunaConfig {
    return readYaml(GLOBAL_CONFIG_PATH);
}

/**
 * Load project config only
 */
export function loadProjectConfig(): LunaConfig {
    return readYaml(projectConfigPath());
}

/**
 * Load credentials (API keys, cloud token)
 */
export function loadCredentials(): Record<string, string> {
    return readYaml(CRED_PATH) as Record<string, string>;
}

// ─── Write ───────────────────────────────────────────

function writeYaml(filePath: string, data: Record<string, any>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, yaml.stringify(data), 'utf-8');
}

/**
 * Set a config value in the global config
 * Supports dot-notation keys: "cloud.apiUrl" → { cloud: { apiUrl: "..." } }
 */
export function setGlobalConfig(key: string, value: string): void {
    const config = loadGlobalConfig();
    setNestedValue(config, key, value);
    writeYaml(GLOBAL_CONFIG_PATH, config);
}

/**
 * Set a config value in the project config
 */
export function setProjectConfig(key: string, value: string): void {
    const configPath = projectConfigPath();
    const config = readYaml(configPath);
    setNestedValue(config, key, value);
    writeYaml(configPath, config);
}

/**
 * Save credentials (chmod 600)
 */
export function saveCredentials(creds: Record<string, string>): void {
    writeYaml(CRED_PATH, creds);
    try {
        fs.chmodSync(CRED_PATH, 0o600);
    } catch { /* Windows doesn't support chmod */ }
}

/**
 * Get a specific config value (merged)
 */
export function getConfig(key: string): string | undefined {
    const config = loadConfig();
    return getNestedValue(config, key);
}

/**
 * Get cloud token
 */
export function getCloudToken(): string | null {
    const creds = loadCredentials();
    return creds.cloud_token || null;
}

/**
 * Get API URL
 */
export function getApiUrl(): string {
    const config = loadConfig();
    return config.cloud?.apiUrl || process.env.LUNA_API_URL || 'https://api.lunaos.ai';
}

// ─── Helpers ─────────────────────────────────────────

function setNestedValue(obj: Record<string, any>, key: string, value: string): void {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    // Auto-coerce booleans and numbers
    if (value === 'true') current[parts[parts.length - 1]] = true;
    else if (value === 'false') current[parts[parts.length - 1]] = false;
    else if (!isNaN(Number(value)) && value !== '') current[parts[parts.length - 1]] = Number(value);
    else current[parts[parts.length - 1]] = value;
}

function getNestedValue(obj: Record<string, any>, key: string): any {
    const parts = key.split('.');
    let current: any = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

// ─── Flat display ────────────────────────────────────

/**
 * Flatten a nested config into dot-notation key-value pairs
 */
export function flattenConfig(obj: Record<string, any>, prefix = ''): Array<{ key: string; value: string }> {
    const result: Array<{ key: string; value: string }> = [];
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            result.push(...flattenConfig(v, fullKey));
        } else {
            result.push({ key: fullKey, value: String(v) });
        }
    }
    return result;
}

// ─── Provider key helpers ────────────────────────────

/**
 * Provider env-var mapping (mirrors PROVIDERS from llm-client)
 */
const PROVIDER_ENV_VARS: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    xai: 'XAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    cohere: 'COHERE_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    together: 'TOGETHER_API_KEY',
    groq: 'GROQ_API_KEY',
    fireworks: 'FIREWORKS_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
};

/**
 * Get API key for a provider (env var → credentials file)
 */
export function getProviderKey(provider: string): string | null {
    const envVar = PROVIDER_ENV_VARS[provider];
    if (!envVar) return null;

    // 1. Environment variable
    if (process.env[envVar]) return process.env[envVar]!;

    // 2. Credentials file
    const creds = loadCredentials();
    return creds[envVar] || null;
}

/**
 * Set API key for a provider
 */
export function setProviderKey(provider: string, key: string): void {
    const envVar = PROVIDER_ENV_VARS[provider];
    if (!envVar) throw new Error(`Unknown provider: ${provider}`);

    const creds = loadCredentials();
    creds[envVar] = key;
    saveCredentials(creds);
}

/**
 * List all providers that have a key configured
 */
export function listConfiguredProviders(): string[] {
    const creds = loadCredentials();
    return Object.entries(PROVIDER_ENV_VARS)
        .filter(([, envVar]) => creds[envVar] || process.env[envVar])
        .map(([provider]) => provider);
}

export const KNOWN_KEYS = [
    'provider',
    'model',
    'output.dir',
    'output.format',
    'cloud.apiUrl',
] as const;
