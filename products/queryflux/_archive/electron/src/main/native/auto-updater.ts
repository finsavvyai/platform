import { autoUpdater, dialog, BrowserWindow, app } from 'electron-updater';
import { logger } from '../utils/logger';
import { platform } from 'os';

export class AutoUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable = false;

  constructor() {
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater settings
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';

    // Set up event listeners
    autoUpdater.on('checking-for-update', this.onCheckingForUpdate.bind(this));
    autoUpdater.on('update-available', this.onUpdateAvailable.bind(this));
    autoUpdater.on('update-not-available', this.onUpdateNotAvailable.bind(this));
    autoUpdater.on('error', this.onError.bind(this));
    autoUpdater.on('download-progress', this.onDownloadProgress.bind(this));
    autoUpdater.on('update-downloaded', this.onUpdateDownloaded.bind(this));

    logger.info('Auto-updater initialized');
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  checkForUpdates(): void {
    if (process.env.NODE_ENV === 'production') {
      logger.info('Checking for updates...');
      autoUpdater.checkForUpdatesAndNotify();
    } else {
      logger.info('Skipping update check in development mode');
      this.showUpdateDialog(
        'Update Check',
        'Update checks are disabled in development mode.\nUpdates will be available in production builds.'
      );
    }
  }

  private onCheckingForUpdate(): void {
    logger.info('Checking for updates...');
    this.sendUpdateStatusToRenderer('checking');
  }

  private onUpdateAvailable(info: any): void {
    this.updateAvailable = true;
    logger.info('Update available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });

    this.sendUpdateStatusToRenderer('available', info);

    // Show notification
    this.showUpdateNotification('Update Available', `Version ${info.version} is available for download`);
  }

  private onUpdateNotAvailable(info: any): void {
    logger.info('No update available', { currentVersion: info.version });
    this.sendUpdateStatusToRenderer('not-available', info);

    // Show dialog if user manually checked
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-check-result', {
        available: false,
        currentVersion: info.version
      });
    }
  }

  private onError(error: Error): void {
    logger.error('Auto-updater error:', error);
    this.sendUpdateStatusToRenderer('error', { error: error.message });

    // Show error dialog
    this.showUpdateDialog(
      'Update Error',
      `An error occurred while checking for updates:\n\n${error.message}`
    );
  }

  private onDownloadProgress(progressObj: any): void {
    const progress = Math.round(progressObj.percent);
    const transferred = Math.round(progressObj.transferred / 1024 / 1024);
    const total = Math.round(progressObj.total / 1024 / 1024);

    logger.debug('Download progress', { progress, transferred, total });

    this.sendUpdateStatusToRenderer('downloading', {
      progress,
      transferred,
      total
    });

    // Update progress in notification (macOS)
    if (process.platform === 'darwin') {
      app.setBadgeCount(progress);
    }
  }

  private onUpdateDownloaded(info: any): void {
    logger.info('Update downloaded', {
      version: info.version,
      path: info.downloadedFile
    });

    this.sendUpdateStatusToRenderer('downloaded', info);

    // Clear badge count
    if (process.platform === 'darwin') {
      app.setBadgeCount(0);
    }

    // Show installation dialog
    this.showInstallDialog(info);
  }

  private sendUpdateStatusToRenderer(status: string, info?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', {
        status,
        info,
        timestamp: Date.now()
      });
    }
  }

  private showUpdateNotification(title: string, body: string): void {
    const { Notification } = require('electron');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        silent: true,
        icon: this.getIconPath()
      });

      notification.on('click', () => {
        if (this.mainWindow) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });

      notification.show();
    }
  }

  private showUpdateDialog(title: string, message: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title,
      message: title,
      detail: message,
      buttons: ['OK'],
      defaultId: 0
    });
  }

  private showInstallDialog(info: any): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const options = {
      type: 'info' as const,
      title: 'Update Ready',
      message: 'Update Downloaded',
      detail: `Version ${info.version} has been downloaded. The application will restart to complete the update.`,
      buttons: ['Install Now', 'Install Later'] as const,
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Install now
        logger.info('User chose to install update immediately');
        autoUpdater.quitAndInstall();
      } else {
        // Install later
        logger.info('User chose to install update later');
        this.showUpdateNotification(
          'Update Ready',
          'The update will be installed when you quit the application'
        );
      }
    });
  }

  private getIconPath(): string {
    const path = require('path');
    return path.join(__dirname, '../../../resources/icon.png');
  }

  // Force install update (if downloaded)
  installUpdate(): void {
    if (this.updateAvailable) {
      logger.info('Forcing update installation');
      autoUpdater.quitAndInstall();
    } else {
      logger.warn('No update available to install');
    }
  }

  // Get current version
  getCurrentVersion(): string {
    return app.getVersion();
  }

  // Get update status
  getUpdateStatus(): any {
    return {
      updateAvailable: this.updateAvailable,
      currentVersion: this.getCurrentVersion(),
      platform: platform(),
      arch: process.arch
    };
  }

  // Disable auto-updater (for testing)
  disable(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    logger.info('Auto-updater disabled');
  }

  // Enable auto-updater
  enable(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    logger.info('Auto-updater enabled');
  }
}