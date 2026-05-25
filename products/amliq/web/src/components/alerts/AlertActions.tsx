import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface AlertActionsProps {
  onConfirm?: () => void;
  onFalsePositive?: () => void;
  onEscalate?: () => void;
  onDraftAI?: () => void;
  disabled?: boolean;
}

export function AlertActions({
  onConfirm,
  onFalsePositive,
  onEscalate,
  onDraftAI,
  disabled,
}: AlertActionsProps) {
  const { t } = useTranslation('alerts');
  const [showReason, setShowReason] = useState(false);

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('actions.title')}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={disabled}
          className="flex items-center justify-center gap-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="hidden md:inline">{t('actions.confirm')}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onFalsePositive}
          disabled={disabled}
          className="flex items-center justify-center gap-sm"
        >
          <XCircle className="w-4 h-4" />
          <span className="hidden md:inline">{t('actions.false_positive')}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onEscalate}
          disabled={disabled}
          className="flex items-center justify-center gap-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="hidden md:inline">{t('actions.escalate')}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onDraftAI}
          disabled={disabled}
          className="flex items-center justify-center gap-sm"
        >
          <Zap className="w-4 h-4" />
          <span className="hidden md:inline">{t('actions.ai_draft')}</span>
        </Button>
      </div>
    </Card>
  );
}
