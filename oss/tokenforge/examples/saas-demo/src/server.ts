/**
 * Local dev entry point — `pnpm --filter @tokenforge/example-saas-demo dev`.
 *
 * Set TF_APP_ID + TF_API_KEY (and optionally TF_API_BASE) in the env.
 */

import { serve } from '@hono/node-server';
import { buildDemoApp } from './app.js';

const appId = process.env.TF_APP_ID;
const apiKey = process.env.TF_API_KEY;
if (!appId || !apiKey) {
  console.error('TF_APP_ID and TF_API_KEY env vars are required.');
  process.exit(1);
}

const app = buildDemoApp({
  appId,
  apiKey,
  apiBase: process.env.TF_API_BASE,
});

const port = Number(process.env.PORT ?? 3030);
serve({ fetch: app.fetch, port });
console.log(`saas-demo listening on http://localhost:${port}`);
