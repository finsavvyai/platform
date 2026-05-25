import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface Entity {
  name: string;
  alerts: number;
  risk: string;
}

interface Props {
  entities: Entity[];
}

const riskColor: Record<string, 'red' | 'orange' | 'green' | 'blue'> = {
  critical: 'red', high: 'orange', medium: 'orange', low: 'green',
};

export function TopEntitiesTable({ entities }: Props) {
  const { t } = useTranslation('dashboard');

  if (!entities.length) {
    return (
      <div className="card-vibrancy p-6 text-center">
        <Search className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--dash-text-tertiary)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--dash-text-secondary)' }}>
          No screened entities yet
        </p>
        <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
          Run a screening to populate this list.
        </p>
      </div>
    );
  }

  return (
    <div className="card-vibrancy p-5">
      <h3 className="sf-headline mb-4">{t('top_entities')}</h3>
      <div className="space-y-1.5">
        {entities.map((entity, i) => (
          <div key={entity.name}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--dash-surface-hover)] transition-all">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono w-5 text-center"
                style={{ color: 'var(--dash-text-tertiary)' }}>{i + 1}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>{entity.name}</p>
                <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
                  {entity.alerts} alerts
                </p>
              </div>
            </div>
            <Badge size="sm" color={riskColor[(entity.risk ?? '').toLowerCase()] ?? 'blue'}>
              {entity.risk ?? 'Unknown'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
