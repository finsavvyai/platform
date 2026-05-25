import { ClipboardCheck, FileText } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ExportReportButton } from '@/components/dashboard/security/ExportReportButton';

export const metadata = { title: 'Compliance Reports' };

interface ComplianceReport {
  id: string;
  framework: string;
  overallScore: number;
  passCount: number;
  failCount: number;
  generatedAt: string;
}

const frameworkLabels: Record<string, string> = {
  soc2: 'SOC 2 Type II',
  iso27001: 'ISO 27001:2022',
  cis: 'CIS Controls v8',
  hipaa: 'HIPAA',
  gdpr: 'GDPR',
  nist_csf: 'NIST CSF',
  pci_dss: 'PCI-DSS',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBorderColor(score: number) {
  if (score >= 80) return 'border-green-500/20';
  if (score >= 50) return 'border-yellow-500/20';
  return 'border-red-500/20';
}

export default async function CompliancePage() {
  let reports: ComplianceReport[] = [];
  let instanceId: string | null = null;

  let hasInstance = true;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const data = await apiClient<{ reports: ComplianceReport[] }>(
          `/api/security/instances/${instance.id}/compliance-reports`,
          { token },
        );
        reports = data.reports;
      } else {
        hasInstance = false;
      }
    }
  } catch {
    // API not available
  }

  if (!hasInstance) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Compliance Reports</h1>
        <p className="text-sm text-text-secondary mb-8">View compliance assessment reports for your instance</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <ClipboardCheck className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance deployed</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to generate compliance reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Compliance Reports</h1>
        <p className="text-sm text-text-secondary mt-1">View compliance assessment reports for your instance</p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <FileText className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No compliance reports</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            No reports have been generated yet. Generate a compliance report to assess your instance against
            industry frameworks like SOC 2, ISO 27001, or CIS Controls.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`rounded border bg-panel/30 p-6 ${scoreBorderColor(report.overallScore)}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="h-5 w-5 text-text-secondary" />
                <h3 className="text-base font-semibold">
                  {frameworkLabels[report.framework] ?? report.framework}
                </h3>
              </div>

              <div className="text-center mb-4">
                <p className={`text-5xl font-bold ${scoreColor(report.overallScore)}`}>
                  {report.overallScore}%
                </p>
                <p className="text-xs text-text-dim mt-1">Overall Score</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg bg-surface/50 p-3 text-center">
                  <p className="text-lg font-bold text-green-400">{report.passCount}</p>
                  <p className="text-xs text-text-dim">Passed</p>
                </div>
                <div className="rounded-lg bg-surface/50 p-3 text-center">
                  <p className="text-lg font-bold text-red-400">{report.failCount}</p>
                  <p className="text-xs text-text-dim">Failed</p>
                </div>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between">
                <p className="text-xs text-text-dim">
                  Generated {formatDate(report.generatedAt)}
                </p>
                {instanceId && (
                  <ExportReportButton instanceId={instanceId} reportId={report.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
