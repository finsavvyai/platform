import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { requireTenant } from '$lib/server/context.js';
import { getStore } from '$lib/server/store-singleton.js';
import { issueApiKey } from '$lib/server/api-keys.js';

export const load: PageServerLoad = async () => ({});

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const origin = String(form.get('origin') ?? '').trim();
    const mode = (form.get('mode') as 'customer' | 'workforce') ?? 'customer';

    if (!name) return fail(400, { error: 'name_required' });
    if (!origin || !/^https:\/\//.test(origin)) {
      return fail(400, { error: 'origin_must_be_https' });
    }

    const tenant = await requireTenant();
    const store = getStore();

    const placeholder = await issueApiKey('placeholder');
    const inserted = await store.insertApp({
      tenantId: tenant.id,
      mode,
      name,
      origin,
      apiKeyHash: placeholder.hash,
    });

    const issued = await issueApiKey(inserted.id);
    inserted.apiKeyHash = issued.hash;

    cookies.set(`tf_reveal_${inserted.id}`, issued.liveKey, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60,
    });

    throw redirect(303, `/apps/${inserted.id}/created`);
  },
};
