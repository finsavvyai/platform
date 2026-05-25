import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { AlertStatus, AlertPriority } from '../../types';

interface AlertFiltersProps {
  selectedStatus: AlertStatus[];
  selectedPriority: AlertPriority[];
  onStatusChange: (status: AlertStatus[]) => void;
  onPriorityChange: (priority: AlertPriority[]) => void;
  onReset: () => void;
}

const statuses: AlertStatus[] = ['open', 'investigating', 'resolved', 'archived'];
const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low'];

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`px-3 py-1.5 rounded-full transition-all text-xs font-semibold cursor-pointer
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A96E]/50
        ${active ? 'bg-[#1A1814] text-white' : ''}`}
      style={active ? undefined : { background: 'var(--dash-surface)', color: 'var(--dash-text)' }}>
      {label}
    </button>
  );
}

export function AlertFilters({
  selectedStatus, selectedPriority, onStatusChange, onPriorityChange, onReset,
}: AlertFiltersProps) {
  const { t } = useTranslation('alerts');

  const toggleStatus = (s: AlertStatus) =>
    onStatusChange(selectedStatus.includes(s) ? selectedStatus.filter(x => x !== s) : [...selectedStatus, s]);

  const togglePriority = (p: AlertPriority) =>
    onPriorityChange(selectedPriority.includes(p) ? selectedPriority.filter(x => x !== p) : [...selectedPriority, p]);

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <p className="sf-caption mb-2">{t('filters.status')}</p>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(s => (
              <FilterChip key={s} label={t(`filters.${s}`)} active={selectedStatus.includes(s)} onClick={() => toggleStatus(s)} />
            ))}
          </div>
        </div>
        <div>
          <p className="sf-caption mb-2">{t('filters.priority')}</p>
          <div className="flex flex-wrap gap-1.5">
            {priorities.map(p => (
              <FilterChip key={p} label={t(`filters.${p}`)} active={selectedPriority.includes(p)} onClick={() => togglePriority(p)} />
            ))}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onReset} className="w-full">Reset</Button>
      </div>
    </Card>
  );
}
