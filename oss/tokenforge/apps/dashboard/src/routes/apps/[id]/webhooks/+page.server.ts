import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

const ALLOWED_EVENTS = new Set(['risk_signal', 'session_revoked', 'session_register', 'refresh_failed']);

export const load: PageServerLoad = async ({ params, cookies }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');

  const cookieName = `tf_whsec_${app.id}`;
  const revealedSecret = cookies.get(cookieName);
  cookies.delete(cookieName, { path: '/' });

  const webhooks = await store.listWebhooks(app.id);
  return {
    app: { id: app.id, name: app.name },
    webhooks: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      createdAt: w.createdAt.toISOString(),
    })),
    revealedSecret: revealedSecret ?? null,
  };
};

export const actions: Actions = {
  create: async ({ request, params, cookies }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');

    const form = await request.formData();
    const url = String(form.get('url') ?? '').trim();
    const events = form.getAll('events').map(String);

    if (!url.startsWith('https://')) return fail(400, { error: 'url_must_be_https' });
    if (events.length === 0) return fail(400, { error: 'events_required' });
    if (!events.every((e) => ALLOWED_EVENTS.has(e))) return fail(400, { error: 'invalid_event' });

    const w = await store.insertWebhook({ appId: app.id, url, events });
    cookies.set(`tf_whsec_${app.id}`, w.secret, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60,
    });
    throw redirect(303, `/apps/${app.id}/webhooks`);
  },

  delete: async ({ request, params }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'id_required' });
    await store.deleteWebhook(id);
    throw redirect(303, `/apps/${app.id}/webhooks`);
  },
};
