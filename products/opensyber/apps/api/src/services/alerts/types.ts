/**
 * Alert channel types and interfaces
 *
 * Defines the contract for all alert channel providers.
 */

/**
 * Supported alert channel types
 */
export type AlertChannelType =
  | 'email'
  | 'slack'
  | 'pagerduty'
  | 'opsgenie'
  | 'teams'
  | 'discord';

/**
 * Severity levels for filtering alerts
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Security finding for alert notifications
 */
export interface AlertFinding {
  checkId: string;
  severity: AlertSeverity;
  resourceId: string;
  resourceType: string;
  region: string;
  title: string;
  description: string;
  remediation: string;
}

/**
 * Alert message sent to channels
 */
export interface AlertMessage {
  /** Unique identifier for this alert */
  id: string;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert title/summary */
  title: string;
  /** Detailed description */
  description: string;
  /** Security findings included in this alert */
  findings: AlertFinding[];
  /** Timestamp when alert was generated */
  timestamp: string;
  /** Link to view findings in dashboard */
  dashboardUrl?: string;
  /** Organization name */
  organization?: string;
  /** Cloud account name */
  account?: string;
}

/**
 * Result from sending an alert
 */
export interface AlertResult {
  /** Whether the alert was sent successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** External ID/reference for the sent alert */
  externalId?: string;
}

/** Base configuration for all channels */
export interface BaseChannelConfig {
  type: AlertChannelType;
  minSeverity: AlertSeverity;
  isActive: boolean;
}

/** Email channel configuration */
export interface EmailChannelConfig extends BaseChannelConfig {
  type: 'email';
  to: string[];
  from?: string;
}

/** Slack channel configuration */
export interface SlackChannelConfig extends BaseChannelConfig {
  type: 'slack';
  webhookUrl: string;
  channel?: string;
}

/** PagerDuty channel configuration */
export interface PagerDutyChannelConfig extends BaseChannelConfig {
  type: 'pagerduty';
  integrationKey: string;
  region?: 'us' | 'eu';
}

/** OpsGenie channel configuration */
export interface OpsGenieChannelConfig extends BaseChannelConfig {
  type: 'opsgenie';
  apiKey: string;
  region?: 'us' | 'eu';
}

/** Microsoft Teams channel configuration */
export interface TeamsChannelConfig extends BaseChannelConfig {
  type: 'teams';
  webhookUrl: string;
}

/** Discord channel configuration */
export interface DiscordChannelConfig extends BaseChannelConfig {
  type: 'discord';
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

/** Union type for all channel configurations */
export type ChannelConfig =
  | EmailChannelConfig
  | SlackChannelConfig
  | PagerDutyChannelConfig
  | OpsGenieChannelConfig
  | TeamsChannelConfig
  | DiscordChannelConfig;

/** Interface for alert channel providers */
export interface AlertChannel {
  send(message: AlertMessage, config: ChannelConfig): Promise<AlertResult>;
  validate(config: ChannelConfig): { valid: boolean; error?: string };
}

// Re-export utility functions for backward compatibility
export {
  SEVERITY_RANK,
  meetsMinSeverity,
  filterFindingsBySeverity,
  getSeverityColor,
  getSeverityEmoji,
} from './alert-utils.js';
