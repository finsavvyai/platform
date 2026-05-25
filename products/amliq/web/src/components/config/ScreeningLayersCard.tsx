import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';

const layers = [
  'OFAC Specially Designated Nationals',
  'OFAC Consolidated Non-SDN',
  'EU Consolidated Sanctions List',
  'UN Security Council',
  'UK Sanctions List',
  'Canada UNSC',
];

export function ScreeningLayersCard() {
  const { t } = useTranslation('config');
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(
    layers.reduce((acc, layer) => ({ ...acc, [layer]: true }), {})
  );

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('layers.title')}</h3>
      <div className="space-y-md">
        {layers.map((layer) => (
          <Toggle
            key={layer}
            checked={enabled[layer]}
            onChange={(v) => setEnabled({ ...enabled, [layer]: v })}
            label={layer}
          />
        ))}
      </div>
    </Card>
  );
}
