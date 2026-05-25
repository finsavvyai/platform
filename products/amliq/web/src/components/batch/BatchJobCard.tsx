import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { RefreshCw, X, Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface BatchJobCardJob {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  progress?: number;
  totalEntities?: number;
  processedEntities?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BatchJobCardProps {
  job: BatchJobCardJob;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

type BadgeColor = 'blue' | 'green' | 'red' | 'gray';
const statusColor: Record<BatchJobCardJob['status'], BadgeColor> = {
  running: 'blue',
  completed: 'green',
  failed: 'red',
  pending: 'gray',
};

const RATE = 50; // entities per minute

const STAGES = ['Queued', 'Fetching', 'Screening', 'Scoring', 'Done'] as const;

function getStageIndex(progress: number): number {
  if (progress >= 100) return 4;
  if (progress >= 80) return 3;
  if (progress >= 10) return 2;
  if (progress > 0) return 1;
  return 0;
}

function formatDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 1) return '< 1 min';
  return `${minutes} min`;
}

export function BatchJobCard({ job, onRetry, onCancel }: BatchJobCardProps) {
  const { id, name, status, progress, totalEntities, processedEntities, startedAt, completedAt, errorMessage } = job;
  const isRunning = status === 'running';
  const isFailed = status === 'failed';
  const hasProgress = isRunning && typeof progress === 'number';

  const eta = hasProgress && totalEntities && processedEntities !== undefined && totalEntities > processedEntities
    ? Math.max(1, Math.round((totalEntities - processedEntities) / RATE))
    : null;

  const stageIndex = hasProgress ? getStageIndex(progress ?? 0) : null;
  const duration = formatDuration(startedAt, completedAt);

  return (
    <Card>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="sf-headline truncate">{name}</h3>
          {totalEntities !== undefined && (
            <p className="sf-caption mt-0.5" style={{ color: 'var(--dash-text-secondary)' }}>
              {totalEntities.toLocaleString()} entities
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {duration && (
            <span className="sf-caption flex items-center gap-1" style={{ color: 'var(--dash-text-secondary)' }}>
              <Clock className="w-3 h-3" />
              {duration}
            </span>
          )}
          <Badge color={statusColor[status]}>{status}</Badge>
        </div>
      </div>

      {/* Progress bar */}
      {hasProgress && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            <span>
              {processedEntities?.toLocaleString()} / {totalEntities?.toLocaleString()} processed
            </span>
            {eta && <span>~{eta} min remaining</span>}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--dash-border)' }}>
            <motion.div
              className="h-full rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
          <p className="sf-caption text-right" style={{ color: 'var(--dash-text-secondary)' }}>
            {progress}%
          </p>
        </div>
      )}

      {/* Stage pills */}
      {stageIndex !== null && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {STAGES.map((stage, i) => (
            <span
              key={stage}
              className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-300',
                i < stageIndex
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : i === stageIndex
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-500/50'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-700/30 dark:text-slate-500',
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      )}

      {/* Error message */}
      {isFailed && errorMessage && (
        <p className="mt-3 sf-caption text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}

      {/* Action buttons */}
      {(isFailed || isRunning) && (
        <div className="mt-4 flex gap-2">
          {isFailed && onRetry && (
            <Button size="sm" variant="secondary" onClick={() => onRetry(id)}>
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          )}
          {isRunning && onCancel && (
            <Button size="sm" variant="ghost" onClick={() => onCancel(id)}>
              <X className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
