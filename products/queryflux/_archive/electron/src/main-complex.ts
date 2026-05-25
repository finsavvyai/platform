import { app, BrowserWindow, ipcMain, Menu, shell, dialog, Tray, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join, dirname } from 'path';
import Store from 'electron-store';
import keytar from 'keytar';
import { fileURLToPath } from 'url';
import { DatabaseAdapterFactory } from './database/adapters';
import * as encryption from './security/encryption';

// Application configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Application state
const state = {
  mainWindow: BrowserWindow | null = null,
  tray: Tray | null = null,
  isQuitting: false,
  connections: new Map<string, any>(),
  queryResults: new Map<string, any>(),
};

// Secure storage
const secureStore = new Store({
  name: 'queryflux-secure',
  encryptionKey: 'queryflux-secure-key-2024',
  defaults: {
    connections: [],
    settings: {
      theme: 'dark',
      autoConnect: false,
      backupEnabled: true,
    },
  },
});

// Keytar service name
const SERVICE_NAME = 'QueryFlux';

class DatabaseManager {
  private adapters: Map<string, any> = new Map();
  private connections: Map<string, any> = new Map();
  private connectionPools: Map<string, any> = new Map();

  constructor() {
    // Adapters are created dynamically on demand
  }

  private getAdapter(config: ConnectionConfig) {
    return DatabaseAdapterFactory.createAdapter(config);
  }

  async connect(connectionConfig: any): Promise<any> {
    try {
      // Validate configuration
      DatabaseAdapterFactory.validateConfig(connectionConfig);

      const adapter = this.getAdapter(connectionConfig);
      if (!adapter) {
        throw new Error(`Unsupported database type: ${connectionConfig.type}`);
      }

      // Decrypt sensitive fields
      const decryptedConfig = await this.decryptConnectionConfig(connectionConfig);

      // Establish connection
      const connection = await adapter.connect(decryptedConfig);

      // Store connection for later use
      this.connections.set(connectionConfig.id, {
        connection,
        adapter,
        config: connectionConfig,
        connectedAt: new Date(),
      });

      return { success: true, connectionId: connectionConfig.id };
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      await conn.adapter.disconnect(conn.connection);
      this.connections.delete(connectionId);
    } catch (error) {
      console.error('Database disconnection failed:', error);
      throw error;
    }
  }

  async executeQuery(connectionId: string, query: string, params?: any[]): Promise<any> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      const result = await conn.adapter.executeQuery(conn.connection, query, params);

      // Store query result for potential caching
      const queryId = `query-${Date.now()}`;
      state.queryResults.set(queryId, {
        queryId,
        connectionId,
        query,
        result,
        executedAt: new Date(),
      });

      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  async getSchema(connectionId: string): Promise<any> {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      return await conn.adapter.getSchema(conn.connection);
    } catch (error) {
      console.error('Schema retrieval failed:', error);
      throw error;
    }
  }

  async testConnection(connectionConfig: any): Promise<boolean> {
    try {
      const adapter = this.getAdapter(connectionConfig);
      if (!adapter) {
        throw new Error(`Unsupported database type: ${connectionConfig.type}`);
      }

      const decryptedConfig = await this.decryptConnectionConfig(connectionConfig);
      return await adapter.testConnection(decryptedConfig);
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  private async decryptConnectionConfig(config: any): Promise<any> {
    const decrypted = { ...config };

    // Decrypt password if encrypted
    if (config.passwordEncrypted) {
      try {
        decrypted.password = await keytar.getPassword(SERVICE_NAME, config.id);
        delete decrypted.passwordEncrypted;
      } catch (error) {
        throw new Error('Failed to decrypt password');
      }
    }

    // Decrypt other sensitive fields
    if (config.sslKeyEncrypted) {
      try {
        decrypted.sslKey = await keytar.getPassword(`${SERVICE_NAME}-ssl`, config.id);
        delete decrypted.sslKeyEncrypted;
      } catch (error) {
        console.error('Failed to decrypt SSL key:', error);
      }
    }

    return decrypted;
  }

  private async encryptConnectionConfig(config: any): Promise<any> {
    const encrypted = { ...config };

    // Encrypt password
    if (config.password) {
      await keytar.setPassword(SERVICE_NAME, config.id, config.password);
      encrypted.passwordEncrypted = true;
      delete encrypted.password;
    }

    // Encrypt SSL key
    if (config.sslKey) {
      await keytar.setPassword(`${SERVICE_NAME}-ssl`, config.id, config.sslKey);
      encrypted.sslKeyEncrypted = true;
      delete encrypted.sslKey;
    }

    return encrypted;
  }

  async saveConnection(connectionConfig: any): Promise<void> {
    const encrypted = await this.encryptConnectionConfig(connectionConfig);

    const connections = secureStore.get('connections', []);
    const existingIndex = connections.findIndex((c: any) => c.id === connectionConfig.id);

    if (existingIndex >= 0) {
      connections[existingIndex] = { ...encrypted, updatedAt: Date.now() };
    } else {
      connections.push({ ...encrypted, createdAt: Date.now() });
    }

    secureStore.set('connections', connections);
  }

  getConnections(): any[] {
    return secureStore.get('connections', []);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    // Disconnect if connected
    if (this.connections.has(connectionId)) {
      await this.disconnect(connectionId);
    }

    // Remove from storage
    const connections = secureStore.get('connections', []);
    const filtered = connections.filter((c: any) => c.id !== connectionId);
    secureStore.set('connections', filtered);

    // Remove from keytar
    await keytar.deletePassword(SERVICE_NAME, connectionId);
    await keytar.deletePassword(`${SERVICE_NAME}-ssl`, connectionId);
  }
}

// Initialize database manager
const dbManager = new DatabaseManager();

// Create main browser window
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, './preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: true,
    },
  });

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (isDevelopment) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    state.mainWindow = null;
  });

  // Handle navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  state.mainWindow = mainWindow;
  return mainWindow;
}

// Create application menu
function createMenu(): Menu {
  const template: any[] = [
    {
      label: 'QueryFlux',
      submenu: [
        {
          label: 'About QueryFlux',
          role: 'about',
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'preferences' });
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: isWindows ? 'Alt+F4' : 'Cmd+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Database',
      submenu: [
        {
          label: 'New Connection...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'new-connection' });
          },
        },
        {
          label: 'Connection Manager',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'connection-manager' });
          },
        },
        { type: 'separator' },
        {
          label: 'Execute Query',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'execute-query' });
          },
        },
        { type: 'separator' },
        {
          label: 'Import SQL File...',
          click: async () => {
            const result = await dialog.showOpenDialog(state.mainWindow!, {
              properties: ['openFile'],
              filters: [
                { name: 'SQL Files', extensions: ['sql'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              state.mainWindow?.webContents.send('file-imported', {
                filePath: result.filePaths[0],
              });
            }
          },
        },
        {
          label: 'Export Results...',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'export-results' });
          },
        },
      ],
    },
    {
      label: 'AI Assistant',
      submenu: [
        {
          label: 'Open AI Assistant',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'ai-assistant' });
          },
        },
        {
          label: 'Convert Natural Language to SQL',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'nl-to-sql' });
          },
        },
        {
          label: 'Optimize Query',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'optimize-query' });
          },
        },
        {
          label: 'Explain Query',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'explain-query' });
          },
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Query History',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'query-history' });
          },
        },
        {
          label: 'Saved Queries',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'saved-queries' });
          },
        },
        { type: 'separator' },
        {
          label: 'Database Schema Browser',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'schema-browser' });
          },
        },
        {
          label: 'Performance Monitor',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'performance-monitor' });
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        { role: 'front' },
        { role: 'back' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { role: 'toggleFullScreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            state.mainWindow?.webContents.send('global-shortcut', { action: 'shortcuts-help' });
          },
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.queryflux.com');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/queryflux/queryflux/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          role: 'about',
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

// Create system tray
function createTray(): Tray {
  const trayIcon = nativeImage.createFromPath(join(__dirname, '../assets/tray.png'));
  const tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show QueryFlux',
      click: () => {
        state.mainWindow?.show();
        state.mainWindow?.focus();
      },
    },
    {
      label: 'New Connection',
      click: () => {
        state.mainWindow?.show();
        state.mainWindow?.webContents.send('tray:action', { action: 'new-connection' });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        state.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('QueryFlux - Database Management');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    state.mainWindow?.isVisible() ? state.mainWindow?.hide() : state.mainWindow?.show();
  });

  state.tray = tray;
  return tray;
}

// IPC Handlers
function setupIpcHandlers() {
  // Database operations
  ipcMain.handle('db:connect', async (event, connectionConfig) => {
    try {
      return await dbManager.connect(connectionConfig);
    } catch (error) {
      console.error('IPC db:connect error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:disconnect', async (event, connectionId) => {
    try {
      await dbManager.disconnect(connectionId);
      return { success: true };
    } catch (error) {
      console.error('IPC db:disconnect error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:execute-query', async (event, { connectionId, query, params }) => {
    try {
      return await dbManager.executeQuery(connectionId, query, params);
    } catch (error) {
      console.error('IPC db:execute-query error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-schema', async (event, connectionId) => {
    try {
      return await dbManager.getSchema(connectionId);
    } catch (error) {
      console.error('IPC db:get-schema error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:test-connection', async (event, connectionConfig) => {
    try {
      return await dbManager.testConnection(connectionConfig);
    } catch (error) {
      console.error('IPC db:test-connection error:', error);
      return false;
    }
  });

  // Connection management
  ipcMain.handle('connections:get', () => {
    return dbManager.getConnections();
  });

  ipcMain.handle('connections:save', async (event, connectionConfig) => {
    try {
      await dbManager.saveConnection(connectionConfig);
      return { success: true };
    } catch (error) {
      console.error('IPC connections:save error:', error);
      throw error;
    }
  });

  ipcMain.handle('connections:delete', async (event, connectionId) => {
    try {
      await dbManager.deleteConnection(connectionId);
      return { success: true };
    } catch (error) {
      console.error('IPC connections:delete error:', error);
      throw error;
    }
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return secureStore.get('settings', {});
  });

  ipcMain.handle('settings:set', (event, settings) => {
    secureStore.set('settings', { ...secureStore.get('settings', {}), ...settings });
    return { success: true };
  });

  // File operations
  ipcMain.handle('file:read-sql', async (event, filePath) => {
    try {
      const fs = await import('fs');
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error('IPC file:read-sql error:', error);
      throw error;
    }
  });

  ipcMain.handle('file:save-results', async (event, { filePath, data }) => {
    try {
      const fs = await import('fs');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      console.error('IPC file:save-results error:', error);
      throw error;
    }
  });

  // Application control
  ipcMain.handle('app:minimize', () => {
    state.mainWindow?.minimize();
    return { success: true };
  });

  ipcMain.handle('app:maximize', () => {
    if (state.mainWindow?.isMaximized()) {
      state.mainWindow.unmaximize();
    } else {
      state.mainWindow?.maximize();
    }
    return { success: true };
  });

  ipcMain.handle('app:quit', () => {
    state.isQuitting = true;
    app.quit();
    return { success: true };
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // Auto updater
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdatesAndNotify();
      return { success: true };
    } catch (error) {
      console.error('IPC updater:check-for-updates error:', error);
      throw error;
    }
  });

  ipcMain.handle('updater:download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('IPC updater:download-update error:', error);
      throw error;
    }
  });

  ipcMain.handle('updater:install-update', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
  });
}

// Auto updater events
function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    state.mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    state.mainWindow?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto updater error:', error);
    state.mainWindow?.webContents.send('update-error', error);
  });
}

// App event handlers
app.whenReady().then(() => {
  // Set app user model ID for Windows
  if (isWindows) {
    app.setAppUserModelId('com.queryflux.desktop');
  }

  // Create main window
  createWindow();

  // Setup menu
  const menu = createMenu();
  Menu.setApplicationMenu(menu);

  // Create tray (except on macOS where it's less common)
  if (!isMac) {
    createTray();
  }

  // Setup IPC handlers
  setupIpcHandlers();

  // Setup auto updater
  setupAutoUpdater();

  // Make single instance
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus on our window
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (isMac && !state.isQuitting) {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  // Cleanup resources
  const connectionIds = Array.from(dbManager.connections.keys());
  for (const connectionId of connectionIds) {
    try {
      await dbManager.disconnect(connectionId);
    } catch (error) {
      console.error('Failed to disconnect during shutdown:', error);
    }
  }
});

// Security settings
app.on('web-contents-created', (contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow only same origin and development server
    if (parsedUrl.origin !== 'http://localhost:5174' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
});

export { app, state, dbManager };
