/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RateSkillButton } from './RateSkillButton';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('RateSkillButton', () => {
  it('renders star rating and submit button', () => {
    render(<RateSkillButton skillId="s-1" />);
    expect(screen.getByText('Rate this skill')).toBeDefined();
    expect(screen.getByText('Submit Rating')).toBeDefined();
  });

  it('submit button is disabled without rating', () => {
    render(<RateSkillButton skillId="s-1" />);
    const button = screen.getByText('Submit Rating').closest('button')!;
    expect(button.disabled).toBe(true);
  });

  it('enables submit after clicking a star', () => {
    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    // Click the 4th star (index 3, excluding Submit button)
    fireEvent.click(stars[3]);
    const submit = screen.getByText('Submit Rating').closest('button')!;
    expect(submit.disabled).toBe(false);
  });

  it('shows rating number after clicking star', () => {
    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[2]); // 3rd star
    expect(screen.getByText('3/5')).toBeDefined();
  });

  it('posts rating to API on submit', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[4]); // 5th star

    fireEvent.click(screen.getByText('Submit Rating'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/marketplace/s-1/rate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ rating: 5 }),
        }),
      );
    });
  });

  it('shows success state after submission', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[3]);
    fireEvent.click(screen.getByText('Submit Rating'));

    await waitFor(() => {
      expect(screen.getByText('Thank you for your review!')).toBeDefined();
    });
  });

  it('shows error on API failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Rating failed' }),
    });

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[0]);
    fireEvent.click(screen.getByText('Submit Rating'));

    await waitFor(() => {
      expect(screen.getByText('Rating failed')).toBeDefined();
    });
  });

  it('shows error on network failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Offline'));

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[0]);
    fireEvent.click(screen.getByText('Submit Rating'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('includes review text when provided', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[4]);

    const textarea = screen.getByPlaceholderText('Write a review (optional)...');
    fireEvent.change(textarea, { target: { value: 'Great skill!' } });
    fireEvent.click(screen.getByText('Submit Rating'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/marketplace/s-1/rate',
        expect.objectContaining({
          body: JSON.stringify({ rating: 5, review: 'Great skill!' }),
        }),
      );
    });
  });

  it('shows Submitting... while loading', async () => {
    let resolvePromise: (value: unknown) => void;
    (global.fetch as any).mockReturnValueOnce(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );

    render(<RateSkillButton skillId="s-1" />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[2]);
    fireEvent.click(screen.getByText('Submit Rating'));

    expect(screen.getByText('Submitting...')).toBeDefined();
    resolvePromise!({ ok: true });

    await waitFor(() => {
      expect(screen.getByText('Thank you for your review!')).toBeDefined();
    });
  });
});
