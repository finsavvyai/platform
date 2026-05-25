/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pendingThresholds, parseFiredThresholds, currentMonth, maybeFireBudgetAlerts, type BudgetStatus } from './budget';

const status = (pct: number, cap = 100): BudgetStatus => ({
  monthlyCap: cap, usedMtd: cap * pct / 100, pct, over: pct >= 100,
});

describe('pendingThresholds', () => {
  it('returns empty when cap is null', () => {
    expect(pendingThresholds({ monthlyCap: null, usedMtd: 0, pct: 0, over: false }, null)).toEqual([]);
  });

  it('returns empty when cap is 0', () => {
    expect(pendingThresholds(status(50, 0), null)).toEqual([]);
  });

  it('returns 50 when crossing first threshold with empty history', () => {
    expect(pendingThresholds(status(55), null)).toEqual([50]);
  });

  it('returns 50 + 80 when crossing both with empty history', () => {
    expect(pendingThresholds(status(85), null)).toEqual([50, 80]);
  });

  it('returns all three when over budget with empty history', () => {
    expect(pendingThresholds(status(105), null)).toEqual([50, 80, 100]);
  });

  it('skips already-fired thresholds for current month', () => {
    const month = currentMonth();
    expect(pendingThresholds(status(85), { [month]: [50] })).toEqual([80]);
  });

  it('ignores thresholds fired in prior months', () => {
    expect(pendingThresholds(status(85), { '2025-01': [50, 80] })).toEqual([50, 80]);
  });

  it('returns empty when nothing crossed', () => {
    expect(pendingThresholds(status(10), null)).toEqual([]);
  });
});

describe('parseFiredThresholds', () => {
  it('returns null for null input', () => {
    expect(parseFiredThresholds(null)).toBeNull();
  });

  it('parses valid JSON', () => {
    expect(parseFiredThresholds('{"2026-04":[50,80]}')).toEqual({ '2026-04': [50, 80] });
  });

  it('returns null on malformed JSON', () => {
    expect(parseFiredThresholds('not json')).toBeNull();
  });

  it('rejects non-object JSON', () => {
    expect(parseFiredThresholds('"a string"')).toBeNull();
    expect(parseFiredThresholds('42')).toBeNull();
  });
});

describe('currentMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('maybeFireBudgetAlerts — Teams path', () => {
  const postToTeamsSpy = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.doMock('./teams-digest', () => ({
      formatBudgetAlertCard: vi.fn().mockReturnValue({ '@type': 'MessageCard' }),
      postToTeams: postToTeamsSpy,
    }));
    vi.doMock('./slack-digest', () => ({
      formatBudgetAlertBlocks: vi.fn().mockReturnValue({}),
      postToSlack: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('./email-digest', () => ({
      formatBudgetAlertEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
      sendEmail: vi.fn().mockResolvedValue(true),
    }));
    vi.doMock('./webhook-emit', () => ({ emitWebhook: vi.fn().mockResolvedValue(undefined) }));
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('calls postToTeams when teams_webhook_url is set and threshold crossed', async () => {
    const env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn()
              .mockResolvedValueOnce({
                name: 'proj', slack_webhook_url: null, digest_email: null,
                teams_webhook_url: 'https://contoso.webhook.office.com/webhookb2/abc',
                threshold_alerts_fired: null,
              })
              .mockResolvedValueOnce({ monthly_budget_usd: 100 })
              .mockResolvedValueOnce({ cost: 85 })
              .mockResolvedValueOnce({ threshold_alerts_fired: null }),
            run: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      },
    } as unknown as import('./types').Env;

    await maybeFireBudgetAlerts(env, 'proj-1');
    expect(postToTeamsSpy).toHaveBeenCalled();
  });
});
