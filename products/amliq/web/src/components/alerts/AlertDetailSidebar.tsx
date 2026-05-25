import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../data/StatusBadge';
import type { Alert } from '../../types';

interface SidebarProps {
  alert: Alert;
}

export function AlertDetailSidebar({ alert }: SidebarProps) {
  const { t } = useTranslation('alerts');
  type BadgeColor = 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'gray';
  const riskColor: Record<string, BadgeColor> = { critical: 'red', high: 'orange', medium: 'orange', low: 'green' };

  return (
    <div className="space-y-lg">
      <Card>
        <h3 className="sf-headline mb-lg">{t('sidebar.status')}</h3>
        <div className="space-y-md">
          <div>
            <p className="sf-caption mb-xs">{t('sidebar.current_status')}</p>
            <StatusBadge status={alert.status} type="status" />
          </div>
          <div>
            <p className="sf-caption mb-xs">{t('sidebar.priority')}</p>
            <StatusBadge priority={alert.priority} type="priority" />
          </div>
          <div>
            <p className="sf-caption mb-xs">{t('sidebar.risk_level')}</p>
            <Badge color={riskColor[alert.riskLevel]}>{alert.riskLevel}</Badge>
          </div>
          {alert.investigator && (
            <div>
              <p className="sf-caption mb-xs">{t('sidebar.investigator')}</p>
              <p className="sf-body">{alert.investigator}</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="sf-headline mb-lg">{t('sidebar.timeline')}</h3>
        <div className="space-y-md text-sm">
          <div>
            <p className="sf-caption">Created</p>
            <p className="sf-body">{new Date(alert.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="sf-caption">Updated</p>
            <p className="sf-body">{new Date(alert.updatedAt).toLocaleString()}</p>
          </div>
          {alert.duoAt && (
            <div>
              <p className="sf-caption">Due</p>
              <p className="sf-body">{new Date(alert.duoAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
