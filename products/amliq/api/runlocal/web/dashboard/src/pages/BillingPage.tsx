import { useState } from 'react';
import PageHeader from '../components/PageHeader';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['1 repo', 'Local runs', '2 deploy targets'] },
  { id: 'pro', name: 'Pro', price: '$9/mo', features: ['Unlimited repos', 'AI diagnosis', '500 cloud min', 'Priority support'] },
  { id: 'team', name: 'Team', price: '$29/seat/mo', features: ['25 seats', 'SSO', 'Audit logs', '2000 cloud min'] },
];

async function checkout(plan: string, period: string) {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, period }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

async function openPortal() {
  const res = await fetch('/api/billing/portal');
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

export default function BillingPage() {
  const [current] = useState('free');
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription" />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setPeriod('monthly')}
          className={`px-3 py-1 rounded text-sm ${period === 'monthly' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
          Monthly
        </button>
        <button onClick={() => setPeriod('annual')}
          className={`px-3 py-1 rounded text-sm ${period === 'annual' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
          Annual (save 17%)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`rounded-lg border p-5 ${plan.id === current ? 'border-emerald-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/50'}`}>
            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{plan.price}</p>
            <ul className="mt-3 space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-zinc-400">&#10003; {f}</li>
              ))}
            </ul>
            {plan.id === current ? (
              <span className="inline-block mt-4 text-sm text-emerald-400">Current plan</span>
            ) : plan.id !== 'free' ? (
              <button onClick={() => checkout(plan.id, period)}
                className="mt-4 w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
                Upgrade
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Usage</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Cloud minutes</span>
            <span className="text-white">0 / 0</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '0%' }} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Manage</h2>
        <button onClick={openPortal}
          className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm">
          Manage Subscription
        </button>
      </section>
    </div>
  );
}
