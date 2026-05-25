/**
 * 🌙 LunaForge Telemetry Service
 *
 * Provides error tracking and analytics using Sentry.
 * Ensures user privacy while helping us improve the extension.
 */

import * as Sentry from "@sentry/node";
import * as vscode from "vscode";

export interface TelemetryConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
}

export interface TelemetryEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, unknown>;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private config: TelemetryConfig;
  private context: vscode.ExtensionContext;
  private isEnabled: boolean = false;
  private userId: string | null = null;

  private constructor(config: TelemetryConfig, context: vscode.ExtensionContext) {
    this.config = config;
    this.context = context;
  }

  public static getInstance(config?: TelemetryConfig, context?: vscode.ExtensionContext): TelemetryService {
    if (!TelemetryService.instance) {
      if (!config || !context) {
        throw new Error('TelemetryService requires config and context for first initialization');
      }
      TelemetryService.instance = new TelemetryService(config, context);
    }
    return TelemetryService.instance;
  }

  /**
   * Initialize the telemetry service
   */
  public async initialize(): Promise<void> {
    // Check if telemetry is disabled in settings
    const disableTelemetry = vscode.workspace.getConfiguration('lunaforge').get<boolean>('disableTelemetry', false);

    if (disableTelemetry) {
      console.log('Telemetry is disabled by user settings');
      return;
    }

    // Don't initialize in development or test mode
    if (this.config.environment === 'development' || vscode.env.extensionMode === vscode.ExtensionMode.Development) {
      console.log('Telemetry disabled in development mode');
      return;
    }

    // Don't initialize if no DSN is provided
    if (!this.config.dsn || this.config.dsn === 'https://examplePublicKey@o0.ingest.sentry.io/0') {
      console.log('No Sentry DSN provided, telemetry disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release || vscode.extensions.getExtension('FinsavvyTechnologies.lunaforge')?.packageJSON.version,
        sampleRate: this.config.sampleRate || 0.1, // 10% of errors
        tracesSampleRate: this.config.tracesSampleRate || 0.05, // 5% of transactions
        beforeSend: this.filterSensitiveData.bind(this),
        beforeBreadcrumb: this.filterBreadcrumb.bind(this),
        integrations: [
          new Sentry.Integrates.InboundFilters(),
          new Sentry.Integrates.FunctionToString(),
          new Sentry.Integrates.LinkedErrors(),
          new Sentry.Integrates.HttpContext(),
        ],
        initialScope: {
          tags: {
            extension: 'lunaforge',
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            vscodeVersion: vscode.version
          }
        }
      });

      // Get or create anonymous user ID
      this.userId = await this.getOrCreateUserId();

      // Set user context
      Sentry.setUser({
        id: this.userId,
        ipAddress: '{{auto}}' // Sentry will redact this
      });

      this.isEnabled = true;
      console.log('Telemetry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize telemetry:', error);
    }
  }

  /**
   * Capture an error
   */
  public captureError(error: Error, context?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      Sentry.captureException(error);
    });
  }

  /**
   * Capture a message
   */
  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isEnabled) return;

    Sentry.captureMessage(message, { level });
  }

  /**
   * Track a telemetry event
   */
  public trackEvent(event: TelemetryEvent): void {
    if (!this.isEnabled) return;

    // Add event as a breadcrumb for context
    Sentry.addBreadcrumb({
      category: event.category,
      message: event.action,
      data: {
        label: event.label,
        value: event.value,
        ...event.properties
      },
      level: 'info'
    });
  }

  /**
   * Set user context
   */
  public setUser(user: { id?: string; email?: string; plan?: string }): void {
    if (!this.isEnabled) return;

    Sentry.setUser({
      id: user.id || this.userId || undefined,
      email: user.email, // Sentry will hash emails
      plan: user.plan
    });
  }

  /**
   * Add a breadcrumb for context
   */
  public addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info'
    });
  }

  /**
   * Disable telemetry
   */
  public disable(): void {
    this.isEnabled = false;
    Sentry.close().catch(console.error);
  }

  /**
   * Enable telemetry
   */
  public async enable(): Promise<void> {
    if (!this.isEnabled) {
      await this.initialize();
    }
  }

  /**
   * Check if telemetry is enabled
   */
  public active(): boolean {
    return this.isEnabled;
  }

  // Private helper methods

  private async getOrCreateUserId(): Promise<string> {
    // Check if we already have a user ID
    let userId = this.context.globalState.get<string>('telemetry.userId');

    if (!userId) {
      // Generate a new anonymous user ID
      userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.context.globalState.update('telemetry.userId', userId);
    }

    return userId;
  }

  /**
   * Filter out sensitive data before sending to Sentry
   */
  private filterSensitiveData(event: Sentry.Event): Sentry.Event | null {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['x-api-key'];
      delete event.request.headers['cookie'];
    }

    // Remove sensitive query parameters
    if (event.request?.query_string) {
      event.request.query_string = event.request.query_string
        .split('&')
        .filter(param => !param.toLowerCase().includes('token') && !param.toLowerCase().includes('key') && !param.toLowerCase().includes('secret'))
        .join('&');
    }

    // Filter user data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Remove sensitive data from extra
    if (event.extra) {
      Object.keys(event.extra).forEach(key => {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
          delete event.extra[key];
        }
      });
    }

    return event;
  }

  /**
   * Filter breadcrumbs to remove sensitive information
   */
  private filterBreadcrumb(breadcrumb: Sentry.Breadcrumb, hint?: Sentry.BreadcrumbHint): Sentry.Breadcrumb | null {
    // Remove breadcrumbs with sensitive data
    if (breadcrumb.message && (
      breadcrumb.message.includes('api_key') ||
      breadcrumb.message.includes('secret') ||
      breadcrumb.message.includes('password') ||
      breadcrumb.message.includes('token')
    )) {
      return null;
    }

    if (breadcrumb.data) {
      Object.keys(breadcrumb.data).forEach(key => {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password')) {
          delete breadcrumb.data![key];
        }
      });
    }

    return breadcrumb;
  }
}

/**
 * Create a telemetry service instance
 */
export function createTelemetryService(config: TelemetryConfig, context: vscode.ExtensionContext): TelemetryService {
  return TelemetryService.getInstance(config, context);
}
