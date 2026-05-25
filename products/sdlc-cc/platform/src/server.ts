import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './utils/logger';

const config = loadConfig();
const logger = createLogger(config);
const app = createApp(config);
const server = app.listen(config.port, config.host, () => {
  logger.info('SDLC platform API listening', {
    host: config.host,
    port: config.port,
    environment: config.env,
  });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.warn('Received shutdown signal', { signal });

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Forcing shutdown after timeout', {
      signal,
      timeoutMs: config.shutdownTimeoutMs,
    });
    server.closeAllConnections?.();
    process.exit(1);
  }, config.shutdownTimeoutMs);

  forceShutdownTimer.unref();

  server.close((error?: Error) => {
    clearTimeout(forceShutdownTimer);

    if (error) {
      logger.error('Failed to close server cleanly', { signal, error: error.message });
      process.exit(1);
      return;
    }

    logger.info('HTTP server stopped', { signal });
    process.exit(0);
  });
}

(['SIGINT', 'SIGTERM'] as const).forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('SIGTERM');
});

export { app, config, server };
