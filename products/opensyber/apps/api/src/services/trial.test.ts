import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

// Mock email service
const mockSendTrialEndingEmail = vi.fn();
const mockSendTrialExpiredEmail = vi.fn();

vi.mock('./email.js', () => ({
  emailService: {
    sendTrialEndingEmail: (...args: any[]) => mockSendTrialEndingEmail(...args),
    sendTrialExpiredEmail: (...args: any[]) => mockSendTrialExpiredEmail(...args),
  },
}));

import { processTrialEmails } from './trial.js';

describe('Trial Email Processor', () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends trial ending email on day 5', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb._setSelectResult([{
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      trialStartedAt: fiveDaysAgo,
      emailFlags: JSON.stringify({}),
    }]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        userName: 'Test',
      }),
    );
  });

  it('sends trial expired email on day 7', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    mockDb._setSelectResult([{
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      trialStartedAt: sevenDaysAgo,
      emailFlags: JSON.stringify({}),
    }]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).toHaveBeenCalled();
    expect(mockSendTrialExpiredEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        userName: 'Test',
      }),
    );
  });

  it('does not send trial ending email if already sent', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb._setSelectResult([{
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      trialStartedAt: fiveDaysAgo,
      emailFlags: JSON.stringify({ trialEndingSent: true }),
    }]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
  });

  it('does not send trial expired email if already sent', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    mockDb._setSelectResult([{
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      trialStartedAt: sevenDaysAgo,
      emailFlags: JSON.stringify({ trialEndingSent: true, trialExpiredSent: true }),
    }]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(mockSendTrialExpiredEmail).not.toHaveBeenCalled();
  });

  it('does not send emails before day 5', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    mockDb._setSelectResult([{
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      trialStartedAt: threeDaysAgo,
      emailFlags: JSON.stringify({}),
    }]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(mockSendTrialExpiredEmail).not.toHaveBeenCalled();
  });

  it('handles no free users gracefully', async () => {
    mockDb._setSelectResult([]);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).not.toHaveBeenCalled();
    expect(mockSendTrialExpiredEmail).not.toHaveBeenCalled();
  });

  it('continues processing other users if one fails', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDb._setSelectResult([
      {
        id: 'user_1',
        email: 'fail@example.com',
        name: 'Fail',
        plan: 'free',
        trialStartedAt: fiveDaysAgo,
        emailFlags: JSON.stringify({}),
      },
      {
        id: 'user_2',
        email: 'success@example.com',
        name: 'Success',
        plan: 'free',
        trialStartedAt: fiveDaysAgo,
        emailFlags: JSON.stringify({}),
      },
    ]);

    mockSendTrialEndingEmail
      .mockRejectedValueOnce(new Error('Email failed'))
      .mockResolvedValueOnce(undefined);

    await processTrialEmails(mockEnv);

    expect(mockSendTrialEndingEmail).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Trial] Failed to process trial emails for user user_1:',
      expect.any(Error),
    );
  });
});
