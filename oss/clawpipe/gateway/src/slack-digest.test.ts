/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { isValidSlackWebhook, formatSlackBlocks, type DigestStats } from './slack-digest';

describe('isValidSlackWebhook', () => {
  it('accepts canonical Slack webhook URL', () => {
    expect(isValidSlackWebhook('https://hooks.slack.com/services/T1/B1/xxxx')).toBe(true);
  });

  it('rejects http (non-TLS) URLs', () => {
    expect(isValidSlackWebhook('http://hooks.slack.com/services/T1/B1/xxxx')).toBe(false);
  });

  it('rejects URLs from other hosts', () => {
    expect(isValidSlackWebhook('https://evil.example/services/T1/B1/xxxx')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isValidSlackWebhook('not a url')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidSlackWebhook('')).toBe(false);
  });
});

describe('formatSlackBlocks', () => {
  const baseStats: DigestStats = {
    projectName: 'my-app',
    totalRequests: 12500,
    totalCost: 47.82,
    cachedPct: 35.4,
    boostedPct: 28.1,
    avgLatencyMs: 284,
    topModels: [
      { model: 'gpt-4o', cost: 30.50, requests: 5200 },
      { model: 'claude-3-5-sonnet', cost: 14.12, requests: 3100 },
      { model: 'gpt-4o-mini', cost: 3.20, requests: 4200 },
    ],
    costDeltaPct: -12.4,
  };

  it('puts project name in header', () => {
    const payload = formatSlackBlocks(baseStats) as { blocks: Array<{ type: string; text?: { text: string } }> };
    const header = payload.blocks.find((b) => b.type === 'header');
    expect(header?.text?.text).toContain('my-app');
  });

  it('shows cost with dollar sign and two decimals', () => {
    const payload = formatSlackBlocks(baseStats) as { text: string };
    expect(payload.text).toContain('$47.82');
  });

  it('includes negative delta when cost dropped', () => {
    const payload = formatSlackBlocks(baseStats);
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('-12.4%');
    expect(serialized).toContain('📉');
  });

  it('shows positive delta marker when cost grew', () => {
    const payload = formatSlackBlocks({ ...baseStats, costDeltaPct: 8.3 });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('+8.3%');
    expect(serialized).toContain('📈');
  });

  it('falls back to first-week message when no prior delta', () => {
    const payload = formatSlackBlocks({ ...baseStats, costDeltaPct: null });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('First week of data');
  });

  it('shows empty-state message when no models', () => {
    const payload = formatSlackBlocks({ ...baseStats, topModels: [], totalRequests: 0 });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('No requests this week');
  });

  it('includes dashboard and FinOps links in context', () => {
    const payload = formatSlackBlocks(baseStats);
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('app.clawpipe.ai');
    expect(serialized).toContain('clawpipe.ai/finops');
  });

  it('uses Block Kit header + section + divider structure', () => {
    const payload = formatSlackBlocks(baseStats) as { blocks: Array<{ type: string }> };
    const types = payload.blocks.map((b) => b.type);
    expect(types).toContain('header');
    expect(types).toContain('section');
    expect(types).toContain('divider');
    expect(types).toContain('context');
  });
});
