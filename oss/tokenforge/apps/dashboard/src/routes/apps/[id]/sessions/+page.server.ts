import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ params, url }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const subject = url.searchParams.get('subject') ?? undefined;
  const sessions = await store.listSessions(app.id, { subject, limit: 100 });
  return {
    app: { id: app.id, name: app.name },
    subject: subject ?? '',
    sessions: sessions.map((s) => ({
      id: s.id,
      subject: s.subjectExternal,
      bindingClass: s.bindingClass,
      ipFirst: s.ipFirst,
      createdAt: s.createdAt.toISOString(),
      lastRefreshAt: s.lastRefreshAt?.toISOString() ?? null,
      expiresAt: s.expiresAt.toISOString(),
      revoked: !!s.revokedAt,
    })),
  };
};

export const actions: Actions = {
  revoke: async ({ request, params, url }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const reason = String(form.get('reason') ?? 'admin_revoke').slice(0, 200);
    if (!id) return fail(400, { error: 'id_required' });
    await store.revokeSession(id, reason);
    const subject = url.searchParams.get('subject');
    throw redirect(303, `/apps/${app.id}/sessions${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);
  },
};
