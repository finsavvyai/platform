/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { PipelineGuards } from './pipeline-guards';

describe('PipelineGuards', () => {
  describe('runPre — no rules', () => {
    it('returns prompt unchanged and blocked=false when rules is empty', async () => {
      const pg = new PipelineGuards();
      const result = await pg.runPre('hello world', [], {});
      expect(result.blocked).toBe(false);
      expect(result.prompt).toBe('hello world');
    });
  });

  describe('runPre — contains guard', () => {
    it('blocks prompt containing forbidden word', async () => {
      const pg = new PipelineGuards();
      const rules = [{ guard: 'contains', config: { words: ['badword'] }, blockOnFail: true }];
      const result = await pg.runPre('this has badword in it', rules, {});
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('badword');
    });

    it('allows prompt with no forbidden words', async () => {
      const pg = new PipelineGuards();
      const rules = [{ guard: 'contains', config: { words: ['forbidden'] } }];
      const result = await pg.runPre('clean prompt', rules, {});
      expect(result.blocked).toBe(false);
    });
  });

  describe('runPre — regex_match guard', () => {
    it('blocks when prompt matches disallowed pattern', async () => {
      const pg = new PipelineGuards();
      const rules = [{ guard: 'regex_match', config: { pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}' }, blockOnFail: true }];
      const result = await pg.runPre('my card is 1234-5678-9012-3456', rules, {});
      expect(result.blocked).toBe(true);
    });

    it('allows when prompt does not match disallowed pattern', async () => {
      const pg = new PipelineGuards();
      const rules = [{ guard: 'regex_match', config: { pattern: 'BADPATTERN' } }];
      const result = await pg.runPre('clean prompt', rules, {});
      expect(result.blocked).toBe(false);
    });
  });

  describe('runPre — regex_replace guard', () => {
    it('replaces matched content in prompt', async () => {
      const pg = new PipelineGuards();
      const rules = [{ guard: 'regex_replace', config: { pattern: '\\d{3}-\\d{2}-\\d{4}', replacement: '[REDACTED]' } }];
      const result = await pg.runPre('ssn: 123-45-6789', rules, {});
      expect(result.blocked).toBe(false);
      expect(result.prompt).toContain('[REDACTED]');
      expect(result.prompt).not.toContain('123-45-6789');
    });
  });

  describe('runPre — custom registry', () => {
    it('accepts a custom registry and uses it', async () => {
      let preCallCalled = false;
      const customRegistry = {
        runPre: async (ctx: { prompt: string }, _rules: unknown[]) => {
          preCallCalled = true;
          return { allPass: true, safePrompt: ctx.prompt, outcomes: [] };
        },
      };
      const pg = new PipelineGuards(customRegistry as never);
      const rules = [{ guard: 'custom' }];
      await pg.runPre('test', rules, {});
      expect(preCallCalled).toBe(true);
    });

    it('returns reason from blocked outcome', async () => {
      const customRegistry = {
        runPre: async (_ctx: unknown, _rules: unknown[]) => ({
          allPass: false,
          safePrompt: 'safe',
          outcomes: [{ blocked: true, reason: 'injection detected' }],
        }),
      };
      const pg = new PipelineGuards(customRegistry as never);
      const rules = [{ guard: 'custom', blockOnFail: true }];
      const result = await pg.runPre('inject prompt', rules, {});
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('injection detected');
    });

    it('falls back to "blocked" reason when no blocked outcome has reason', async () => {
      const customRegistry = {
        runPre: async (_ctx: unknown, _rules: unknown[]) => ({
          allPass: false,
          safePrompt: 'safe',
          outcomes: [{ blocked: true }],
        }),
      };
      const pg = new PipelineGuards(customRegistry as never);
      const rules = [{ guard: 'custom', blockOnFail: true }];
      const result = await pg.runPre('prompt', rules, {});
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('blocked');
    });
  });
});
