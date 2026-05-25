/**
 * SSE admin overview — live status tiles for the four self-hosted SSE
 * primitives (SWG, RBI, WLP, DNS firewall). Each tile renders the
 * tenant/agent count fetched from `/api/{swg,rbi,wlp,dns}/tenants` so
 * operators can see at a glance whether the underlying engines are
 * provisioned for the current org.
 *
 * No mocked counts — when the API is unreachable the tile renders a
 * dash and an error chip. That's deliberate: a fake green number is
 * more dangerous than a visible failure.
 */

import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { SseTile } from './SseTile';
import { Globe, ShieldCheck, MonitorSmartphone, Network } from 'lucide-react';

export const metadata = { title: 'SSE Admin' };

interface ListResponse<T> {
  data: T[];
}

async function loadCount<T>(path: string, token: string | null): Promise<number | null> {
  if (!token) return null;
  try {
    const r = await apiClient<ListResponse<T>>(path, { token });
    return Array.isArray(r.data) ? r.data.length : null;
  } catch {
    return null;
  }
}

export default async function SseAdminPage() {
  const token = await getApiToken();
  const [swg, rbi, wlp, dns] = await Promise.all([
    loadCount('/api/swg/tenants', token),
    loadCount('/api/rbi/tenants', token),
    loadCount('/api/wlp/agents', token),
    loadCount('/api/dns/tenants', token),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">SSE</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Self-hosted Secure Service Edge — Squid SWG, Kasm RBI, Falco/osquery WLP,
          and Unbound DNS firewall.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SseTile
          title="Secure Web Gateway"
          subtitle="Squid + e2guardian + DLP"
          count={swg}
          unit="tenants"
          href="/admin/sse/swg"
          icon={Globe}
          accent="text-signal"
        />
        <SseTile
          title="Remote Browser Isolation"
          subtitle="Kasm Workspaces clusters"
          count={rbi}
          unit="tenants"
          href="/admin/sse/rbi"
          icon={MonitorSmartphone}
          accent="text-purple-400"
        />
        <SseTile
          title="Workload Protection"
          subtitle="Falco + osquery + Wazuh"
          count={wlp}
          unit="agents"
          href="/admin/sse/wlp"
          icon={ShieldCheck}
          accent="text-green-400"
        />
        <SseTile
          title="DNS Firewall"
          subtitle="Unbound RPZ resolvers"
          count={dns}
          unit="tenants"
          href="/admin/sse/dns"
          icon={Network}
          accent="text-amber-400"
        />
      </div>

      <div className="rounded border border-border bg-panel/30 p-6 text-sm text-text-secondary">
        <p>
          A dash <code>—</code> means the API was unreachable when this page rendered.
          Tile counts are not cached; reload to retry.
        </p>
      </div>
    </div>
  );
}
