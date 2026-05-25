import { useTranslation } from 'react-i18next';
import { Shield, Globe, Flag, Database, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';

export type LayerKey = 'ofac' | 'eu' | 'un' | 'custom';

// Each layer maps to one or more backend list/dataset identifiers.
// Tooltip exposes this so users know exactly what's screened per layer.
export const LAYER_LISTS: Record<LayerKey, string[]> = {
  ofac: ['OFAC SDN', 'OFAC Non-SDN PLC', 'OFAC Consolidated'],
  eu: ['EU Consolidated Sanctions', 'EU Financial Sanctions'],
  un: ['UN Consolidated', 'UN Security Council 1267/1989/2253', 'UN 1988'],
  custom: ['PEP List (OpenSanctions)', 'Adverse Media', 'Tenant Custom Lists'],
};

const layerConfig: {
  key: LayerKey; icon: typeof Shield; color: string; glow: string; label: string;
}[] = [
  { key: 'ofac', icon: Shield, color: 'text-apple-red', glow: 'shadow-[0_0_12px_rgba(255,69,58,0.15)]', label: 'layers.ofac_sdn' },
  { key: 'eu', icon: Globe, color: 'text-[#C9A96E]', glow: 'shadow-sm', label: 'layers.eu_sanctions' },
  { key: 'un', icon: Flag, color: 'text-apple-orange', glow: 'shadow-[0_0_12px_rgba(255,159,10,0.15)]', label: 'layers.un_consolidated' },
  { key: 'custom', icon: Database, color: 'text-apple-green', glow: 'shadow-[0_0_12px_rgba(48,209,88,0.15)]', label: 'layers.custom_lists' },
];

interface Props {
  value: Record<LayerKey, boolean>;
  onChange: (next: Record<LayerKey, boolean>) => void;
}

export function ScreeningLayersList({ value, onChange }: Props) {
  const { t } = useTranslation('screening');

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('layers.title')}</h3>
      <div className="space-y-sm">
        {layerConfig.map(({ key, icon: Icon, color, glow, label }) => {
          const lists = LAYER_LISTS[key];
          const tooltip = `Covers: ${lists.join(' · ')}`;
          return (
            <div key={key}
              className={`flex items-center gap-md p-md rounded-apple-md transition-all ${value[key] ? glow : ''}`}
              style={{ background: 'var(--dash-surface)', border: '0.5px solid var(--dash-border)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--dash-bg-secondary)' }}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <Toggle
                  checked={value[key]}
                  onChange={(v) => onChange({ ...value, [key]: v })}
                  label={t(label)}
                />
                <p className="text-[10px] mt-xs truncate" style={{ color: 'var(--dash-text-tertiary)' }}
                  title={tooltip}>
                  {lists.length} list{lists.length === 1 ? '' : 's'} · {lists[0]}
                  {lists.length > 1 ? ` + ${lists.length - 1} more` : ''}
                </p>
              </div>
              <span title={tooltip} aria-label={tooltip} className="cursor-help shrink-0">
                <Info className="w-3.5 h-3.5" style={{ color: 'var(--dash-text-tertiary)' }} />
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
