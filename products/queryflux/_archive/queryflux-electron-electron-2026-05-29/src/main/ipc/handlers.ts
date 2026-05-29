import { ipcMain, dialog, shell } from 'electron';
import { getStore } from '../store';
import type {
    ConnectionConfig,
    QueryRequest,
    QueryResult,
    SchemaInfo
} from '../../shared/types';

// Simple in-memory credential store (keytar can be added later with proper native build)
const credentialStore = new Map<string, string>();

/**
 * Setup all IPC handlers for the main process
 */
export function setupIpcHandlers(): void {
    // ==================== Connection Management ====================

    ipcMain.handle('connection:save', async (_, config: ConnectionConfig) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];

            // Store password in memory (secure keychain integration can be added later)
            if (config.password) {
                credentialStore.set(config.id, config.password);
                delete config.password; // Don't store password in config file
            }

            // Update or add connection
            const existingIndex = connections.findIndex((c: ConnectionConfig) => c.id === config.id);
            if (existingIndex >= 0) {
                connections[existingIndex] = config;
            } else {
                connections.push(config);
            }

            store.set('connections', connections);
            console.log(`Connection saved: ${config.name} (${config.type})`);

            return { success: true, id: config.id };
        } catch (error) {
            console.error('Failed to save connection:', error);
            throw error;
        }
    });

    ipcMain.handle('connection:get-all', async () => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            return connections;
        } catch (error) {
            console.error('Failed to get connections:', error);
            throw error;
        }
    });

    ipcMain.handle('connection:get', async (_, id: string) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            return connections.find((c: ConnectionConfig) => c.id === id) || null;
        } catch (error) {
            console.error(`Failed to get connection ${id}:`, error);
            throw error;
        }
    });

    ipcMain.handle('connection:delete', async (_, id: string) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];

            // Remove password from memory store
            credentialStore.delete(id);

            // Remove from store
            const filtered = connections.filter((c: ConnectionConfig) => c.id !== id);
            store.set('connections', filtered);

            console.log(`Connection deleted: ${id}`);
            return { success: true };
        } catch (error) {
            console.error(`Failed to delete connection ${id}:`, error);
            throw error;
        }
    });

    ipcMain.handle('connection:test', async (_, config: ConnectionConfig) => {
        try {
            // Retrieve password from memory if needed
            let password = config.password;
            if (!password && config.id) {
                password = credentialStore.get(config.id);
            }

            // Call backend API to test connection
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/v1/connections/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, password })
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to test connection:', error);
            return { success: false, error: String(error) };
        }
    });

    // ==================== Query Execution ====================

    ipcMain.handle('query:execute', async (_, request: QueryRequest) => {
        try {
            const { connectionId, query, params } = request;

            // Get connection config
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            const connection = connections.find((c: ConnectionConfig) => c.id === connectionId);

            if (!connection) {
                throw new Error(`Connection not found: ${connectionId}`);
            }

            // Retrieve password from memory
            const password = credentialStore.get(connectionId);

            // Execute query via backend
            const backendUrl = getBackendUrl();
            const response = await fetch(`${backendUrl}/api/v1/query/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection: { ...connection, password },
                    query,
                    params
                })
            });

            const result: QueryResult = await response.json();
            console.log(`Query executed on ${connection.name}: ${query.substring(0, 50)}...`);

            return result;
        } catch (error) {
            console.error('Failed to execute query:', error);
            throw error;
        }
    });

    ipcMain.handle('query:explain', async (_, request: QueryRequest) => {
        try {
            const { connectionId, query } = request;

            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            const connection = connections.find((c: ConnectionConfig) => c.id === connectionId);

            if (!connection) {
                throw new Error(`Connection not found: ${connectionId}`);
            }

            const password = credentialStore.get(connectionId);
            const backendUrl = getBackendUrl();

            const response = await fetch(`${backendUrl}/api/v1/query/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection: { ...connection, password },
                    query
                })
            });

            return await response.json();
        } catch (error) {
            console.error('Failed to explain query:', error);
            throw error;
        }
    });

    // ==================== Schema Operations ====================

    ipcMain.handle('schema:get', async (_, connectionId: string) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            const connection = connections.find((c: ConnectionConfig) => c.id === connectionId);

            if (!connection) {
                throw new Error(`Connection not found: ${connectionId}`);
            }

            const password = credentialStore.get(connectionId);
            const backendUrl = getBackendUrl();

            const response = await fetch(`${backendUrl}/api/v1/schema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...connection, password })
            });

            const schema: SchemaInfo = await response.json();
            return schema;
        } catch (error) {
            console.error('Failed to get schema:', error);
            throw error;
        }
    });

    ipcMain.handle('schema:get-table', async (_, connectionId: string, tableName: string) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            const connection = connections.find((c: ConnectionConfig) => c.id === connectionId);

            if (!connection) {
                throw new Error(`Connection not found: ${connectionId}`);
            }

            const password = credentialStore.get(connectionId);
            const backendUrl = getBackendUrl();

            const response = await fetch(`${backendUrl}/api/v1/schema/table/${tableName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...connection, password })
            });

            return await response.json();
        } catch (error) {
            console.error(`Failed to get table ${tableName}:`, error);
            throw error;
        }
    });

    // ==================== AI Integration ====================

    ipcMain.handle('ai:natural-to-sql', async (_, connectionId: string, naturalLanguage: string) => {
        try {
            const store = getStore();
            const connections = store.get('connections', []) as ConnectionConfig[];
            const connection = connections.find((c: ConnectionConfig) => c.id === connectionId);

            if (!connection) {
                throw new Error(`Connection not found: ${connectionId}`);
            }

            const password = credentialStore.get(connectionId);
            const backendUrl = getBackendUrl();

            const response = await fetch(`${backendUrl}/api/v1/ai/smart-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection: { ...connection, password },
                    natural_query: naturalLanguage
                })
            });

            return await response.json();
        } catch (error) {
            console.error('Failed to convert natural language to SQL:', error);
            throw error;
        }
    });

    // ==================== Dialogs ====================

    ipcMain.handle('dialog:open-file', async (_, options) => {
        const result = await dialog.showOpenDialog(options);
        return result;
    });

    ipcMain.handle('dialog:save-file', async (_, options) => {
        const result = await dialog.showSaveDialog(options);
        return result;
    });

    ipcMain.handle('dialog:message', async (_, options) => {
        const result = await dialog.showMessageBox(options);
        return result;
    });

    // ==================== Shell Operations ====================

    ipcMain.handle('shell:open-external', async (_, url: string) => {
        await shell.openExternal(url);
    });

    ipcMain.handle('shell:open-path', async (_, path: string) => {
        await shell.openPath(path);
    });

    // ==================== App Info ====================

    ipcMain.handle('app:get-version', () => {
        const { app } = require('electron');
        return app.getVersion();
    });

    ipcMain.handle('app:get-path', (_, name) => {
        const { app } = require('electron');
        return app.getPath(name);
    });

    // ==================== Settings ====================

    ipcMain.handle('settings:get', (_, key: string) => {
        const store = getStore();
        return store.get(key);
    });

    ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
        const store = getStore();
        store.set(key, value);
    });

    ipcMain.handle('settings:delete', (_, key: string) => {
        const store = getStore();
        store.delete(key);
    });

    console.log('IPC handlers initialized');
}

/**
 * Get the backend URL from settings or use default
 */
function getBackendUrl(): string {
    const store = getStore();
    return store.get('backendUrl', 'http://localhost:8080') as string;
}
