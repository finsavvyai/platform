import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');

  const cookieName = `tf_reveal_${app.id}`;
  const liveKey = cookies.get(cookieName);
  cookies.delete(cookieName, { path: '/' });

  return {
    app: { id: app.id, name: app.name, origin: app.origin, mode: app.mode },
    liveKey: liveKey ?? null,
  };
};
