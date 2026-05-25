/**
 * Main Process for QueryFlux Electron App
 * Enhanced with real database connectivity
 */

import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import { join } from "path";
import { format } from "util";
import fs from "fs/promises";
import DatabaseManager from "./database-manager";

// Keep a global reference to
