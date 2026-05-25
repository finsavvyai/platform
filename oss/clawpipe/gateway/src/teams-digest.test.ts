/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidTeamsWebhook,
  formatBudgetAlertCard,
  formatDigestCard,
  postToTeams,
} from './teams-digest';
import type { DigestStats } from './slack-digest';

const VALID_URL = 'https://contoso.webhook.office.com/webhookb2/abc123';
const VALID_US_URL = 'https://contoso.webhook.office.us/webhookb2/abc123';

describe('isValidTeamsWebhook', () => {
  it('accepts *.webhook.office.com URL', () => {
    expect(isValidTeamsWebhook(VALID_URL)).toBe(true);
  });

  it('accepts *.webhook.office.us URL', () => {
    expect(isValidTeamsWebhook(VALID_US_URL)).toBe(true);
  });

  it('rejects http (non-TLS) URLs', () => {
    expect(isValidTeamsWebhook('http://contoso.webhook.office.com/webhookb2/abc')).toBe(false);
  });

  it('rejects Slack webhook URLs', () => {
    expect(isValidTeamsWebhook('https://hooks.slack.com/services/T1/B1/xxx')).toBe(false);
  });

  it('rejects arbitrary HTTPS URLs', () => {
    expect(isValidTeamsWebhook('https://evil.example.com/hook')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidTeamsWebhook('not a url')).toBe(false);
    expect(isValidTeamsWebhook('')).toBe(false);
  });

  it('rejects URL with office.com in path but wrong host', () => {
    expect(isValidTeamsWebhook('https://evil.com/webhook.office.com/hook')).toBe(false);
  });
});

describe('formatBudgetAlertCard', () => {
  it('returns @type MessageCard', () => {
    const card = formatBudgetAlertCard('my-app', 80, 80, 100) as Record<string, unknown>;
    expect(card['@type']).toBe('MessageCard');
  });

  it('returns @context schema.org/extensions', () => {
    const card = formatBudgetAlertCard('my-app', 80, 80, 100) as Record<string, unknown>;
    expect(card['@context']).toBe('https://schema.org/extensions');
  });

  it('includes themeColor field', () => {
    const card = formatBudgetAlertCard('my-app', 80, 80, 100) as Record<string, unknown>;
    expect(typeof card['themeColor']).toBe('string');
  });

  it('includes summary with project name', () => {
    const card = formatBudgetAlertCard('prod-api', 80, 80, 100) as Record<string, unknown>;
    expect(String(card['summary'])).toContain('prod-api');
  });

  it('shows spend and cap in facts', () => {
    const card = formatBudgetAlertCard('app', 50, 50, 100) as {
      sections: Array<{ facts: Array<{ name: string; value: string }> }>
    };
    const facts = card.sections[0].facts;
    expect(facts.some((f) => f.value.includes('$50.00'))).toBe(true);
    expect(facts.some((f) => f.value.includes('$100.00'))).toBe(true);
  });

  it('uses red theme at 100%', () => {
    const card = formatBudgetAlertCard('app', 100, 100, 100) as { themeColor: string };
    expect(card.themeColor).toBe('FF0000');
  });

  it('uses orange theme at 80%', () => {
    const card = formatBudgetAlertCard('app', 80, 80, 100) as { themeColor: string };
    expect(card.themeColor).toBe('FFA500');
  });

  it('uses blue theme at 50%', () => {
    const card = formatBudgetAlertCard('app', 50, 50, 100) as { themeColor: string };
    expect(card.themeColor).toBe('0078D4');
  });
});

const baseStats: DigestStats = {
  projectName: 'my-app',
  totalRequests: 5000,
  totalCost: 42.10,
  cachedPct: 30.0,
  boostedPct: 20.0,
  avgLatencyMs: 310,
  topModels: [
    { model: 'gpt-4o', cost: 28.00, requests: 3000 },
    { model: 'claude-3-5-sonnet', cost: 14.10, requests: 2000 },
  ],
  costDeltaPct: -8.5,
};

describe('formatDigestCard', () => {
  it('returns @type MessageCard', () => {
    const card = formatDigestCard(baseStats) as Record<string, unknown>;
    expect(card['@type']).toBe('MessageCard');
  });

  it('includes project name in summary', () => {
    const card = formatDigestCard(baseStats) as Record<string, unknown>;
    expect(String(card['summary'])).toContain('my-app');
  });

  it('includes total cost in summary', () => {
    const card = formatDigestCard(baseStats) as Record<string, unknown>;
    expect(String(card['summary'])).toContain('$42.10');
  });

  it('shows negative delta', () => {
    const card = formatDigestCard(baseStats);
    expect(JSON.stringify(card)).toContain('-8.5%');
  });

  it('shows first-week fallback when no prior data', () => {
    const card = formatDigestCard({ ...baseStats, costDeltaPct: null });
    expect(JSON.stringify(card)).toContain('First week of data');
  });

  it('shows empty-state when no models', () => {
    const card = formatDigestCard({ ...baseStats, topModels: [] });
    expect(JSON.stringify(card)).toContain('No requests this week');
  });

  it('includes dashboard link in potentialAction', () => {
    const card = formatDigestCard(baseStats);
    expect(JSON.stringify(card)).toContain('app.clawpipe.ai');
  });
});

describe('postToTeams', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for invalid URL without calling fetch', async () => {
    const result = await postToTeams('https://evil.example.com/hook', {});
    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns true on 200 response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true });
    const result = await postToTeams(VALID_URL, { '@type': 'MessageCard' });
    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(VALID_URL, expect.objectContaining({ method: 'POST' }));
  });

  it('returns false on non-2xx response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 429 });
    const result = await postToTeams(VALID_URL, {});
    expect(result).toBe(false);
  });

  it('returns false and does not throw when fetch rejects', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'));
    await expect(postToTeams(VALID_URL, {})).resolves.toBe(false);
  });
});
