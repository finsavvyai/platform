import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Shield, Plus, Check, Clock } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { useConfig } from '../hooks/useConfig';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ThresholdsPanel } from '../components/config/ThresholdsPanel';
import { ListsPanel } from '../components/config/ListsPanel';

export function Configuration() {
  const { t } = useTranslation('config');
  const { config, loading, error, updateConfig } = useConfig();
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [dismissBelow, setDismissBelow] = useState<number | null>(null);
  const [escalateAbove, setEscalateAbove] = useState<number | null>(null);

  if (loading || !config) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  const th = threshold ?? config.default_threshold * 100;
  const d = dismissBelow ?? config.auto_dismiss_below * 100;
  const ea = escalateAbove ?? config.auto_escalate_above * 100;
  const lists = config.enabled_lists ?? [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({ default_threshold: th / 100, auto_dismiss_below: d / 100, auto_escalate_above: ea / 100 });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-lg">
      <PageHeader title={t('title')} description={t('description')} />
      {error && <p className="text-apple-red sf-caption mb-md" role="alert">{error.message}</p>}
      <div className="max-w-2xl space-y-lg">
        <ThresholdsPanel th={th} d={d} ea={ea} t={t}
          onThreshold={setThreshold} onDismiss={setDismissBelow} onEscalate={setEscalateAbove} />
        <ListsPanel lists={lists} t={t} />
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
