/**
 * Preload Script for QueryFlux Electron
 * Provides secure IPC bridge between renderer and main process
 */

import { contextBridge, ipcRenderer } from "electron";

// Define the exposed API
const electronAPI = {
  // Database operations
  database: {
    // Get available database types
    getTypes: () => ipcRenderer.invoke("db:get-types"),

    // Connection management
    testConnection: (config: any) => ipcRenderer.invoke("db:test-connection", config),
    connect: (config: any, name?: string) => ipcRenderer.invoke("db:connect", config, name),
    disconnect: (connectionId: string) => ipcRenderer.invoke("db:disconnect", connectionId),
    getConnections: () => ipcRenderer.invoke("db:get-connections"),

    // Query operations
    executeQuery: (connectionId: string, query: string, options?: any) =>
      ipcRenderer.invoke("db:execute-query", connectionId, query, options),
    validateQuery: (connectionId: string, query: string) =>
      ipcRenderer.invoke("db:validate-query", connectionId, query),
    explainQuery: (connectionId: string, query: string, collection?: string) =>
      ipcRenderer.invoke("db:explain-query", connectionId, query, collection),
    getQuerySuggestions: (connectionId: string, partialQuery: string, context?: any) =>
      ipcRenderer.invoke("db:get-query-suggestions", connectionId, partialQuery, context),

    // Database information
    getInfo: (connectionId: string) => ipcRenderer.invoke("db:get-info", connectionId),
    listCollections: (connectionId: string) => ipcRenderer.invoke("db:list-collections", connectionId),
    getCollectionInfo: (connectionId: string, collectionName: string) =>
      ipcRenderer.invoke("db:get-collection-info", connectionId, collectionName),
    getSampleData: (connectionId: string, collectionName: string, limit?: number) =>
      ipcRenderer.invoke("db:get-sample-data", connectionId, collectionName, limit),
    getPerformanceStats: (connectionId: string) => ipcRenderer.invoke("db:get-performance-stats", connectionId),

    // Saved connections
    saveConnection: (config: any, name?: string, overwrite?: boolean) =>
      ipcRenderer.invoke("db:save-connection", config, name, overwrite),
    getSavedConnections: () => ipcRenderer.invoke("db:get-saved-connections"),
    deleteSavedConnection: (connectionId: string) => ipcRenderer.invoke("db:delete-saved-connection", connectionId)
  },

  // File operations
  file: {
    read: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke("file:write", filePath, content),
    showOpenDialog: (options: any) => ipcRenderer.invoke("file:show-open-dialog", options),
    showSaveDialog: (options: any) => ipcRenderer.invoke("file:show-save-dialog", options)
  },

  // Application operations
  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
    getName: () => ipcRenderer.invoke("app:get-name"),
    getPlatform: () => ipcRenderer.invoke("app:get-platform"),
    showMessageBox: (options: any) => ipcRenderer.invoke("app:show-message-box", options),
    showErrorBox: (title: string, content: string) => ipcRenderer.invoke("app:show-error-box", title, content),
    openExternal: (url: string) => ipcRenderer.invoke("app:open-external", url),
    showItemInFolder: (path: string) => ipcRenderer.invoke("app:show-item-in-folder", path)
  },

  // Event listeners for menu and global shortcuts
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      "menu-new-connection",
      "menu-open-file",
      "menu-save-query",
      "menu-connect",
      "menu-disconnect",
      "menu-refresh-schema",
      "menu-execute-query",
      "global-shortcut-command-palette",
      "global-shortcut-execute-query",
      "connection:connected",
      "connection:disconnected",
      "connection:error",
      "connection:query"
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  // Remove event listeners
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // Remove all listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type definitions for the exposed API
export type ElectronAPI = typeof electronAPI;

// Declare the interface on the window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
