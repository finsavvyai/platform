import { Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertChannelType = 'email' | 'slack' | 'pagerduty' | 'opsgenie' | 'teams' | 'discord';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AlertChannel {
  id: string;
  channelType: AlertChannelType;
  name: string;
  minSeverity: AlertSeverity;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export const CHANNEL_LABELS: Record<AlertChannelType, string> = {
  email: 'Email', slack: 'Slack', pagerduty: 'PagerDuty',
  opsgenie: 'OpsGenie', teams: 'Microsoft Teams', discord: 'Discord',
};

export const CHANNEL_ICONS: Record<AlertChannelType, ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  slack: <MessageSquare className="h-4 w-4" />,
  pagerduty: <AlertTriangle className="h-4 w-4" />,
  opsgenie: <AlertTriangle className="h-4 w-4" />,
  teams: <MessageSquare className="h-4 w-4" />,
  discord: <MessageSquare className="h-4 w-4" />,
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-signal/10 text-signal border-info/20',
};
