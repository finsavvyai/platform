/**
 * Notification management for LunaForge UI
 */

import * as vscode from 'vscode';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: NotificationAction[];
  timestamp: number;
  autoHide?: boolean;
  persistent?: boolean;
  source?: string;
}

export interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
}

export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('LunaForge');
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for lifecycle management
   */
  private setupEventHandlers(): void {
    // Clean up notifications on workspace changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.clearNotifications('source', 'workspace');
      })
    );
  }

  /**
   * Show a notification
   */
  public show(notification: Omit<Notification, 'id' | 'timestamp'>): string {
    const id = this.generateId();
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now()
    };

    this.notifications.set(id, fullNotification);

    // Log to output channel
    this.logToOutput(fullNotification);

    // Show in VS Code UI
    this.showInVSCode(fullNotification);

    // Auto-hide if specified
    if (notification.autoHide !== false) {
      setTimeout(() => {
        this.hide(id);
      }, this.getAutoHideDelay(notification.type));
    }

    return id;
  }

  /**
   * Show info notification
   */
  public info(title: string, message: string, actions?: NotificationAction[]): string {
    return this.show({
      type: 'info',
      title,
      message,
      actions
    });
  }

  /**
   * Show success notification
   */
  public success(title: string, message: string, actions?: NotificationAction[]): string {
    return this.show({
      type: 'success',
      title,
      message,
      actions
    });
  }

  /**
   * Show warning notification
   */
  public warning(title: string, message: string, actions?: NotificationAction[]): string {
    return this.show({
      type: 'warning',
      title,
      message,
      actions,
      autoHide: false
    });
  }

  /**
   * Show error notification
   */
  public error(title: string, message: string, actions?: NotificationAction[]): string {
    return this.show({
      type: 'error',
      title,
      message,
      actions,
      autoHide: false,
      persistent: true
    });
  }

  /**
   * Hide a specific notification
   */
  public hide(id: string): void {
    this.notifications.delete(id);
  }

  /**
   * Clear notifications by type or source
   */
  public clearNotifications(filter?: 'type' | 'source' | 'all', value?: string): void {
    if (!filter || filter === 'all') {
      this.notifications.clear();
      return;
    }

    for (const [id, notification] of this.notifications) {
      if (notification[filter] === value) {
        this.notifications.delete(id);
      }
    }
  }

  /**
   * Get all notifications
   */
  public getNotifications(): Notification[] {
    return Array.from(this.notifications.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get notifications by type
   */
  public getNotificationsByType(type: Notification['type']): Notification[] {
    return this.getNotifications().filter(n => n.type === type);
  }

  /**
   * Check if there are any unread notifications
   */
  public hasUnreadNotifications(): boolean {
    return this.notifications.size > 0;
  }

  /**
   * Show notification in VS Code UI
   */
  private showInVSCode(notification: Notification): void {
    const message = `${notification.title}: ${notification.message}`;
    const actions = notification.actions?.map(a => a.label) || [];

    const showMessage = {
      [NotificationType.INFO]: vscode.window.showInformationMessage,
      [NotificationType.SUCCESS]: vscode.window.showInformationMessage,
      [NotificationType.WARNING]: vscode.window.showWarningMessage,
      [NotificationType.ERROR]: vscode.window.showErrorMessage
    }[notification.type];

    if (actions.length > 0) {
      showMessage(message, ...actions).then((selectedAction) => {
        if (selectedAction && notification.actions) {
          const action = notification.actions.find(a => a.label === selectedAction);
          if (action) {
            this.handleAction(action.action, notification);
          }
        }
      });
    } else {
      showMessage(message);
    }
  }

  /**
   * Handle notification action
   */
  private handleAction(action: string, notification: Notification): void {
    switch (action) {
      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'lunaforge');
        break;
      case 'openDocs':
        vscode.env.openExternal(vscode.Uri.parse('https://docs.lunaforge.io'));
        break;
      case 'reloadWindow':
        vscode.commands.executeCommand('workbench.action.reloadWindow');
        break;
      case 'showOutput':
        this.outputChannel.show();
        break;
      case 'dismiss':
        this.hide(notification.id);
        break;
      case 'openControlCenter':
        vscode.commands.executeCommand('lunaforge.openControlCenter');
        break;
      case 'showCommandPalette':
        vscode.commands.executeCommand('lunaforge.showCommandPalette');
        break;
      case 'buildGraph':
        vscode.commands.executeCommand('lunaforge.buildGraph');
        break;
      case 'startTour':
        vscode.commands.executeCommand('lunaforge.startTour');
        break;
      case 'openSampleProject':
        vscode.commands.executeCommand('lunaforge.openSampleProject');
        break;
      case 'retryInit':
        // This will be handled by the extension activation
        vscode.commands.executeCommand('workbench.action.reloadWindow');
        break;
      case 'openSupport':
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/lunaforge/lunaforge/issues'));
        break;
      default:
        // Try to execute as a command if it starts with 'lunaforge.'
        if (action.startsWith('lunaforge.')) {
          vscode.commands.executeCommand(action).then(undefined, (err: any) => {
            console.error(`Failed to execute command ${action}:`, err);
          });
        } else {
          console.log('Unknown notification action:', action);
        }
    }
  }

  /**
   * Show the output channel
   */
  public showOutputChannel(): void {
    this.outputChannel.show();
  }

  /**
   * Log notification to output channel
   */
  private logToOutput(notification: Notification): void {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      [NotificationType.INFO]: 'ℹ️',
      [NotificationType.SUCCESS]: '✅',
      [NotificationType.WARNING]: '⚠️',
      [NotificationType.ERROR]: '❌'
    }[notification.type];

    this.outputChannel.appendLine(
      `[${timestamp}] ${emoji} ${notification.title}`
    );
    this.outputChannel.appendLine(`  ${notification.message}`);

    if (notification.source) {
      this.outputChannel.appendLine(`  Source: ${notification.source}`);
    }

    this.outputChannel.appendLine('');
  }

  /**
   * Get auto-hide delay for notification type
   */
  private getAutoHideDelay(type: Notification['type']): number {
    const delays = {
      [NotificationType.INFO]: 5000,
      [NotificationType.SUCCESS]: 4000,
      [NotificationType.WARNING]: 8000,
      [NotificationType.ERROR]: 0 // Never auto-hide errors
    };

    return delays[type];
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.outputChannel.dispose();
    this.notifications.clear();
  }
}

// Enum for notification types
enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// Singleton instance for global access
let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}