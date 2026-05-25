import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateActivity } from './policy-evaluator.js';
import { createMockDb } from '../test/helpers.js';

type MockDb = ReturnType<typeof createMockDb>;

function makeEvent(overrides?: Record<string, unknown>) {
  return {
    id: 'evt-1', userId: 'user-1', type: 'file_read', risk: 'low',
    path: '/etc/passwd', summary: 'read file', secretsCount: 0,
    ...overrides,
  };
}

function makePolicy(overrides?: Record<string, unknown>) {
  return {
    id: 'pol-1', orgId: 'org-1', name: 'Test Policy',
    ruleType: 'file_pattern', ruleConfig: JSON.stringify({ pattern: 'passwd' }),
    severity: 'high', isActive: true,
    ...overrides,
  };
}

describe('evaluateActivity', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-stub');
  });

  describe('file_pattern', () => {
    it('creates violation when regex matches file_read path', async () => {
      db._setSelectResult([makePolicy()]);
      const result = await evaluateActivity(db as any, 'org-1', makeEvent());
      expect(result).toHaveLength(1);
      expect(result[0].summary).toContain('File access matched');
      expect(result[0].summary).toContain('/etc/passwd');
      expect(result[0].severity).toBe('high');
      expect(result[0].policyId).toBe('pol-1');
    });

    it('returns no violation when path does not match', async () => {
      db._setSelectResult([makePolicy()]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ path: '/home/user/notes.txt' }),
      );
      expect(result).toHaveLength(0);
    });

    it('skips non-file_read events', async () => {
      db._setSelectResult([makePolicy()]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ type: 'bash_exec' }),
      );
      expect(result).toHaveLength(0);
    });

    it('skips events with null path', async () => {
      db._setSelectResult([makePolicy()]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ path: null }),
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('command_pattern', () => {
    it('creates violation when regex matches bash_exec summary', async () => {
      const policy = makePolicy({
        ruleType: 'command_pattern',
        ruleConfig: JSON.stringify({ pattern: 'rm\\s+-rf' }),
      });
      db._setSelectResult([policy]);
      const event = makeEvent({ type: 'bash_exec', summary: 'rm -rf /', path: null });
      const result = await evaluateActivity(db as any, 'org-1', event);
      expect(result).toHaveLength(1);
      expect(result[0].summary).toContain('Command matched');
    });

    it('skips file_read events', async () => {
      const policy = makePolicy({
        ruleType: 'command_pattern',
        ruleConfig: JSON.stringify({ pattern: 'rm' }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ type: 'file_read' }),
      );
      expect(result).toHaveLength(0);
    });

    it('returns no violation when summary does not match', async () => {
      const policy = makePolicy({
        ruleType: 'command_pattern',
        ruleConfig: JSON.stringify({ pattern: 'rm\\s+-rf' }),
      });
      db._setSelectResult([policy]);
      const event = makeEvent({ type: 'bash_exec', summary: 'ls -la', path: null });
      const result = await evaluateActivity(db as any, 'org-1', event);
      expect(result).toHaveLength(0);
    });
  });

  describe('risk_threshold', () => {
    it('creates violation when event risk exceeds threshold', async () => {
      const policy = makePolicy({
        ruleType: 'risk_threshold',
        ruleConfig: JSON.stringify({ maxRisk: 'medium' }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ risk: 'critical' }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].summary).toContain('exceeds threshold');
    });

    it('returns no violation when risk is within limit', async () => {
      const policy = makePolicy({
        ruleType: 'risk_threshold',
        ruleConfig: JSON.stringify({ maxRisk: 'high' }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ risk: 'medium' }),
      );
      expect(result).toHaveLength(0);
    });

    it('returns no violation when risk equals threshold', async () => {
      const policy = makePolicy({
        ruleType: 'risk_threshold',
        ruleConfig: JSON.stringify({ maxRisk: 'high' }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ risk: 'high' }),
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('secrets_threshold', () => {
    it('creates violation when secrets exceed limit', async () => {
      const policy = makePolicy({
        ruleType: 'secrets_threshold',
        ruleConfig: JSON.stringify({ maxSecrets: 2 }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ secretsCount: 5 }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].summary).toContain('Secrets count 5 exceeds limit 2');
    });

    it('returns no violation when secrets within limit', async () => {
      const policy = makePolicy({
        ruleType: 'secrets_threshold',
        ruleConfig: JSON.stringify({ maxSecrets: 10 }),
      });
      db._setSelectResult([policy]);
      const result = await evaluateActivity(
        db as any, 'org-1', makeEvent({ secretsCount: 3 }),
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles multiple policies, some matching some not', async () => {
      db._setSelectResult([
        makePolicy({ id: 'pol-match', ruleConfig: JSON.stringify({ pattern: 'passwd' }) }),
        makePolicy({ id: 'pol-miss', ruleConfig: JSON.stringify({ pattern: 'shadow' }) }),
      ]);
      const result = await evaluateActivity(db as any, 'org-1', makeEvent());
      expect(result).toHaveLength(1);
      expect(result[0].policyId).toBe('pol-match');
    });

    it('skips policies with invalid JSON ruleConfig', async () => {
      db._setSelectResult([makePolicy({ ruleConfig: '{bad json' })]);
      const result = await evaluateActivity(db as any, 'org-1', makeEvent());
      expect(result).toHaveLength(0);
    });

    it('falls back to includes() when regex is invalid', async () => {
      db._setSelectResult([
        makePolicy({ ruleConfig: JSON.stringify({ pattern: '[invalid(' }) }),
      ]);
      const event = makeEvent({ path: '/etc/[invalid(' });
      const result = await evaluateActivity(db as any, 'org-1', event);
      expect(result).toHaveLength(1);
    });

    it('returns empty and does not insert when no active policies', async () => {
      db._setSelectResult([]);
      const result = await evaluateActivity(db as any, 'org-1', makeEvent());
      expect(result).toHaveLength(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('inserts violations into DB when violations found', async () => {
      db._setSelectResult([makePolicy()]);
      await evaluateActivity(db as any, 'org-1', makeEvent());
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db._insertChain.values).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ policyId: 'pol-1' })]),
      );
    });
  });
});
