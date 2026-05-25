import { describe, it, expect } from 'vitest';
import { createNotificationChannelSchema } from './notification-channels.js';

describe('createNotificationChannelSchema', () => {
  it('accepts valid email channel', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'email', name: 'Work Email',
      config: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid channel types', () => {
    const types = ['email', 'webhook', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord'];
    for (const channelType of types) {
      const result = createNotificationChannelSchema.safeParse({
        channelType, name: 'Channel', config: '{}',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid channelType', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'sms', name: 'SMS', config: '{}',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Invalid channelType');
  });

  it('rejects missing name', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'email', config: '{}',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'email', name: '', config: '{}',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing config', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'email', name: 'Email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid JSON config', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 'email', name: 'Email', config: 'not-json{',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('config must be valid JSON');
  });

  it('rejects non-string channelType', () => {
    const result = createNotificationChannelSchema.safeParse({
      channelType: 123, name: 'Channel', config: '{}',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = createNotificationChannelSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
