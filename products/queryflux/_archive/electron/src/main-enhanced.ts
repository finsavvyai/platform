/**
 * Enhanced Main Process for QueryFlux Electron App
 * Real database connectivity with comprehensive features
 */

import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import { join } from "path";
import { format } from "util";
import fs from "fs/promises";
import DatabaseManager from "./database-manager";

// Keep a global reference of the window object and database manager
let mainWindow: BrowserWindow | null = null;
let databaseManager: DatabaseManager | null = null;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "./preload.js"),
      webSecurity: process.env.NODE_ENV !== "development"
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false, // Show after load
  });

  // Load the app
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();

    if (process.env.NODE_ENV === "development") {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Setup menu
  setupMenu();
}

function setupMenu(): void {
  const template: any[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Connection",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("menu-new-connection");
          }
        },
        {
          label: "Open Query",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow?.webContents.send("menu-open-file");
          }
        },
        {
          label: "Save Query",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow?.webContents.send("menu-save-query");
          }
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: "Database",
      submenu: [
        {
          label: "Connect",
          accelerator: "CmdOrCtrl+K",
          click: () => {
            mainWindow?.webContents.send("menu-connect");
          }
        },
        {
          label: "Disconnect",
          accelerator: "CmdOrCtrl+Shift+K",
          click: () => {
            mainWindow?.webContents.send("menu-disconnect");
          }
        },
        { type: "separator" },
        {
          label: "Refresh Schema",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow?.webContents.send("menu-refresh-schema");
          }
        },
        {
          label: "Execute Query",
          accelerator: "CmdOrCtrl+Enter",
          click: () => {
            mainWindow?.webContents.send("menu-execute-query");
          }
        }
      ]
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => {
            mainWindow?.webContents.send("global-shortcut-command-palette");
          }
        },
        { type: "separator" },
        {
          label: "Developer Tools",
          accelerator: "F12",
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About QueryFlux",
          click: async () => {
            await dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "About QueryFlux",
              message: "QueryFlux",
              detail: `Version ${app.getVersion()}\nA modern database management platform\n\nBuilt with Electron, React, and TypeScript\n\nNow with real database connectivity!`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Initialize database manager
    console.log("Initializing database manager...");
    databaseManager = new DatabaseManager();

    // Set up IPC handlers
    console.log("Setting up IPC handlers...");
    setupIPCHandlers();

    // Create window
    console.log("Creating main window...");
    createWindow();

    console.log("QueryFlux with real database connectivity initialized successfully!");

    // Set up app event handlers
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    app.on("before-quit", async () => {
      console.log("Shutting down database connections...");
      if (databaseManager) {
        await databaseManager.shutdown();
      }
    });
  } catch (error) {
    console.error("Failed to initialize app:", error);

    // Show error dialog
    dialog.showErrorBox(
      "Initialization Error",
      `Failed to initialize QueryFlux: ${(error as Error).message}`
    );

    app.quit();
  }
});

function setupIPCHandlers(): void {
  if (!databaseManager) {
    console.error("Database manager not initialized");
    return;
  }

  console.log("Setting up IPC handlers for database operations...");

  // Application handlers
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:get-name", () => app.getName());
  ipcMain.handle("app:get-platform", () => process.platform);

  ipcMain.handle("app:show-message-box", async (_, options) => {
    const result = await dialog.showMessageBox(mainWindow!, options);
    return result;
  });

  ipcMain.handle("app:show-error-box", (_, title, content) => {
    dialog.showErrorBox(title, content);
  });

  ipcMain.handle("app:open-external", async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle("app:show-item-in-folder", async (_, path: string) => {
    shell.showItemInFolder(path);
  });

  // Database handlers
  ipcMain.handle("db:get-types", async () => {
    if (!databaseManager) return [];
    try {
      return databaseManager.getAvailableTypes();
    } catch (error) {
      console.error("Error getting database types:", error);
      return [];
    }
  });

  ipcMain.handle("db:test-connection", async (_, config) => {
    if (!databaseManager) return { success: false, error: "Database manager not initialized" };
    try {
      console.log("Testing connection to:", config.type, config.host);
      return await databaseManager.testConnection(config);
    } catch (error) {
      console.error("Connection test failed:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("db:connect", async (_, config, name) => {
    if (!databaseManager) return { connectionId: "", error: "Database manager not initialized" };
    try {
      console.log("Connecting to:", config.type, config.host);
      return await databaseManager.connect(config, name);
    } catch (error) {
      console.error("Connection failed:", error);
      return { connectionId: "", error: (error as Error).message };
    }
  });

  ipcMain.handle("db:disconnect", async (_, connectionId) => {
    if (!databaseManager) return { success: false, error: "Database manager not initialized" };
    try {
      console.log("Disconnecting:", connectionId);
      return await databaseManager.disconnect(connectionId);
    } catch (error) {
      console.error("Disconnect failed:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("db:get-connections", async () => {
    if (!databaseManager) return [];
    try {
      return databaseManager.getActiveConnections();
    } catch (error) {
      console.error("Error getting connections:", error);
      return [];
    }
  });

  ipcMain.handle("db:execute-query", async (_, connectionId, query, options) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      console.log("Executing query on connection:", connectionId);
      return await databaseManager.executeQuery(connectionId, query, options);
    } catch (error) {
      console.error("Query execution failed:", error);
      throw error;
    }
  });

  ipcMain.handle("db:validate-query", async (_, connectionId, query) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.validateQuery(connectionId, query);
    } catch (error) {
      console.error("Query validation failed:", error);
      throw error;
    }
  });

  ipcMain.handle("db:explain-query", async (_, connectionId, query, collection) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.explainQuery(connectionId, query, collection);
    } catch (error) {
      console.error("Query explanation failed:", error);
      throw error;
    }
  });

  ipcMain.handle("db:get-query-suggestions", async (_, connectionId, partialQuery, context) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.getQuerySuggestions(connectionId, partialQuery, context);
    } catch (error) {
      console.error("Error getting query suggestions:", error);
      return [];
    }
  });

  ipcMain.handle("db:get-info", async (_, connectionId) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.getInfo(connectionId);
    } catch (error) {
      console.error("Error getting database info:", error);
      throw error;
    }
  });

  ipcMain.handle("db:list-collections", async (_, connectionId) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.listCollections(connectionId);
    } catch (error) {
      console.error("Error listing collections:", error);
      throw error;
    }
  });

  ipcMain.handle("db:get-collection-info", async (_, connectionId, collectionName) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.getCollectionInfo(connectionId, collectionName);
    } catch (error) {
      console.error("Error getting collection info:", error);
      throw error;
    }
  });

  ipcMain.handle("db:get-sample-data", async (_, connectionId, collectionName, limit) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.getSampleData(connectionId, collectionName, limit);
    } catch (error) {
      console.error("Error getting sample data:", error);
      throw error;
    }
  });

  ipcMain.handle("db:get-performance-stats", async (_, connectionId) => {
    if (!databaseManager) throw new Error("Database manager not initialized");
    try {
      return await databaseManager.getPerformanceStats(connectionId);
    } catch (error) {
      console.error("Error getting performance stats:", error);
      throw error;
    }
  });

  // Saved connections
  ipcMain.handle("db:save-connection", async (_, config, name, overwrite) => {
    if (!databaseManager) return { success: false, error: "Database manager not initialized" };
    try {
      return await databaseManager.saveConnection(config, name, overwrite);
    } catch (error) {
      console.error("Error saving connection:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("db:get-saved-connections", async () => {
    if (!databaseManager) return [];
    try {
      return databaseManager.getSavedConnections();
    } catch (error) {
      console.error("Error getting saved connections:", error);
      return [];
    }
  });

  ipcMain.handle("db:delete-saved-connection", async (_, connectionId) => {
    if (!databaseManager) return { success: false, error: "Database manager not initialized" };
    try {
      return await databaseManager.deleteSavedConnection(connectionId);
    } catch (error) {
      console.error("Error deleting saved connection:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // File operations
  ipcMain.handle("file:read", async (_, filePath) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, content };
    } catch (error) {
      console.error("Error reading file:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("file:write", async (_, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true };
    } catch (error) {
      console.error("Error writing file:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("file:show-open-dialog", async (_, options) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, options);
      return result;
    } catch (error) {
      console.error("Error showing open dialog:", error);
      return { canceled: true, filePaths: [] };
    }
  });

  ipcMain.handle("file:show-save-dialog", async (_, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, options);
      return result;
    } catch (error) {
      console.error("Error showing save dialog:", error);
      return { canceled: true, filePath: "" };
    }
  });

  // Log database manager events for debugging
  databaseManager.on("connection:connected", (data) => {
    console.log("✅ Connection connected:", data);
    mainWindow?.webContents.send("connection:connected", data);
  });

  databaseManager.on("connection:disconnected", (data) => {
    console.log("🔌 Connection disconnected:", data);
    mainWindow?.webContents.send("connection:disconnected", data);
  });

  databaseManager.on("connection:error", (data) => {
    console.error("❌ Connection error:", data);
    mainWindow?.webContents.send("connection:error", data);
  });

  databaseManager.on("connection:query", (data) => {
    console.log("🔍 Query executed:", data);
    mainWindow?.webContents.send("connection:query", data);
  });

  console.log("✅ IPC handlers set up successfully!");
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  dialog.showErrorBox("Uncaught Exception", error.message);
  app.quit();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  dialog.showErrorBox("Unhandled Rejection", String(reason));
});
