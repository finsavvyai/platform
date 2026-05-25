import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';
import { logger } from '../utils/logger';
import { connectionManager } from '../database/connection-manager';

export class SystemTray {
  private tray: Tray | null = null;
  private contextMenu: Menu | null = null;
  private connectionCount = 0;

  constructor() {
    this.createTray();
    this.setupEventListeners();
  }

  private createTray(): void {
    try {
      // Create tray icon
      const iconPath = this.getTrayIconPath();
      const icon = nativeImage.createFromPath(iconPath);

      // Resize icon for high DPI displays
      icon.setTemplateImage(true);

      this.tray = new Tray(icon);
      this.tray.setToolTip('QueryFlux - Database Management');

      this.createContextMenu();
      this.tray.setContextMenu(this.contextMenu!);

      logger.info('System tray created');

    } catch (error) {
      logger.error('Failed to create system tray:', error);
    }
  }

  private getTrayIconPath(): string {
    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';

    if (isMac) {
      // macOS uses template images
      return path.join(__dirname, '../../../resources/tray/mac/trayTemplate.png');
    } else if (isWindows) {
      // Windows uses colored icons
      return path.join(__dirname, '../../../resources/tray/windows/tray.ico');
    } else {
      // Linux uses standard PNG
      return path.join(__dirname, '../../../resources/tray/linux/tray.png');
    }
  }

  private createContextMenu(): void {
    const isMac = process.platform === 'darwin';

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'QueryFlux',
        enabled: false,
        icon: this.getAppIcon()
      },
      { type: 'separator' },
      {
        label: 'Show App',
        click: () => this.showMainWindow()
      },
      {
        label: 'Connections',
        submenu: [
          {
            label: `${this.connectionCount} Active`,
            enabled: false
          },
          { type: 'separator' },
          {
            label: 'New Connection',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.sendActionToRenderer('new-connection')
          },
          {
            label: 'Connection Manager',
            click: () => this.sendActionToRenderer('connection-manager')
          }
        ]
      },
      {
        label: 'Quick Actions',
        submenu: [
          {
            label: 'Execute Query',
            accelerator: 'CmdOrCtrl+Enter',
            click: () => this.sendActionToRenderer('execute-query')
          },
          {
            label: 'AI Assistant',
            accelerator: 'CmdOrCtrl+K',
            click: () => this.sendActionToRenderer('ai-assistant')
          },
          {
            label: 'Query History',
            accelerator: 'CmdOrCtrl+H',
            click: () => this.sendActionToRenderer('query-history')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: () => this.sendActionToRenderer('preferences')
      },
      {
        label: 'Check for Updates',
        click: () => this.checkForUpdates()
      },
      { type: 'separator' },
      {
        label: 'About QueryFlux',
        click: () => this.showAboutDialog()
      },
      {
        label: 'Quit',
        accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => app.quit()
      }
    ];

    this.contextMenu = Menu.buildFromTemplate(template);
  }

  private setupEventListeners(): void {
    // Update connection count periodically
    setInterval(() => {
      this.updateConnectionStatus();
    }, 5000);

    // Handle tray click
    this.tray?.on('click', () => {
      this.showMainWindow();
    });

    // Handle right-click (Windows/Linux)
    this.tray?.on('right-click', () => {
      this.tray?.popUpContextMenu();
    });
  }

  private showMainWindow(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    } else {
      // Create new window if none exists
      app.emit('activate');
    }

    logger.debug('Main window shown from tray');
  }

  private sendActionToRenderer(action: string): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tray:action', { action });
      this.showMainWindow();
    }

    logger.debug('Action sent from tray', { action });
  }

  private async updateConnectionStatus(): void {
    try {
      const connections = connectionManager.getAllConnections();
      const activeConnections = connections.filter(conn => conn.connected);
      const previousCount = this.connectionCount;
      this.connectionCount = activeConnections.length;

      // Update tray tooltip
      const status = this.connectionCount > 0
        ? `${this.connectionCount} active connection${this.connectionCount > 1 ? 's' : ''}`
        : 'No active connections';

      this.tray?.setToolTip(`QueryFlux - ${status}`);

      // Update context menu if connection count changed
      if (previousCount !== this.connectionCount) {
        this.createContextMenu();
        this.tray?.setContextMenu(this.contextMenu!);

        // Show notification if connections changed
        if (this.connectionCount > previousCount && previousCount === 0) {
          this.showNotification('Database Connected', 'Connection established successfully');
        } else if (this.connectionCount < previousCount) {
          this.showNotification('Database Disconnected', 'Connection closed');
        }

        logger.debug('Connection status updated', { count: this.connectionCount });
      }

    } catch (error) {
      logger.error('Failed to update connection status:', error);
    }
  }

  private showNotification(title: string, body: string): void {
    const { Notification } = require('electron');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        silent: true,
        icon: this.getNotificationIcon()
      });

      notification.on('click', () => {
        this.showMainWindow();
      });

      notification.show();
    }
  }

  private getNotificationIcon(): string {
    return path.join(__dirname, '../../../resources/icon.png');
  }

  private getAppIcon(): nativeImage {
    try {
      return nativeImage.createFromPath(
        path.join(__dirname, '../../../resources/icon.png')
      ).resize({ width: 16, height: 16 });
    } catch {
      return nativeImage.createEmpty();
    }
  }

  private showAboutDialog(): void {
    const { dialog } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];

    const message = `
QueryFlux - AI-Powered Database Management

Version: ${app.getVersion}
Platform: ${process.platform}
Architecture: ${process.arch}

Built with Electron, React, and TypeScript

© 2024 QueryFlux Team. All rights reserved.
    `.trim();

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'About QueryFlux',
      message: 'QueryFlux',
      detail: message,
      buttons: ['OK'],
      defaultId: 0
    });
  }

  private checkForUpdates(): void {
    if (process.env.NODE_ENV === 'production') {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify();
      this.showNotification('Update Check', 'Checking for updates...');
    } else {
      this.showNotification('Update Check', 'Updates are only available in production builds');
    }
  }

  // Update tray icon based on connection status
  updateConnectionStatusIcon(connected: boolean): void {
    try {
      const iconPath = connected
        ? this.getTrayIconPath().replace('.png', '-active.png')
        : this.getTrayIconPath();

      const icon = nativeImage.createFromPath(iconPath);
      icon.setTemplateImage(true);

      this.tray?.setImage(icon);

    } catch (error) {
      logger.error('Failed to update tray icon:', error);
    }
  }

  // Destroy tray
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    logger.info('System tray destroyed');
  }
}