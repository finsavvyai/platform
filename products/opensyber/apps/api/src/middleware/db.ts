import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import { createDb } from '../lib/db.js';

export const dbMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const db = createDb(c.env.DB);
    c.set('db', db);
    await next();
  },
);
