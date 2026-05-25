import { globalShortcut, BrowserWindow, app } from 'electron';
import { logger } from '../utils/logger';

export class KeyboardShortcuts {
  private mainWindow: BrowserWindow | null = null;
  private shortcuts: Map<string, string> = new Map();

  constructor() {
    this.registerGlobalShortcuts();
    this.setupAppShortcuts();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private registerGlobalShortcuts(): void {
    const shortcuts = [
      {
        accelerator: 'CmdOrCtrl+Shift+Q',
        action: 'toggle-quick-query',
        description: 'Toggle Quick Query Window'
      },
      {
        accelerator: 'CmdOrCtrl+Shift+A',
        action: 'toggle-ai-assistant',
        description: 'Toggle AI Assistant'
      },
      {
        accelerator: 'CmdOrCtrl+Shift+C',
        action: 'connection-manager',
        description: 'Open Connection Manager'
      },
      {
        accelerator: 'CmdOrCtrl+Shift+H',
        action: 'query-history',
        description: 'Open Query History'
      },
      {
        accelerator: 'CmdOrCtrl+Shift+S',
        action: 'save-query',
        description: 'Save Current Query'
      }
    ];

    shortcuts.forEach(({ accelerator, action, description }) => {
      try {
        const success = globalShortcut.register(accelerator, () => {
          this.handleGlobalShortcut(action);
        });

        if (success) {
          this.shortcuts.set(accelerator, action);
          logger.debug('Global shortcut registered', { accelerator, description });
        } else {
          logger.warn('Failed to register global shortcut', { accelerator, description });
        }

      } catch (error) {
        logger.error('Error registering global shortcut', { accelerator, error });
      }
    });
  }

  private setupAppShortcuts(): void {
    // These are handled by the menu system, but we log them for completeness
    const appShortcuts = [
      { accelerator: 'CmdOrCtrl+N', action: 'new-connection', description: 'New Connection' },
      { accelerator: 'CmdOrCtrl+O', action: 'open-file', description: 'Open SQL File' },
      { accelerator: 'CmdOrCtrl+S', action: 'save-query', description: 'Save Query' },
      { accelerator: 'CmdOrCtrl+Enter', action: 'execute-query', description: 'Execute Query' },
      { accelerator: 'CmdOrCtrl+Shift+E', action: 'explain-query', description: 'Explain Query' },
      { accelerator: 'CmdOrCtrl+K', action: 'ai-assistant', description: 'AI Assistant' },
      { accelerator: 'CmdOrCtrl+,', action: 'preferences', description: 'Preferences' },
      { accelerator: 'F1', action: 'shortcuts-help', description: 'Keyboard Shortcuts Help' }
    ];

    logger.debug('Application shortcuts configured', { count: appShortcuts.length });
  }

  private handleGlobalShortcut(action: string): void {
    logger.debug('Global shortcut triggered', { action });

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      logger.warn('No main window available for global shortcut', { action });
      return;
    }

    // Focus the window first
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.show();
    this.mainWindow.focus();

    // Send action to renderer
    this.mainWindow.webContents.send('global-shortcut', { action });

    // Handle specific actions
    switch (action) {
      case 'toggle-quick-query':
        this.mainWindow.webContents.send('menu:quick-query');
        break;
      case 'toggle-ai-assistant':
        this.mainWindow.webContents.send('menu:ai-assistant');
        break;
      case 'connection-manager':
        this.mainWindow.webContents.send('menu:connection-manager');
        break;
      case 'query-history':
        this.mainWindow.webContents.send('menu:query-history');
        break;
      case 'save-query':
        this.mainWindow.webContents.send('menu:save-query');
        break;
    }
  }

  // Register custom shortcut
  registerCustomShortcut(accelerator: string, action: string, description: string): boolean {
    try {
      const success = globalShortcut.register(accelerator, () => {
        this.handleGlobalShortcut(action);
      });

      if (success) {
        this.shortcuts.set(accelerator, action);
        logger.info('Custom shortcut registered', { accelerator, action, description });
      } else {
        logger.warn('Failed to register custom shortcut', { accelerator, action });
      }

      return success;

    } catch (error) {
      logger.error('Error registering custom shortcut', { accelerator, error });
      return false;
    }
  }

  // Unregister shortcut
  unregisterShortcut(accelerator: string): void {
    globalShortcut.unregister(accelerator);
    this.shortcuts.delete(accelerator);
    logger.debug('Shortcut unregistered', { accelerator });
  }

  // Get all registered shortcuts
  getRegisteredShortcuts(): Array<{ accelerator: string; action: string; isGlobal: boolean }> {
    const shortcuts: Array<{ accelerator: string; action: string; isGlobal: boolean }> = [];

    this.shortcuts.forEach((action, accelerator) => {
      shortcuts.push({ accelerator, action, isGlobal: true });
    });

    // Add app shortcuts (from menu)
    const appShortcuts = [
      { accelerator: 'CmdOrCtrl+N', action: 'new-connection', isGlobal: false },
      { accelerator: 'CmdOrCtrl+O', action: 'open-file', isGlobal: false },
      { accelerator: 'CmdOrCtrl+S', action: 'save-query', isGlobal: false },
      { accelerator: 'CmdOrCtrl+Enter', action: 'execute-query', isGlobal: false },
      { accelerator: 'CmdOrCtrl+Shift+E', action: 'explain-query', isGlobal: false },
      { accelerator: 'CmdOrCtrl+K', action: 'ai-assistant', isGlobal: false },
      { accelerator: 'CmdOrCtrl+,', action: 'preferences', isGlobal: false },
      { accelerator: 'F1', action: 'shortcuts-help', isGlobal: false }
    ];

    shortcuts.push(...appShortcuts);

    return shortcuts;
  }

  // Show shortcuts help
  showShortcutsHelp(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const shortcuts = this.getRegisteredShortcuts();
    const helpText = this.formatShortcutsHelp(shortcuts);

    this.mainWindow.webContents.send('shortcuts-help', { shortcuts, helpText });
    logger.debug('Shortcuts help displayed');
  }

  private formatShortcutsHelp(shortcuts: Array<{ accelerator: string; action: string; isGlobal: boolean }>): string {
    const globalShortcuts = shortcuts.filter(s => s.isGlobal);
    const appShortcuts = shortcuts.filter(s => !s.isGlobal);

    let text = 'QueryFlux Keyboard Shortcuts\\n\\n';

    if (appShortcuts.length > 0) {
      text += 'Application Shortcuts:\\n';
      appShortcuts.forEach(({ accelerator, action }) => {
        text += `  ${accelerator} - ${this.getActionDescription(action)}\\n`;
      });
      text += '\\n';
    }

    if (globalShortcuts.length > 0) {
      text += 'Global Shortcuts (work anywhere):\\n';
      globalShortcuts.forEach(({ accelerator, action }) => {
        text += `  ${accelerator} - ${this.getActionDescription(action)}\\n`;
      });
    }

    return text;
  }

  private getActionDescription(action: string): string {
    const descriptions: Record<string, string> = {
      'new-connection': 'New Connection',
      'open-file': 'Open SQL File',
      'save-query': 'Save Query',
      'execute-query': 'Execute Query',
      'explain-query': 'Explain Query',
      'ai-assistant': 'AI Assistant',
      'preferences': 'Preferences',
      'shortcuts-help': 'Keyboard Shortcuts Help',
      'toggle-quick-query': 'Toggle Quick Query',
      'toggle-ai-assistant': 'Toggle AI Assistant',
      'connection-manager': 'Connection Manager',
      'query-history': 'Query History'
    };

    return descriptions[action] || action;
  }

  // Check if shortcut is available
  isShortcutAvailable(accelerator: string): boolean {
    return !globalShortcut.isRegistered(accelerator);
  }

  // Update shortcuts when main window changes
  updateMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    logger.debug('Main window updated for shortcuts');
  }

  // Clean up all shortcuts
  destroy(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
    logger.info('All keyboard shortcuts unregistered');
  }
}