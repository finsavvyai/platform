// Route: add <Route path="/enterprise" element={<EnterpriseDashboardPage />} /> to App.tsx
// Live-data enterprise dashboard. No mock arrays — every section resolves
// through a real API call with skeleton/error/empty handling.

import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import EnterpriseDoraSection from '../components/EnterpriseDoraSection';
import EnterpriseIdentitySection from '../components/EnterpriseIdentitySection';
import EnterpriseGovernanceSection from '../components/EnterpriseGovernanceSection';
import {
  enterpriseApi,
  type AuditEvent,
  type DoraMetrics,
  type IdentityStatus,
} from '../hooks/useEnterprise';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function initial<T>(): AsyncState<T> {
  return { data: null, loading: true, error: null };
}

function toMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message.match(/^API (\d{3}):/);
    if (m) return 'Failed to load data. Please try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

interface Loaders {
  getDora: typeof enterpriseApi.getDora;
  getIdentityStatus: typeof enterpriseApi.getIdentityStatus;
  getRecentAudit: typeof enterpriseApi.getRecentAudit;
}

interface Props {
  loaders?: Loaders;
}

export default function EnterpriseDashboardPage({ loaders }: Props = {}) {
  const effectiveLoaders: Loaders = loaders ?? {
    getDora: enterpriseApi.getDora,
    getIdentityStatus: enterpriseApi.getIdentityStatus,
    getRecentAudit: enterpriseApi.getRecentAudit,
  };
  const [dora, setDora] = useState<AsyncState<DoraMetrics>>(initial());
  const [identity, setIdentity] = useState<AsyncState<IdentityStatus>>(initial());
  const [audit, setAudit] = useState<AsyncState<AuditEvent[]>>(initial());

  useEffect(() => {
    let cancelled = false;
    async function run<T>(
      fn: () => Promise<T>,
      setter: (next: AsyncState<T>) => void,
    ) {
      try {
        const data = await fn();
        if (!cancelled) setter({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setter({ data: null, loading: false, error: toMessage(err) });
      }
    }
    run<DoraMetrics>(() => effectiveLoaders.getDora(), setDora);
    run<IdentityStatus>(() => effectiveLoaders.getIdentityStatus(), setIdentity);
    run<AuditEvent[]>(() => effectiveLoaders.getRecentAudit(10), setAudit);
    return () => {
      cancelled = true;
    };
  }, [effectiveLoaders]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Enterprise"
        description="DORA metrics, SSO, SCIM, audit, and compliance at a glance."
      />
      <EnterpriseDoraSection data={dora.data} loading={dora.loading} error={dora.error} />
      <EnterpriseIdentitySection
        data={identity.data}
        loading={identity.loading}
        error={identity.error}
      />
      <EnterpriseGovernanceSection
        auditEvents={audit.data}
        loading={audit.loading}
        error={audit.error}
      />
    </div>
  );
}
