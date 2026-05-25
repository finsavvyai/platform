/**
 * Reference SaaS app showing TokenForge wrapping a custom auth.
 *
 * Flow:
 *   1. POST /login        — primitive auth, sets `demo_session` cookie
 *   2. POST /__tokenforge/register — browser SDK calls; middleware
 *                                    reads onLogin, returns first-party
 *                                    tf_bound + tf_session cookies
 *   3. GET  /dashboard    — gated on tf_bound presence
 *   4. POST /__tokenforge/refresh — browser SDK calls on 401, middleware
 *                                    proxies to TokenForge
 */

import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { tokenforge } from '@tokenforge/hono';

interface User {
  id: string;
  email: string;
}

const sessions = new Map<string, User>();

export interface DemoEnv {
  Variables: { demoUser?: User };
}

export function buildDemoApp(opts: {
  appId: string;
  apiKey: string;
  apiBase?: string;
  fetchImpl?: typeof globalThis.fetch;
}): Hono<DemoEnv> {
  const app = new Hono<DemoEnv>();

  app.use('*', async (c, next) => {
    const sid = getCookie(c, 'demo_session');
    if (sid) {
      const u = sessions.get(sid);
      if (u) c.set('demoUser', u);
    }
    await next();
  });

  app.use(
    '*',
    tokenforge({
      appId: opts.appId,
      apiKey: opts.apiKey,
      apiBase: opts.apiBase,
      fetchImpl: opts.fetchImpl,
      onLogin: async (c) => {
        const u = (c as unknown as { get(k: 'demoUser'): User | undefined }).get('demoUser');
        return u ? { subject: u.id, metadata: { email: u.email } } : null;
      },
      onStepUp: (c) => c.json({ error: 'step_up_required' }, 401),
    }),
  );

  app.post('/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
    if (!body?.email) return c.json({ error: 'email_required' }, 400);
    const id = `u_${Buffer.from(body.email).toString('hex').slice(0, 12)}`;
    const sid = crypto.randomUUID();
    sessions.set(sid, { id, email: body.email });
    setCookie(c, 'demo_session', sid, {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      path: '/',
    });
    return c.json({ ok: true, user_id: id });
  });

  app.post('/logout', async (c) => {
    const sid = getCookie(c, 'demo_session');
    if (sid) sessions.delete(sid);
    setCookie(c, 'demo_session', '', { maxAge: 0, path: '/' });
    return c.json({ ok: true });
  });

  app.get('/dashboard', (c) => {
    const tf = getCookie(c, 'tf_bound');
    const user = c.get('demoUser');
    if (!tf || !user) return c.json({ error: 'unauthorized' }, 401);
    return c.json({ welcome: user.email, dashboard: 'protected content' });
  });

  app.get('/whoami', (c) => {
    const user = c.get('demoUser');
    return c.json({ user: user ?? null, bound: !!getCookie(c, 'tf_bound') });
  });

  return app;
}

export const _testInternals = { sessions };
