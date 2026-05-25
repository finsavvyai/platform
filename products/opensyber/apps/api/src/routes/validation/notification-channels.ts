import { z } from 'zod';

const VALID_CHANNEL_TYPES = [
  'email', 'webhook', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord',
] as const;

export const createNotificationChannelSchema = z.object({
  channelType: z.enum(VALID_CHANNEL_TYPES, {
    errorMap: () => ({ message: 'Invalid channelType' }),
  }),
  name: z.string().min(1, 'name is required').max(200),
  config: z.string().min(1, 'config is required').refine(
    (val) => { try { JSON.parse(val); return true; } catch { return false; } },
    { message: 'config must be valid JSON' },
  ),
});
