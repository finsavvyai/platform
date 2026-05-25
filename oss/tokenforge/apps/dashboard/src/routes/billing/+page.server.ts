import type { PageServerLoad } from './$types.js';
import { requireTenant } from '$lib/server/context.js';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['1 app', '1k MAU', '7-day audit'], cta: null },
  { id: 'pro', name: 'Pro', price: '$49/mo', features: ['5 apps', '25k MAU', '30-day audit', 'Webhooks'], cta: 'pro' },
  { id: 'scale', name: 'Scale', price: '$199/mo', features: ['Unlimited apps', '250k MAU', '90-day audit', 'Priority support'], cta: 'scale' },
];

export const load: PageServerLoad = async () => {
  const tenant = await requireTenant();
  return {
    tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    plans: PLANS,
  };
};
