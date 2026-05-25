import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Playbook, PlaybookRun } from '../types';
import { statusColors, triggerLabels, stepTypeLabels } from '../types';
import { RunPlaybookButton } from './RunPlaybookButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlaybookDetailPage({ params }: PageProps) {
  const { id } = await params;
  let playbook: Playbook | null = null;
  let runs: PlaybookRun[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const opts = { token };
      const pbData = await apiClient<{ playbook: Playbook }>(
        `/api/remediation/playbooks/${id}`, opts,
      );
      playbook = pbData.playbook ?? null;
      const runData = await apiClient<{ runs: PlaybookRun[] }>(
        `/api/remediation/runs?playbookId=${id}`, opts,
      );
      runs = runData.runs ?? [];
    }
  } catch {
    // API not available
  }

  if (!playbook) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Zap className="h-8 w-8 text-neutral-400 mb-4" />
        <h2 className="text-lg font-semibold mb-1">Playbook not found</h2>
        <Link href="/dashboard/security/playbooks" className="text-sm text-info hover:text-info mt-2">
          Back to Playbooks
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/security/playbooks"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Playbooks
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{playbook.name}</h1>
          {playbook.description && (
            <p className="text-sm text-neutral-400 mt-1">{playbook.description}</p>
          )}
        </div>
        <RunPlaybookButton playbookId={playbook.id} />
      </div>

      <PlaybookMeta playbook={playbook} />
      <PlaybookSteps steps={playbook.steps} />
      <RecentRuns runs={runs} />
    </div>
  );
}

function PlaybookMeta({ playbook }: { playbook: Playbook }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {[
        { label: 'Status', value: playbook.status, badge: true },
        { label: 'Trigger', value: triggerLabels[playbook.triggerType] ?? playbook.triggerType },
        { label: 'Created', value: formatDate(playbook.createdAt) },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
          <p className="text-xs text-neutral-400 mb-1">{item.label}</p>
          {item.badge ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.value] ?? 'bg-neutral-800 text-neutral-300'}`}>
              {item.value}
            </span>
          ) : (
            <p className="text-sm font-medium">{item.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function PlaybookSteps({ steps }: { steps: Playbook['steps'] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 mb-6">
      <h2 className="text-lg font-medium mb-4">Steps ({steps?.length ?? 0})</h2>
      {!steps?.length ? (
        <p className="text-sm text-neutral-500">No steps configured.</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-info/10 text-info text-xs font-medium shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{stepTypeLabels[step.type] ?? step.type}</p>
                {Object.keys(step.config).length > 0 && (
                  <pre className="text-xs text-neutral-500 mt-1 overflow-x-auto">
                    {JSON.stringify(step.config, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentRuns({ runs }: { runs: PlaybookRun[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-medium mb-4">Recent Runs</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-neutral-500">No runs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-400">
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Started</th>
                <th className="pb-3 font-medium">Steps</th>
                <th className="pb-3 font-medium">Triggered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[run.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 text-neutral-500 whitespace-nowrap">{formatDate(run.startedAt ?? run.createdAt)}</td>
                  <td className="py-3 text-neutral-400">{run.stepsCompleted}/{run.stepsTotal}</td>
                  <td className="py-3 text-neutral-400">{run.triggeredBy ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
