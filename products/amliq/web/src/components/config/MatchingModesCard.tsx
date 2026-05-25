import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { Divider } from '../ui/Divider';

interface ModesProps {
  strictMatching: boolean;
  autoAlert: boolean;
  onChange: (key: string, value: boolean) => void;
}

export function MatchingModesCard({ strictMatching, autoAlert, onChange }: ModesProps) {
  const { t } = useTranslation('config');

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('modes.title')}</h3>
      <div className="space-y-md">
        <div>
          <Toggle
            checked={strictMatching}
            onChange={(v) => onChange('strictMatching', v)}
            label={t('modes.strict')}
          />
          <p className="sf-caption mt-sm">{t('modes.strict_desc')}</p>
        </div>
        <Divider />
        <div>
          <Toggle
            checked={autoAlert}
            onChange={(v) => onChange('autoAlert', v)}
            label={t('modes.auto_alert')}
          />
          <p className="sf-caption mt-sm">{t('modes.auto_alert_desc')}</p>
        </div>
      </div>
    </Card>
  );
}
