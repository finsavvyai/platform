/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScorecardShareCard } from './ScorecardShareCard';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('ScorecardShareCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders scorecard sharing actions', () => {
    render(<ScorecardShareCard instanceId="inst_123" instanceName="Prod Agent" />);

    expect(screen.getByText('Public Scorecard')).toBeDefined();
    expect(screen.getByText(/Open public trust page/i)).toBeDefined();
    expect(screen.getByText(/Copy launch caption/i)).toBeDefined();
    expect(screen.getByText(/Copy Link/i)).toBeDefined();
  });

  it('copies the launch caption', async () => {
    render(<ScorecardShareCard instanceId="inst_123" instanceName="Prod Agent" />);

    fireEvent.click(screen.getByText(/Copy launch caption/i));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/trust/inst_123'),
      );
    });
  });
});
