import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeActions,
  type Action,
  type Event,
} from './policy-engine.js';

describe('policy-engine: actions', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {};
  });

  describe('executeActions', () => {
    it('executes all action types: alert, tag, escalate, suppress', async () => {
      const actionMap = [
        { type: 'alert' as const, config: { channel: 'slack' } },
        { type: 'tag' as const, config: { tags: ['urgent'] } },
        { type: 'escalate' as const, config: { role: 'soc' } },
        { type: 'suppress' as const, config: { duration: 3600 } },
      ];

      for (const action of actionMap) {
        const results = await executeActions([action], {
          severity: 'high',
          eventType: 'threat',
          integrationSlug: 'defender',
          summary: 'test',
        }, mockDb);

        expect(results).toHaveLength(1);
        expect(results[0].type).toBe(action.type);
        expect(results[0].executed).toBe(true);
      }
    });

    it('returns executed false for unknown action type', async () => {
      const actions: Action[] = [{ type: 'unknown' as any, config: {} }];
      const results = await executeActions(actions, {
        severity: 'high',
        eventType: 'threat',
        integrationSlug: 'defender',
        summary: 'test',
      }, mockDb);

      expect(results[0].executed).toBe(false);
    });

    it('executes multiple actions in sequence and preserves config', async () => {
      const actions: Action[] = [
        { type: 'alert', config: { channel: 'slack', severity: 'critical' } },
        { type: 'tag', config: { tags: ['critical'] } },
      ];
      const event: Event = {
        severity: 'critical',
        eventType: 'breach',
        integrationSlug: 'defender',
        summary: 'test',
      };

      const results = await executeActions(actions, event, mockDb);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.executed)).toBe(true);
      expect(results[0].config).toEqual({ channel: 'slack', severity: 'critical' });
    });

    it('handles empty action list', async () => {
      const results = await executeActions([], {
        severity: 'high',
        eventType: 'threat',
        integrationSlug: 'defender',
        summary: 'test',
      }, mockDb);

      expect(results).toHaveLength(0);
    });
  });
});
