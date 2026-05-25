/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferralSection } from './ReferralSection';

describe('ReferralSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        referralCode: 'REF-abc123',
        referredCount: 2,
        creditsEarned: 2,
      }),
    } as Response);

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders referral details after loading', async () => {
    render(<ReferralSection />);

    await waitFor(() => {
      expect(screen.getByText('Referral Program')).toBeDefined();
    });

    expect(screen.getAllByText(/REF-abc123/)).toHaveLength(2);
    expect(screen.getByText('users referred').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText('months earned').previousElementSibling?.textContent).toBe('2');
    expect(screen.getByText(/1 more referral to unlock 3 free months/i)).toBeDefined();
    expect(screen.getByText(/Copy invite text/i)).toBeDefined();
  });

  it('copies the referral link', async () => {
    render(<ReferralSection />);

    await waitFor(() => {
      expect(screen.getByLabelText('Copy referral link')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Copy referral link'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://opensyber.cloud/sign-up?ref=REF-abc123',
      );
    });
  });

  it('copies the invite message', async () => {
    render(<ReferralSection />);

    await waitFor(() => {
      expect(screen.getByText(/Copy invite text/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Copy invite text/i));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('https://opensyber.cloud/sign-up?ref=REF-abc123'),
      );
    });
  });
});
