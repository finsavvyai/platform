import express from 'express';
import { logger, createRequestLogger } from './logger';
import { loadConfig } from './config';
import { corsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/securityHeaders';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeAIProviders } from './services/nlpService';
import { removeAllAdapters } from './adapters/factory';
import healthRoutes from './routes/health';
import connectionRoutes from './routes/connections';
import queryRoutes from './routes/queries';
import databaseRoutes from './routes/database';
import nlpRoutes from './routes/nlp';

const config = loadConfig();

// Initialize AI providers (OpenHands + OpenClaw)
initializeAIProviders({
  openHandsURL: process.env.OPENHANDS_URL || 'http://localhost:8787',
  openHandsAPIKey: process.env.OPENHANDS_API_KEY,
  openClawURL: process.env.OPENCLAW_URL,
  openClawAPIKey: process.env.OPENCLAW_API_KEY,
});

const app = express();

// Global middleware
app.use(express.json({ limit: '1mb' }));
app.use(createRequestLogger());
app.use(securityHeaders);
app.use(corsMiddleware(config.corsOrigins));
app.use(rateLimiter(config.rateLimitWindowMs, config.rateLimitMax));

// Routes
app.use(healthRoutes);
const v1 = express.Router();
v1.use('/connections', connectionRoutes);
v1.use('/queries', queryRoutes);
v1.use('/database', databaseRoutes);
v1.use('/ai', nlpRoutes);
v1.use('/nlp', nlpRoutes); // frontend compat: QueryLens sends to /api/v1/nlp/query
app.use('/api/v1', v1);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host, env: config.env }, 'QueryFlux server started');
  logger.info({ url: process.env.OPENHANDS_URL || 'http://localhost:8787' }, 'OpenHands provider');
  if (process.env.OPENCLAW_URL) logger.info({ url: process.env.OPENCLAW_URL }, 'OpenClaw provider');
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  await removeAllAdapters();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
