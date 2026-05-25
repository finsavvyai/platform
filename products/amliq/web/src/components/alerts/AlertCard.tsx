import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../data/StatusBadge';
import type { Alert } from '../../types';

interface AlertCardProps {
  alert: Alert;
  onClick?: () => void;
  urgencyScore?: number;
}

const borderColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-amber-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-emerald-500',
};

const glowColors: Record<string, string> = {
  critical: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]',
  high: 'hover:shadow-sm',
  medium: 'hover:shadow-[0_0_16px_rgba(234,179,8,0.06)]',
  low: 'hover:shadow-[0_0_16px_rgba(34,197,94,0.06)]',
};

const riskBadgeColor: Record<string, 'red' | 'orange' | 'green'> = {
  critical: 'red', high: 'orange', medium: 'orange', low: 'green',
};

export function AlertCard({ alert, onClick, urgencyScore }: AlertCardProps) {
  const { t } = useTranslation('alerts');
  const fullName = alert.entity.name.fullName
    || `${alert.entity.name.firstName} ${alert.entity.name.lastName}`;

  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left card-vibrancy p-4 border-l-[3px] ${borderColors[alert.riskLevel]}
        ${glowColors[alert.riskLevel]} hover:-translate-y-0.5
        transition-all cursor-pointer group`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="sf-headline truncate" title={fullName}>{fullName}</h3>
          <p className="sf-caption mt-0.5">{alert.entity.type}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {urgencyScore !== undefined && (
            <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
              style={{ background: 'var(--dash-surface)', color: 'var(--dash-text-tertiary)' }}
              title="Urgency score">
              {Math.round(urgencyScore)}
            </span>
          )}
          <ChevronRight className="w-5 h-5" style={{ color: 'var(--dash-text-tertiary)' }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <StatusBadge status={alert.status} type="status" />
        <StatusBadge priority={alert.priority} type="priority" />
        <Badge color={riskBadgeColor[alert.riskLevel]} size="sm">{t('card.risk')} {alert.riskLevel}</Badge>
      </div>
      <p className="sf-caption line-clamp-2 mb-2" title={alert.notes}>{alert.notes}</p>
      <div className="flex justify-between">
        <p className="sf-caption">{alert.matchedCount} matches</p>
        <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
          {new Date(alert.createdAt).toLocaleDateString()}
        </p>
      </div>
    </button>
  );
}
