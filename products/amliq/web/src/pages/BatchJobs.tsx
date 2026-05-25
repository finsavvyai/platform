import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Upload } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { api } from '../api/client';
import { BatchJobCard } from '../components/batch/BatchJobCard';
import type { BatchJobCardJob } from '../components/batch/BatchJobCard';

interface BatchJob {
  batch_id: string;
  status: string;
  entity_count: number;
  created_at: string;
  progress?: number;
  processed_entities?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

function toCardJob(job: BatchJob): BatchJobCardJob {
  const status = (['running', 'completed', 'failed', 'pending'] as const).includes(
    job.status as BatchJobCardJob['status'],
  )
    ? (job.status as BatchJobCardJob['status'])
    : 'pending';

  return {
    id: job.batch_id,
    name: job.batch_id,
    status,
    progress: job.progress,
    totalEntities: job.entity_count,
    processedEntities: job.processed_entities,
    startedAt: job.started_at ?? job.created_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message,
  };
}

export function BatchJobs() {
  const { t } = useTranslation('batch');
  const { data, loading, error } = useApi<{ jobs: BatchJob[] }>(
    () => api.get('/batch'),
  );
  const jobs = data?.jobs ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button variant="primary" className="flex items-center gap-sm">
            <Upload className="w-4 h-4" />
            {t('new_job')}
          </Button>
        }
      />
      {error && <p className="text-apple-red sf-caption mb-md">{error.message}</p>}
      {jobs.length === 0 && !error && (
        <Card>
          <p className="text-center sf-body py-lg" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('no_jobs', { defaultValue: 'No batch jobs yet. Upload a file to start.' })}
          </p>
        </Card>
      )}
      <div className="space-y-md">
        {jobs.map((job) => (
          <BatchJobCard key={job.batch_id} job={toCardJob(job)} />
        ))}
      </div>
    </div>
  );
}
