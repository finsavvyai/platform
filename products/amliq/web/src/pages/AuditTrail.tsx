import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ExportButton } from '../components/ui/ExportButton';
import { useAudit } from '../hooks/useAudit';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

type BadgeColor = 'blue' | 'green' | 'red' | 'orange' | 'gray' | 'purple'

const actionColors: Record<string, BadgeColor> = {
  screen_initiated: 'purple',
  alert_created: 'orange',
  alert_resolved: 'green',
  config_updated: 'purple',
  list_imported: 'blue',
  export_generated: 'green',
};

export function AuditTrail() {
  const { t } = useTranslation('audit');
  const { entries, loading, error } = useAudit();

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-lg">
        <PageHeader title={t('title')} description={t('description')} />
        <ExportButton
          filename={`audit-trail-${new Date().toISOString().split('T')[0]}.csv`}
          url="/api/v1/export/audit?format=csv"
          disabled={entries.length === 0}
        />
      </div>
      {error && <p className="text-apple-red sf-caption mb-md" role="alert">{error.message}</p>}
      <Card>
        {entries.length === 0 && (
          <div className="text-center py-xl">
            <p className="sf-body mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>No audit entries yet</p>
            <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
              Actions will be recorded here as you use the platform.
            </p>
          </div>
        )}
        <div className="space-y-md">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between p-md glass-card rounded-apple-md">
              <div className="flex-1">
                <div className="flex items-center gap-md mb-xs">
                  <Badge color={actionColors[entry.action] ?? 'gray'}>
                    {entry.action.replace('_', ' ')}
                  </Badge>
                  <span className="sf-caption">{entry.actor}</span>
                </div>
                <p className="sf-body">{entry.target}</p>
                <p className="sf-caption mt-xs">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
