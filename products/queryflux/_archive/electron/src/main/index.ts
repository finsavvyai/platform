import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  dialog,
  protocol,
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import Store from "electron-store";
// import icon from '../../resources/icon.png?asset';
import path from "path";
import { fileURLToPath } from "url";

// Import security and native features
import { SecurityConfig } from "./security/security-config";
import { SystemTray, AutoUpdater, KeyboardShortcuts } from "./native";
import {
  initializeSecureStorage,
  secureStorage,
} from "./security/secure-storage";
import {
  initializeLemonSqueezy,
  lemonSqueezyService,
} from "./services/lemonsqueezy-service";

// Initialize secure storage
const secureStore = new Store({
  encryptionKey: "queryflux-secure-key",
  name: "queryflux-data",
});

// Application state
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Native features instances
let systemTray: SystemTray | null = null;
let autoUpdater: AutoUpdater | null = null;
let keyboardShortcuts: KeyboardShortcuts | null = null;

// Development or production mode
const isDev = process.env.NODE_ENV === "development";

function createWindow(): void {
  // Validate application integrity
  if (!SecurityConfig.validateApplicationIntegrity()) {
    dialog.showErrorBox(
      "Application Integrity Check Failed",
      "The application appears to be corrupted. Please reinstall QueryFlux.",
    );
    app.quit();
    return;
  }

  // Create the browser window with enhanced security
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: isDev ? "default" : "hiddenInset",
    icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: process.env.NODE_ENV === "production", // Enable sandbox in production
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: "",
      disableBlinkFeatures: "OutOfBlinkCors",
      webgl: false,
      plugins: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      safeDialogs: true,
      secureDefaults: true,
    },
  });

  // Handle app quit
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("before-quit", () => {
    isQuitting = true;
  });

  // Prevent navigation away from the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Show window when ready
  mainWindow.webContents.on("did-finish-load", () => {
    if (!isDev) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Security: prevent navigation away from the app
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (
      parsedUrl.origin !== "http://localhost:5174" &&
      !navigationUrl.startsWith("file://")
    ) {
      event.preventDefault();
    }
  });

  // Load the app
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Initialize native features
  if (!systemTray) {
    systemTray = new SystemTray();
  }

  if (!autoUpdater) {
    autoUpdater = new AutoUpdater();
    autoUpdater.setMainWindow(mainWindow!);
  }

  if (!keyboardShortcuts) {
    keyboardShortcuts = new KeyboardShortcuts();
    keyboardShortcuts.setMainWindow(mainWindow!);
  }
}

// IPC Handlers
ipcMain.handle("store:get", (_, key: string) => {
  return secureStore.get(key);
});

ipcMain.handle("store:set", (_, key: string, value: any) => {
  secureStore.set(key, value);
});

ipcMain.handle("store:delete", (_, key: string) => {
  secureStore.delete(key);
});

ipcMain.handle("store:clear", () => {
  secureStore.clear();
});

ipcMain.handle("app:version", () => {
  return app.getVersion();
});

ipcMain.handle("app:quit", () => {
  app.quit();
});

ipcMain.handle("app:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("app:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("app:showMessageBox", async (_, options) => {
  if (!mainWindow) return { response: 0 };
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle("app:showSaveDialog", async (_, options) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle("app:showOpenDialog", async (_, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Import handlers
import { setupDatabaseHandlers } from "./handlers/database-handlers";
import { setupFileHandlers } from "./handlers/file-handlers";
import { setupAIHandlers } from "./handlers/ai-handlers";
import {
  setupMetricsHandlers,
  setupAlertHandlers,
  connectWebSocket,
  disconnectWebSocket,
} from "./handlers/metrics-handlers";

// Menu template
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "QueryFlux",
      submenu: [
        {
          label: "About QueryFlux",
          role: "about",
        },
        { type: "separator" },
        {
          label: "Preferences",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow?.webContents.send("menu:preferences");
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Connection",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("menu:new-connection");
          },
        },
        {
          label: "Open SQL File",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow?.webContents.send("menu:open-sql-file");
          },
        },
        {
          label: "Save Query",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow?.webContents.send("menu:save-query");
          },
        },
        { type: "separator" },
        {
          label: "Export Results",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow?.webContents.send("menu:export-results");
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" },
      ],
    },
    {
      label: "Database",
      submenu: [
        {
          label: "Execute Query",
          accelerator: "CmdOrCtrl+Enter",
          click: () => {
            mainWindow?.webContents.send("menu:execute-query");
          },
        },
        {
          label: "Explain Query",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => {
            mainWindow?.webContents.send("menu:explain-query");
          },
        },
        { type: "separator" },
        {
          label: "Refresh Schema",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow?.webContents.send("menu:refresh-schema");
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", role: "reload" },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          role: "forceReload",
        },
        {
          label: "Toggle Developer Tools",
          accelerator: "F12",
          role: "toggleDevTools",
        },
        { type: "separator" },
        { label: "Actual Size", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { type: "separator" },
        {
          label: "Toggle Fullscreen",
          accelerator: "F11",
          role: "togglefullscreen",
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", accelerator: "CmdOrCtrl+M", role: "minimize" },
        { label: "Close", accelerator: "CmdOrCtrl+W", role: "close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: async () => {
            await shell.openExternal("https://docs.queryflux.com");
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            await shell.openExternal(
              "https://github.com/queryflux/queryflux/issues",
            );
          },
        },
        {
          label: "Keyboard Shortcuts",
          accelerator: "F1",
          click: () => {
            mainWindow?.webContents.send("menu:shortcuts");
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

// App event handlers
app.whenReady().then(async () => {
  try {
    // Initialize security configuration first
    SecurityConfig.initialize();
    SecurityConfig.setupSecureUpdater();
    SecurityConfig.configureSecureIPC();

    // Initialize production secure storage
    await initializeSecureStorage();

    // Initialize LemonSqueezy service
    await initializeLemonSqueezy();

    // Set app user model id for windows
    electronApp.setAppUserModelId("com.queryflux.desktop");

    // Set up IPC handlers
    setupDatabaseHandlers();
    setupFileHandlers();
    setupAIHandlers();
    setupMetricsHandlers();
    setupAlertHandlers();

    // Default open or close DevTools by F12 in development
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    createWindow();
    Menu.setApplicationMenu(createMenu());

    app.on("activate", function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error("Failed to initialize application:", error);
    dialog.showErrorBox(
      "Initialization Failed",
      "Failed to initialize QueryFlux. Please check the logs for details.",
    );
    app.quit();
  }
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  // On macOS it's common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Security: prevent new window creation
app.on("web-contents-created", (_, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle external links
app.on("open-url", (event, url) => {
  event.preventDefault();
  shell.openExternal(url);
});

// Clean up before quitting
app.on("before-quit", async () => {
  isQuitting = true;

  // Disconnect WebSocket
  disconnectWebSocket();

  // Clean up LemonSqueezy service
  lemonSqueezyService.destroy();

  // Clean up native features
  if (keyboardShortcuts) {
    keyboardShortcuts.destroy();
  }

  if (systemTray) {
    systemTray.destroy();
  }

  // Close all database connections
  const { connectionManager } = await import("./database/connection-manager");
  const connections = connectionManager.getAllConnections();

  for (const connection of connections) {
    try {
      await connectionManager.disconnect(connection.id);
    } catch (error) {
      console.error(`Error disconnecting ${connection.id}:`, error);
    }
  }

  // Clean up logger
  const { logger } = await import("./utils/logger");
  logger.cleanupOldLogs();

  console.log("Application quitting...");
});

export { mainWindow, secureStore };
