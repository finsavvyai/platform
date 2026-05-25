/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BadgeEmbed } from './BadgeEmbed';

vi.mock('@/lib/api-config', () => ({
  API_BASE_URL: 'https://api.test.com',
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BadgeEmbed', () => {
  it('renders Security Badge heading', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    expect(screen.getByText('Security Badge')).toBeDefined();
  });

  it('renders description text', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    expect(
      screen.getByText(/Embed your security score/),
    ).toBeDefined();
  });

  it('renders Markdown and HTML section labels', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    expect(screen.getByText('Markdown')).toBeDefined();
    expect(screen.getByText('HTML')).toBeDefined();
  });

  it('renders preview image via same-origin proxy (not cross-origin)', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    const img = screen.getByAltText('Security Score Badge');
    const src = img.getAttribute('src') ?? '';
    // Preview must use the same-origin proxy so CSP always allows it,
    // regardless of API_BASE_URL or regional deployments.
    expect(src).toBe('/api/proxy/badges/inst-1/security-score');
    expect(src.startsWith('https://')).toBe(false);
  });

  it('snippets still use absolute production URL for README embedding', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    // Markdown snippet is rendered as <code> text — it must contain the
    // absolute URL so the badge resolves when pasted into a GitHub README.
    const codes = document.querySelectorAll('code');
    const markdownCode = Array.from(codes).find((el) =>
      el.textContent?.includes('![Security Score]'),
    );
    expect(markdownCode?.textContent).toContain(
      'https://api.test.com/api/badges/inst-1/security-score',
    );
  });

  it('renders two copy buttons', () => {
    render(<BadgeEmbed instanceId="inst-1" />);
    const copyButtons = screen.getAllByText('Copy');
    expect(copyButtons.length).toBe(2);
  });

  it('copies markdown snippet to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<BadgeEmbed instanceId="inst-1" />);
    const copyButtons = screen.getAllByText('Copy');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('![Security Score]'),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeDefined();
    });
  });
});
