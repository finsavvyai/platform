// Identity (SSO / SCIM) section of /enterprise dashboard. Live data only.

import { cardGesture } from '../styles/gestures';
import type { IdentityStatus } from '../hooks/useEnterprise';
import { formatRelative } from '../pages/enterprise-format';

interface Props {
  data: IdentityStatus | null;
  loading: boolean;
  error: string | null;
}

interface Row { label: string; value: string; ok: boolean; }

function ssoRows(d: IdentityStatus): Row[] {
  if (!d.sso.configured) {
    return [{ label: 'Status', value: 'Not configured', ok: false }];
  }
  return [
    { label: 'Provider', value: d.sso.provider ?? 'SAML 2.0', ok: true },
    { label: 'Tenant', value: d.sso.tenant ?? '—', ok: true },
    { label: 'Updated', value: formatRelative(d.sso.updated_at), ok: true },
  ];
}

function scimRows(d: IdentityStatus): Row[] {
  if (!d.scim.configured) {
    return [{ label: 'Status', value: 'Not configured', ok: false }];
  }
  return [
    { label: 'Endpoint', value: '/scim/v2', ok: true },
    { label: 'Tenant', value: d.scim.tenant ?? 'default', ok: true },
  ];
}

function Card({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className={`rounded-xl border border-surface-border bg-surface-card p-5 ${cardGesture}`}>
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">{title}</h3>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className="flex items-center gap-2 text-zinc-200 text-right">
              <span className={`inline-block w-2 h-2 rounded-full ${r.ok ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              <span>{r.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2" data-testid="identity-skeleton">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-3">
          <div className="h-3 w-28 rounded shimmer" />
          <div className="h-3 w-40 rounded shimmer" />
          <div className="h-3 w-32 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

export default function EnterpriseIdentitySection({ data, loading, error }: Props) {
  return (
    <section>
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Identity</h2>
      {loading && <Skeleton />}
      {error && !loading && (
        <div className="rounded-xl border border-surface-border bg-surface-card p-5 text-sm text-amber-400">
          Couldn't load identity status: {error}
        </div>
      )}
      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          <Card title="SAML SSO" rows={ssoRows(data)} />
          <Card title="SCIM provisioning" rows={scimRows(data)} />
        </div>
      )}
    </section>
  );
}
