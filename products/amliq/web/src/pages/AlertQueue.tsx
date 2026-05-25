import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Sparkles, Clock, List } from 'lucide-react';
import { AlertCard } from '../components/alerts/AlertCard';
import { AlertFilters } from '../components/alerts/AlertFilters';
import { Button } from '../components/ui/Button';
import { ExportButton } from '../components/ui/ExportButton';
import { Badge } from '../components/ui/Badge';
import { useAlerts } from '../hooks/useAlerts';
import { useSmartSort, groupByTier } from '../hooks/useSmartSort';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import type { AlertStatus, AlertPriority } from '../types';
import type { SortMode, UrgencyTier } from '../hooks/useSmartSort';

const TIER_LABELS: Record<UrgencyTier, string> = {
  'needs-attention': 'Needs Attention',
  'in-progress': 'In Progress',
  'actionable': 'Actionable',
};

const TIER_COLORS: Record<UrgencyTier, string> = {
  'needs-attention': 'text-apple-red',
  'in-progress': 'text-[#C9A96E]',
  'actionable': 'text-apple-green',
};

const SORT_MODES: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'default', label: 'Default', icon: <List className="w-3.5 h-3.5" /> },
  { mode: 'smart', label: 'Smart', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { mode: 'oldest', label: 'Oldest', icon: <Clock className="w-3.5 h-3.5" /> },
];

export function AlertQueue() {
  const navigate = useNavigate();
  const { t } = useTranslation('alerts');
  const { alerts, loading, error, refetch } = useAlerts();
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<AlertPriority[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const preFiltered = alerts.filter((a) => {
    if (selectedStatus.length && !selectedStatus.includes(a.status)) return false;
    if (selectedPriority.length && !selectedPriority.includes(a.priority)) return false;
    return true;
  });

  const sorted = useSmartSort(preFiltered, sortMode);
  const grouped = sortMode === 'smart' ? groupByTier(sorted) : null;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
      <div className="md:col-span-1 glass-panel rounded-apple-lg p-lg md:sticky md:top-24 md:self-start">
        <AlertFilters
          selectedStatus={selectedStatus} selectedPriority={selectedPriority}
          onStatusChange={setSelectedStatus} onPriorityChange={setSelectedPriority}
          onReset={() => { setSelectedStatus([]); setSelectedPriority([]); }}
        />
      </div>

      <div className="md:col-span-3">
        <div className="flex items-center justify-between gap-md mb-xl">
          <div className="flex items-center gap-md">
            <h1 className="sf-title">{t('queue.title')}</h1>
            <Badge color="red" size="sm">{sorted.length}</Badge>
          </div>
          <div className="flex items-center gap-sm">
            <div className="flex rounded-apple-md overflow-hidden"
              style={{ border: '0.5px solid var(--dash-border)', background: 'var(--dash-surface)' }}>
              {SORT_MODES.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  aria-pressed={sortMode === mode}
                  className={`flex items-center gap-xs px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sortMode === mode
                      ? 'bg-[#1A1814] text-[#C9A96E]'
                      : 'text-apple-label-secondary hover:text-[var(--dash-text)]'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
            <ExportButton
              filename={`alerts-${new Date().toISOString().split('T')[0]}.csv`}
              url="/api/v1/export/alerts?format=csv"
              disabled={sorted.length === 0}
            />
          </div>
        </div>

        {error && !loading && (
          <div className="flex items-center gap-md mb-md">
            <p role="alert" className="text-apple-red flex-1">{error.message}</p>
            <button type="button" onClick={refetch} className="text-sm text-apple-red underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {sorted.length === 0 ? (
          <EmptyState
            title={t('queue.no_alerts')}
            description={t('queue.all_clear')}
            icon={<ShieldAlert className="w-16 h-16 mx-auto text-apple-green/40" />}
            action={<Button onClick={() => navigate('/')}>Dashboard</Button>}
          />
        ) : grouped ? (
          <div className="space-y-xl">
            {(Object.entries(grouped) as [UrgencyTier, typeof sorted][])
              .filter(([, items]) => items.length > 0)
              .map(([tierKey, items]) => (
                <div key={tierKey}>
                  <div className="flex items-center gap-sm mb-md">
                    <span className={`text-xs font-bold uppercase tracking-wider ${TIER_COLORS[tierKey]}`}>
                      {TIER_LABELS[tierKey]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
                      {items.length}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--dash-border)' }} />
                  </div>
                  <div className="space-y-md">
                    {items.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        urgencyScore={sortMode === 'smart' ? alert.urgencyScore : undefined}
                        onClick={() => navigate(`/alerts/${alert.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="space-y-md">
            {sorted.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onClick={() => navigate(`/alerts/${alert.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
