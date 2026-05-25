import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

interface StoreSchema {
    connections: Array<{
        id: string;
        name: string;
        type: string;
        host: string;
        port: number;
        database: string;
        username?: string;
        ssl?: boolean;
        options?: Record<string, unknown>;
    }>;
    recentQueries: Array<{
        id: string;
        connectionId: string;
        query: string;
        timestamp: number;
    }>;
    settings: {
        theme: 'light' | 'dark' | 'system';
        fontSize: number;
        autoSave: boolean;
        queryLimit: number;
        showLineNumbers: boolean;
        wordWrap: boolean;
    };
    backendUrl: string;
    windowState: {
        width: number;
        height: number;
        x?: number;
        y?: number;
        isMaximized: boolean;
    };
}

const defaults: StoreSchema = {
    connections: [],
    recentQueries: [],
    settings: {
        theme: 'system',
        fontSize: 14,
        autoSave: true,
        queryLimit: 1000,
        showLineNumbers: true,
        wordWrap: false
    },
    backendUrl: 'http://localhost:8080',
    windowState: {
        width: 1400,
        height: 900,
        isMaximized: false
    }
};

let storeData: StoreSchema = { ...defaults };
let storePath: string = '';

export function initializeStore(): void {
    const userDataPath = app.getPath('userData');
    storePath = join(userDataPath, 'queryflux-config.json');

    // Ensure directory exists
    if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true });
    }

    // Load existing data
    if (existsSync(storePath)) {
        try {
            const data = readFileSync(storePath, 'utf-8');
            storeData = { ...defaults, ...JSON.parse(data) };
        } catch (error) {
            console.error('Failed to load store:', error);
            storeData = { ...defaults };
        }
    } else {
        storeData = { ...defaults };
        saveStore();
    }

    console.log('Store initialized at:', storePath);
}

function saveStore(): void {
    try {
        writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to save store:', error);
    }
}

export function getStore() {
    return {
        get<T = unknown>(key: string, defaultValue?: T): T {
            const keys = key.split('.');
            let value: unknown = storeData;

            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = (value as Record<string, unknown>)[k];
                } else {
                    return defaultValue as T;
                }
            }

            return (value ?? defaultValue) as T;
        },

        set(key: string, value: unknown): void {
            const keys = key.split('.');

            if (keys.length === 1) {
                (storeData as Record<string, unknown>)[key] = value;
            } else {
                let obj: Record<string, unknown> = storeData as Record<string, unknown>;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!(keys[i] in obj)) {
                        obj[keys[i]] = {};
                    }
                    obj = obj[keys[i]] as Record<string, unknown>;
                }
                obj[keys[keys.length - 1]] = value;
            }

            saveStore();
        },

        delete(key: string): void {
            const keys = key.split('.');

            if (keys.length === 1) {
                delete (storeData as Record<string, unknown>)[key];
            } else {
                let obj: Record<string, unknown> = storeData as Record<string, unknown>;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!(keys[i] in obj)) return;
                    obj = obj[keys[i]] as Record<string, unknown>;
                }
                delete obj[keys[keys.length - 1]];
            }

            saveStore();
        },

        path: storePath
    };
}
