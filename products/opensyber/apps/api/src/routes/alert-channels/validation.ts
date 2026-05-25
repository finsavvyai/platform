/**
 * Alert Channel Zod Schemas and Validation
 *
 * Zod-based validation for all alert channel configurations.
 * Replaces manual type guards with declarative schemas.
 */

import { z } from 'zod';

export type AlertChannelType = 'email' | 'slack' | 'pagerduty' | 'opsgenie' | 'teams' | 'discord';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export const VALID_CHANNEL_TYPES: AlertChannelType[] = [
  'email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord',
];
export const VALID_SEVERITIES: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];

/** Email channel config schema */
export const emailConfigSchema = z.object({
  to: z.array(z.string().includes('@')).min(1),
  from: z.string().includes('@').optional(),
});

/** Slack channel config schema */
export const slackConfigSchema = z.object({
  webhookUrl: z.string().startsWith('https://'),
  channel: z.string().optional(),
});

/** PagerDuty channel config schema */
export const pagerDutyConfigSchema = z.object({
  integrationKey: z.string().min(1),
  region: z.enum(['us', 'eu']).optional(),
});

/** OpsGenie channel config schema */
export const opsGenieConfigSchema = z.object({
  apiKey: z.string().min(1),
  region: z.enum(['us', 'eu']).optional(),
});

/** Teams channel config schema */
export const teamsConfigSchema = z.object({
  webhookUrl: z.string().startsWith('https://'),
});

/** Discord channel config schema */
export const discordConfigSchema = z.object({
  webhookUrl: z.string().startsWith('https://'),
  username: z.string().max(32).optional(),
  avatarUrl: z.string().optional(),
});

/** Map of channel type to its Zod schema */
const configSchemas: Record<AlertChannelType, z.ZodTypeAny> = {
  email: emailConfigSchema,
  slack: slackConfigSchema,
  pagerduty: pagerDutyConfigSchema,
  opsgenie: opsGenieConfigSchema,
  teams: teamsConfigSchema,
  discord: discordConfigSchema,
};

/** Create channel request body schema */
export const createChannelSchema = z.object({
  channelType: z.enum(['email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord']),
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()),
  minSeverity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  isActive: z.boolean().default(true),
});

/** Update channel request body schema */
export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minSeverity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

/** Validate channel-specific config by type, returns true if valid */
export function validateChannelConfig(
  channelType: AlertChannelType,
  config: unknown,
): boolean {
  const schema = configSchemas[channelType];
  return schema.safeParse(config).success;
}
