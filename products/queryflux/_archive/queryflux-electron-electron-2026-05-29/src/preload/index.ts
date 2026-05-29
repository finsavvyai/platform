import { contextBridge, ipcRenderer } from 'electron';

// Custom APIs for renderer
const api = {
    // ==================== Connection Management ====================
    connection: {
        save: (config: unknown) => ipcRenderer.invoke('connection:save', config),
        getAll: () => ipcRenderer.invoke('connection:get-all'),
        get: (id: string) => ipcRenderer.invoke('connection:get', id),
        delete: (id: string) => ipcRenderer.invoke('connection:delete', id),
        test: (config: unknown) => ipcRenderer.invoke('connection:test', config)
    },

    // ==================== Query Execution ====================
    query: {
        execute: (request: unknown) => ipcRenderer.invoke('query:execute', request),
        explain: (request: unknown) => ipcRenderer.invoke('query:explain', request)
    },

    // ==================== Schema Operations ====================
    schema: {
        get: (connectionId: string) => ipcRenderer.invoke('schema:get', connectionId),
        getTable: (connectionId: string, tableName: string) =>
            ipcRenderer.invoke('schema:get-table', connectionId, tableName)
    },

    // ==================== AI Integration ====================
    ai: {
        naturalToSql: (connectionId: string, naturalLanguage: string) =>
            ipcRenderer.invoke('ai:natural-to-sql', connectionId, naturalLanguage)
    },

    // ==================== Dialogs ====================
    dialog: {
        openFile: (options: unknown) => ipcRenderer.invoke('dialog:open-file', options),
        saveFile: (options: unknown) => ipcRenderer.invoke('dialog:save-file', options),
        message: (options: unknown) => ipcRenderer.invoke('dialog:message', options)
    },

    // ==================== Shell ====================
    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
        openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path)
    },

    // ==================== App Info ====================
    app: {
        getVersion: () => ipcRenderer.invoke('app:get-version'),
        getPath: (name: string) => ipcRenderer.invoke('app:get-path', name)
    },

    // ==================== Settings ====================
    settings: {
        get: (key: string) => ipcRenderer.invoke('settings:get', key),
        set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
        delete: (key: string) => ipcRenderer.invoke('settings:delete', key)
    },

    // ==================== Menu Events ====================
    onMenuEvent: (channel: string, callback: (...args: unknown[]) => void) => {
        const validChannels = [
            'menu:new-query',
            'menu:new-connection',
            'menu:save-query',
            'menu:execute-query',
            'menu:format-query',
            'menu:refresh-schema',
            'menu:preferences'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_, ...args) => callback(...args));
        }
        return () => ipcRenderer.removeAllListeners(channel);
    },

    // ==================== Updater Events ====================
    onUpdaterEvent: (event: string, callback: (info: unknown) => void) => {
        const validEvents = ['updater:update-available', 'updater:update-downloaded'];
        if (validEvents.includes(event)) {
            ipcRenderer.on(event, (_, info) => callback(info));
        }
        return () => ipcRenderer.removeAllListeners(event);
    }
};

// Expose APIs via contextBridge
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', api);
    } catch (error) {
        console.error('Failed to expose APIs:', error);
    }
} else {
    // @ts-ignore
    window.api = api;
}
