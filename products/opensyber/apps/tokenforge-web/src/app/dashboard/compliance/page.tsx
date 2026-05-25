'use client';

import { useCallback } from 'react';
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  Users,
  Download,
  Clock,
} from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchComplianceReport } from '@/lib/tokenforge-api';
import type { ComplianceReport } from '@/components/dashboard/types';
import { StatCard, ThreatBreakdown, StatusRow } from '@/components/dashboard/ComplianceWidgets';

export default function CompliancePage(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) =>
      fetchComplianceReport(token, signal),
    [],
  );
  const { data, loading, error } = useApi<ComplianceReport>(fetcher);

  function handlePrint(): void {
    window.print();
  }

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Compliance Report</h1>
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Compliance Report</h1>
        </div>
        <div className="rounded-2xl border border-border/50 bg-panel p-8 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-text-muted" />
          <p className="text-sm text-text-secondary">
            {error ?? 'Unable to load compliance report.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="print:bg-white print:text-black">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Report</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {data.period.label} — {data.tenant.name}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition print:hidden"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle}
          label="Total Verifications"
          value={data.totalVerifications.toLocaleString()}
          color="bg-info/10 text-info"
        />
        <StatCard
          icon={AlertTriangle}
          label="Threats Blocked"
          value={data.threatsBlocked.total.toLocaleString()}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={Shield}
          label="Avg Trust Score"
          value={`${data.averageTrustScore}/100`}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={Users}
          label="Active Sessions"
          value={data.activeSessions.toLocaleString()}
          color="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* Detail cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Threat breakdown */}
        <div className="rounded-2xl border border-border/50 bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold">Threats by Type</h2>
          <ThreatBreakdown byType={data.threatsBlocked.byType} />
        </div>

        {/* Compliance status */}
        <div className="rounded-2xl border border-border/50 bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold">Compliance Status</h2>
          <div className="space-y-3">
            <StatusRow label="Device Binding Coverage" value={`${data.deviceBindingCoverage}%`} ok={data.deviceBindingCoverage >= 80} />
            <StatusRow label="Uptime" value={`${data.uptime}%`} ok={data.uptime >= 99} />
            <StatusRow label="Plan" value={data.tenant.plan} ok />
            <StatusRow label="Report Generated" value={new Date(data.generatedAt).toLocaleString()} ok />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center gap-2 text-xs text-text-muted print:text-text-muted">
        <Clock className="h-3.5 w-3.5" />
        Report covers {data.period.start} to {data.period.end}
      </div>
    </div>
  );
}
