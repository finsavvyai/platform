import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Alert } from '../../types';

interface Props {
  alert: Alert;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="sf-caption mb-xs" style={{ color: 'var(--dash-text-tertiary)' }}>{label}</p>
      <p className="sf-body" style={{ color: 'var(--dash-text)' }}>{value}</p>
    </div>
  );
}

export function EntityDetailsCard({ alert }: Props) {
  const { t } = useTranslation('alerts');
  const { entity } = alert;
  const fullName = entity.name?.fullName
    ?? [entity.name?.firstName, entity.name?.lastName].filter(Boolean).join(' ');
  const aliases = entity.name?.aliases ?? [];
  const identifiers = entity.identifiers ?? [];

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('entity_details.title')}</h3>
      <div className="grid grid-cols-2 gap-lg">
        <Field label={t('entity_details.type')} value={entity.type} />
        <Field label={t('entity_details.nationality')} value={entity.nationality} />
        {entity.dob && (
          <Field label={t('entity_details.dob')} value={new Date(entity.dob).toLocaleDateString()} />
        )}
        <Field label={t('entity_details.matches_found')} value={String(alert.matchedCount)} />
        {fullName && <Field label="Full Name" value={fullName} />}
        {entity.businessType && <Field label="Business Type" value={entity.businessType} />}
        {entity.address && (
          <Field label="Address"
            value={[entity.address.street, entity.address.city, entity.address.country]
              .filter(Boolean).join(', ')} />
        )}
      </div>

      {aliases.length > 0 && (
        <div className="mt-md">
          <p className="sf-caption mb-xs" style={{ color: 'var(--dash-text-tertiary)' }}>Aliases</p>
          <div className="flex flex-wrap gap-xs">
            {aliases.map((a) => <Badge key={a} color="gray" size="sm">{a}</Badge>)}
          </div>
        </div>
      )}

      {identifiers.length > 0 && (
        <div className="mt-md">
          <p className="sf-caption mb-xs" style={{ color: 'var(--dash-text-tertiary)' }}>Identifiers</p>
          <div className="space-y-xs">
            {identifiers.map((id, i) => (
              <div key={i} className="flex items-baseline gap-sm">
                <Badge color="purple" size="sm">{id.type}</Badge>
                <span className="sf-caption" style={{ color: 'var(--dash-text)' }}>{id.value}</span>
                {id.issuer && (
                  <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>({id.issuer})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
