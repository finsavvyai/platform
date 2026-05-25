import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const subjects = await store.listSubjects(app.id);
  return {
    app: { id: app.id, name: app.name, mode: app.mode },
    subjects: subjects.map((s) => ({
      externalSubject: s.externalSubject,
      email: s.email,
      firstSeenAt: s.firstSeenAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      activeSessions: s.activeSessions,
    })),
  };
};
