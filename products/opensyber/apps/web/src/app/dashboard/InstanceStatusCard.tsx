import { Play } from 'lucide-react';
import { RenameInstanceButton } from '@/components/dashboard/RenameInstanceButton';
import { REGION_LABELS } from '@opensyber/shared';
import type { Region } from '@opensyber/shared';
import { formatDate } from '@/lib/utils';
import type { InstanceData } from './dashboard-types';

interface Props {
  instance: InstanceData;
}

export function InstanceStatusCard({ instance }: Props): React.ReactElement {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              instance.status === 'running'
                ? 'bg-green-500/10'
                : instance.status === 'error'
                  ? 'bg-red-500/10'
                  : 'bg-yellow-500/10'
            }`}
          >
            <Play
              className={`h-6 w-6 ${
                instance.status === 'running'
                  ? 'text-green-500'
                  : instance.status === 'error'
                    ? 'text-red-500'
                    : 'text-yellow-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{instance.name}</h2>
              <RenameInstanceButton instanceId={instance.id} currentName={instance.name} />
            </div>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${
                    instance.status === 'running'
                      ? 'bg-green-500'
                      : instance.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  }`}
                />
                <span className="capitalize">{instance.status}</span>
              </span>
              <span>&middot;</span>
              <span>
                {REGION_LABELS[instance.region as Region] ?? instance.region}
              </span>
              {instance.engineVersion && (
                <>
                  <span>&middot;</span>
                  <span>SyberEngine {instance.engineVersion}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-text-dim">
          {instance.lastHealthCheck
            ? `Last health check: ${formatDate(instance.lastHealthCheck)}`
            : 'No health data yet'}
        </div>
      </div>
    </div>
  );
}
