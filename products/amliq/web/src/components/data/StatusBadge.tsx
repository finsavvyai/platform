import React from 'react';
import { Badge } from '../ui/Badge';
import type { AlertStatus, AlertPriority } from '../../types';

type BadgeColor = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray';

interface StatusBadgeProps {
  status?: AlertStatus;
  priority?: AlertPriority;
  type?: 'status' | 'priority';
}

export function StatusBadge({ status, priority, type = 'status' }: StatusBadgeProps) {
  if (type === 'status' && status) {
    const colors: Record<AlertStatus, BadgeColor> = {
      open: 'blue',
      investigating: 'orange',
      resolved: 'green',
      archived: 'gray',
    };
    const labels: Record<AlertStatus, string> = {
      open: 'Open',
      investigating: 'Investigating',
      resolved: 'Resolved',
      archived: 'Archived',
    };
    return <Badge color={colors[status]}>{labels[status]}</Badge>;
  }

  if (type === 'priority' && priority) {
    const colors: Record<AlertPriority, BadgeColor> = {
      critical: 'red',
      high: 'orange',
      medium: 'orange',
      low: 'gray',
    };
    return <Badge color={colors[priority]}>{priority.toUpperCase()}</Badge>;
  }

  return null;
}
