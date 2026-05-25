/**
 * Local ambient declaration for @finsavvyai/monitor.
 *
 * The upstream package at portfolio/packages/monitor imports @sentry/node
 * directly (not behind a declared module) and doesn't ship a built dist/,
 * so its types can't be resolved from this workspace. Declaring the
 * subset of the API we use here keeps the realtime service typecheck
 * independent of the upstream package state.
 */
declare module '@finsavvyai/monitor' {
  export interface LoggerOptions {
    name?: string;
    level?: string;
    maskSensitiveFields?: boolean;
  }

  export interface Logger {
    error(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
  }

  export function createLogger(options?: LoggerOptions): Logger;
}
