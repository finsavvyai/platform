/**
 * `X-TokenForge-Key` middleware.
 *
 * Required on every server-to-server endpoint. Looks up the app by
 * the `app_id` segment encoded in the key and constant-time compares
 * the SHA-256(secret) against `apps.api_key_hash`. On success exposes
 * the app row at `c.get('app')` for downstream handlers.
 */

import type { MiddlewareHandler } from 'hono';
import type { App } from '@tokenforge/db';
import { appIdFromKey, verifyApiKey } from '../lib/api-key.js';
import type { DbAccess } from '../lib/db-access.js';

export interface ApiKeyMiddlewareDeps {
  db: (env: unknown) => DbAccess;
}

export type ApiKeyEnv = {
  Variables: { app: App };
};

export function apiKey(deps: ApiKeyMiddlewareDeps): MiddlewareHandler<ApiKeyEnv> {
  return async (c, next) => {
    const header = c.req.header('X-TokenForge-Key') ?? '';
    if (!header) return c.json({ error: 'missing_api_key' }, 401);
    const appId = appIdFromKey(header);
    if (!appId) return c.json({ error: 'malformed_api_key' }, 401);

    const db = deps.db(c.env);
    const app = await db.findApp(appId);
    if (!app) return c.json({ error: 'invalid_api_key' }, 401);

    const verify = await verifyApiKey(header, app.apiKeyHash);
    if (!verify.ok) return c.json({ error: 'invalid_api_key' }, 401);

    c.set('app', app);
    await next();
  };
}
