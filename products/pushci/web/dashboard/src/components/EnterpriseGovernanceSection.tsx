// Governance (audit + compliance) section of /enterprise dashboard.
// Audit events come from /api/audit/logs. Compliance tasks have no backing
// DB table — the UI shows a transparent "Coming soon" state instead of mocks.

import { cardGesture } from '../styles/gestures';
import type { AuditEvent } from '../hooks/useEnterprise';
import { formatRelative } from '../pages/enterprise-format';

interface Props {
  auditEvents: AuditEvent[] | null;
  loading: boolean;
  error: string | null;
}

function AuditSkeleton() {
  return (
    <ul className="space-y-2" data-testid="audit-skeleton">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-center gap-3 border-b border-surface-border/50 last:border-b-0 pb-2 last:pb-0">
          <div className="h-3 w-14 rounded shimmer" />
          <div className="h-3 w-36 rounded shimmer" />
          <div className="h-3 flex-1 rounded shimmer" />
        </li>
      ))}
    </ul>
  );
}

function AuditCard({ auditEvents, loading, error }: Props) {
  return (
    <div className={`rounded-xl border border-surface-border bg-surface-card p-5 ${cardGesture}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">Recent audit events</h3>
        <span className="text-xs text-zinc-500">latest {auditEvents?.length ?? 0}</span>
      </div>
      {loading && <AuditSkeleton />}
      {error && !loading && <div className="text-xs text-amber-400">Couldn't load audit: {error}</div>}
      {!loading && !error && auditEvents && auditEvents.length === 0 && (
        <div className="text-xs text-zinc-500">No audit events yet.</div>
      )}
      {!loading && !error && auditEvents && auditEvents.length > 0 && (
        <ul className="space-y-2">
          {auditEvents.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 text-xs border-b border-surface-border/50 last:border-b-0 pb-2 last:pb-0"
            >
              <span className="text-zinc-500 w-14 shrink-0">{formatRelative(e.created_at)}</span>
              <span className="text-emerald-400 font-mono w-36 shrink-0 truncate">{e.action}</span>
              <span className="text-zinc-200 truncate flex-1">{e.actor_login || e.actor_sub}</span>
              <span className="text-zinc-500 font-mono truncate max-w-[140px]">{e.resource_id ?? e.resource_type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComplianceCard() {
  return (
    <div className={`rounded-xl border border-surface-border bg-surface-card p-5 ${cardGesture}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">Open compliance tasks</h3>
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300 bg-amber-400/10"
          data-testid="compliance-coming-soon"
        >
          Coming soon
        </span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">
        Structured compliance task tracking is not yet wired to the API. Export a SOC 2
        evidence pack from <code className="text-zinc-300">/api/compliance/soc2/evidence</code>
        for a signed snapshot of today's controls.
      </p>
    </div>
  );
}

export default function EnterpriseGovernanceSection(props: Props) {
  return (
    <section>
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Governance</h2>
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <AuditCard {...props} />
        <ComplianceCard />
      </div>
    </section>
  );
}
