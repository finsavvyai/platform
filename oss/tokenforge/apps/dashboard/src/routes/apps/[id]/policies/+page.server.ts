import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getStore } from '$lib/server/store-singleton.js';
import { evaluatePolicy, type PolicyDocument } from '@tokenforge/protocol';

const COUNTRY = /^[A-Z]{2}$/;

export const load: PageServerLoad = async ({ params }) => {
  const store = getStore();
  const app = await store.getApp(params.id);
  if (!app) throw error(404, 'app_not_found');
  const policies = await store.listPolicies(app.id);
  return {
    app: { id: app.id, name: app.name, mode: app.mode },
    policies: policies.map((p) => ({
      id: p.id,
      name: p.name,
      rules: p.rules,
      enabled: p.enabled,
      createdAt: p.createdAt.toISOString(),
    })),
  };
};

export const actions: Actions = {
  create: async ({ request, params }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');

    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const rulesRaw = String(form.get('rules') ?? '').trim();
    const blockCountriesCsv = String(form.get('block_countries') ?? '').trim();

    if (!name) return fail(400, { error: 'name_required' });

    let rules: PolicyDocument;
    if (blockCountriesCsv) {
      const codes = blockCountriesCsv
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const bad = codes.find((c) => !COUNTRY.test(c));
      if (bad) return fail(400, { error: `invalid_country_code:${bad}` });
      rules = {
        rules: [{ if_any: [{ geo_country_in: codes }], then: 'block' }],
        default: 'allow',
      };
    } else if (rulesRaw) {
      try {
        rules = JSON.parse(rulesRaw) as PolicyDocument;
      } catch {
        return fail(400, { error: 'rules_json_malformed' });
      }
    } else {
      return fail(400, { error: 'rules_required' });
    }

    if (!Array.isArray(rules.rules)) {
      return fail(400, { error: 'rules_must_be_array' });
    }

    // Smoke-test the document by evaluating against a dummy context —
    // any throw means the DSL was not what evaluatePolicy expected.
    try {
      evaluatePolicy(rules, { bindingClass: 'webcrypto' });
    } catch (e) {
      return fail(400, { error: `eval_failed:${(e as Error).message}` });
    }

    await store.insertPolicy({
      appId: app.id,
      name,
      rules: rules as unknown as Record<string, unknown>,
    });
    throw redirect(303, `/apps/${app.id}/policies`);
  },

  toggle: async ({ request, params }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const enabled = String(form.get('enabled') ?? '') === 'true';
    if (!id) return fail(400, { error: 'id_required' });
    await store.setPolicyEnabled(id, enabled);
    throw redirect(303, `/apps/${app.id}/policies`);
  },

  delete: async ({ request, params }) => {
    const store = getStore();
    const app = await store.getApp(params.id);
    if (!app) throw error(404, 'app_not_found');
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { error: 'id_required' });
    await store.deletePolicy(id);
    throw redirect(303, `/apps/${app.id}/policies`);
  },
};
