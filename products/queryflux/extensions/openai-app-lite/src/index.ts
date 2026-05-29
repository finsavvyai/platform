/**
 * QueryFlux OpenAI App
 *
 * Enables QueryFlux database intelligence features directly in ChatGPT.
 * Uses OpenAI Apps SDK for native ChatGPT integration.
 */

import { App } from '@openai/app-sdk';
import { QueryFluxClient } from './client.js';
import { registerTools } from './tools/index.js';

const QUERYFLUX_API_URL = process.env.QUERYFLUX_API_URL || 'http://localhost:8080';

/**
 * Initialize QueryFlux OpenAI App
 */
async function main() {
  // Create QueryFlux API client
  const client = new QueryFluxClient(QUERYFLUX_API_URL);

  // Initialize OpenAI App
  const app = new App({
    name: 'QueryFlux',
    description: 'AI-powered database intelligence platform with natural language querying',
    version: '1.0.0',
  });

  // Register all QueryFlux tools
  registerTools(app, client);

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const health = await client.healthCheck();
      res.json({ status: 'healthy', backend: health });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start the app server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ QueryFlux OpenAI App running on port ${port}`);
    console.log(`📡 Connected to QueryFlux API: ${QUERYFLUX_API_URL}`);
    console.log(`🔧 Tools registered: 6`);
  });
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Start the app
main().catch((error) => {
  console.error('❌ Failed to start QueryFlux OpenAI App:', error);
  process.exit(1);
});
