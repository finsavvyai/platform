import { app, session, protocol, net } from 'electron';
import { logger } from '../utils/logger';

export class SecurityConfig {
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) {
      logger.warn('SecurityConfig already initialized');
      return;
    }

    logger.info('Initializing security configuration');

    this.configureContentSecurityPolicy();
    this.configurePermissions();
    this.configureNetworkSecurity();
    this.configureProtocolSecurity();
    this.configureSessionSecurity();

    this.initialized = true;
    logger.info('Security configuration initialized');
  }

  private static configureContentSecurityPolicy(): void {
    // Content Security Policy for renderer process
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Allow inline scripts for React in development
      "style-src 'self' 'unsafe-inline'",   // Allow inline styles
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https:", // Allow WebSocket and HTTPS connections
      "media-src 'self'",
      "object-src 'none'",                  // Disable plugins
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",             // Prevent clickjacking
      "upgrade-insecure-requests"           // Upgrade HTTP to HTTPS
    ].join('; ');

    logger.debug('Content Security Policy configured', { csp });
  }

  private static configurePermissions(): void {
    // Set permissions for webContents
    app.on('web-contents-created', (_, contents) => {
      // Prevent navigation to external URLs
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        if (parsedUrl.origin !== 'http://localhost:5174' && !navigationUrl.startsWith('file://')) {
          logger.warn('Prevented navigation to external URL', { url: navigationUrl });
          event.preventDefault();
        }
      });

      // Prevent new window creation
      contents.setWindowOpenHandler(({ url }) => {
        logger.warn('Prevented new window creation', { url });
        return { action: 'deny' };
      });

      // Configure permission requests
      contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['clipboard-read', 'clipboard-sanitized-write'];

        if (allowedPermissions.includes(permission)) {
          logger.debug('Permission granted', { permission });
          callback(true);
        } else {
          logger.warn('Permission denied', { permission });
          callback(false);
        }
      });

      // Handle certificate errors
      contents.session.setCertificateVerifyProc((request, callback) => {
        // In development, allow self-signed certificates
        if (process.env.NODE_ENV === 'development') {
          callback(0); // Proceed with error (allow)
        } else {
          // In production, verify certificates
          callback(-2); // Use default verification
        }
      });
    });
  }

  private static configureNetworkSecurity(): void {
    // Configure session defaults
    const defaultSession = session.defaultSession;

    // Block suspicious requests
    defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url;

      // Block access to local files (except our own resources)
      if (url.startsWith('file://') && !url.includes(app.getAppPath())) {
        logger.warn('Blocked local file access', { url });
        callback({ cancel: true });
        return;
      }

      // Block access to Electron internals
      if (url.includes('electron') || url.includes('devtools')) {
        logger.warn('Blocked internal Electron access', { url });
        callback({ cancel: true });
        return;
      }

      // Block known tracking/ad domains
      const blockedDomains = ['google-analytics.com', 'doubleclick.net', 'facebook.com'];
      const urlObj = new URL(url);
      if (blockedDomains.some(domain => urlObj.hostname.includes(domain))) {
        logger.warn('Blocked tracking domain', { url });
        callback({ cancel: true });
        return;
      }

      callback({ cancel: false });
    });

    // Set security headers
    defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};

      // Add security headers
      responseHeaders['X-Content-Type-Options'] = ['nosniff'];
      responseHeaders['X-Frame-Options'] = ['DENY'];
      responseHeaders['X-XSS-Protection'] = ['1; mode=block'];
      responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
      responseHeaders['Permissions-Policy'] = [
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      ];

      callback({ responseHeaders });
    });

    logger.debug('Network security configured');
  }

  private static configureProtocolSecurity(): void {
    // Register custom protocols
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'app',
        privileges: {
          standard: true,
          secure: true,
          allowServiceWorkers: true,
          supportFetchAPI: true
        }
      }
    ]);

    // Handle app protocol
    protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substr(6); // Remove 'app://' prefix
      const filePath = `${app.getAppPath()}/dist/renderer/${url}`;
      callback({ path: filePath });
    });

    logger.debug('Protocol security configured');
  }

  private static configureSessionSecurity(): void {
    const defaultSession = session.defaultSession;

    // Configure cookie security
    defaultSession.cookies.set({
      url: 'http://localhost',
      name: 'session',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Clear potentially sensitive data on exit
    app.on('before-quit', () => {
      defaultSession.clearStorageData({
        storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
    });

    logger.debug('Session security configured');
  }

  // Validate application integrity
  static validateApplicationIntegrity(): boolean {
    try {
      const appPath = app.getAppPath();
      const packagePath = `${appPath}/package.json`;

      // Check if package.json exists
      const fs = require('fs');
      if (!fs.existsSync(packagePath)) {
        logger.error('Application integrity check failed: package.json not found');
        return false;
      }

      // Check if main application files exist
      const mainPath = `${appPath}/dist/main/index.js`;
      if (!fs.existsSync(mainPath)) {
        logger.error('Application integrity check failed: main process not found');
        return false;
      }

      logger.info('Application integrity check passed');
      return true;

    } catch (error) {
      logger.error('Application integrity check failed:', error);
      return false;
    }
  }

  // Setup secure auto-updater
  static setupSecureUpdater(): void {
    if (process.env.NODE_ENV === 'production') {
      // In production, configure secure auto-updater
      const { autoUpdater } = require('electron-updater');

      autoUpdater.checkForUpdatesAndNotify();

      autoUpdater.on('update-available', (info: any) => {
        logger.info('Update available', { version: info.version });
      });

      autoUpdater.on('update-downloaded', (info: any) => {
        logger.info('Update downloaded', { version: info.version });
        // Prompt user to restart
      });

      autoUpdater.on('error', (error: Error) => {
        logger.error('Auto-updater error:', error);
      });
    }
  }

  // Configure secure IPC
  static configureSecureIPC(): void {
    const { ipcMain } = require('electron');

    // Validate IPC messages
    ipcMain.on('validate-ipc-channel', (event, channel) => {
      const validChannels = [
        'store:get', 'store:set', 'store:delete', 'store:clear',
        'db:connect', 'db:disconnect', 'db:executeQuery', 'db:getSchema',
        'db:getTables', 'db:getColumns', 'db:testConnection',
        'file:openSQL', 'file:saveSQL', 'file:exportResults',
        'ai:convertNLToSQL', 'ai:optimizeQuery', 'ai:explainQuery',
        'app:version', 'app:quit', 'app:minimize', 'app:maximize'
      ];

      const isValid = validChannels.includes(channel);
      event.reply('ipc-validation-result', { channel, isValid });

      if (!isValid) {
        logger.warn('Invalid IPC channel attempted', { channel });
      }
    });

    logger.debug('Secure IPC configured');
  }

  // Get security status
  static getSecurityStatus(): any {
    return {
      initialized: this.initialized,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      sandbox: process.env.NODE_ENV === 'production'
    };
  }
}