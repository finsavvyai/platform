import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Divider } from '../ui/Divider';

interface Config {
  fuzzyThreshold: number;
  alertThreshold: number;
}

interface ThresholdsCardProps {
  config: Config;
  onChange: (config: Config) => void;
}

export function ThresholdsCard({ config, onChange }: ThresholdsCardProps) {
  const { t } = useTranslation('config');

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('thresholds.title')}</h3>
      <div className="space-y-lg">
        <div>
          <div className="flex items-center justify-between mb-md">
            <label className="sf-body">{t('thresholds.fuzzy_match')}</label>
            <span className="sf-headline">{config.fuzzyThreshold}%</span>
          </div>
          <input type="range" min="0" max="100" value={config.fuzzyThreshold}
            aria-label={t('thresholds.fuzzy_match')}
            aria-valuetext={`${config.fuzzyThreshold}%`}
            onChange={(e) => onChange({ ...config, fuzzyThreshold: parseInt(e.target.value) })}
            className="w-full h-2 bg-apple-bg-tertiary rounded-full appearance-none cursor-pointer accent-[#C9A96E]" />
          <p className="sf-caption mt-sm">{t('thresholds.fuzzy_match_desc')}</p>
        </div>
        <Divider />
        <div>
          <div className="flex items-center justify-between mb-md">
            <label className="sf-body">{t('thresholds.auto_alert')}</label>
            <span className="sf-headline">{config.alertThreshold}%</span>
          </div>
          <input type="range" min="0" max="100" value={config.alertThreshold}
            aria-label={t('thresholds.auto_alert')}
            aria-valuetext={`${config.alertThreshold}%`}
            onChange={(e) => onChange({ ...config, alertThreshold: parseInt(e.target.value) })}
            className="w-full h-2 bg-apple-bg-tertiary rounded-full appearance-none cursor-pointer accent-[#C9A96E]" />
          <p className="sf-caption mt-sm">{t('thresholds.auto_alert_desc')}</p>
        </div>
      </div>
    </Card>
  );
}
