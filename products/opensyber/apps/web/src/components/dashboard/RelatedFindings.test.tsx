/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RelatedFindings } from './RelatedFindings';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const mockFindings = [
  {
    id: 'f1',
    severity: 'critical',
    resourceId: 'arn:aws:s3:::bucket',
    resourceType: 's3_bucket',
    title: 'Public bucket',
  },
  {
    id: 'f2',
    severity: 'medium',
    resourceId: 'sg-12345',
    resourceType: 'security_group',
    title: 'Open port 22',
  },
];

describe('RelatedFindings', () => {
  it('renders collapsed button initially', () => {
    render(<RelatedFindings activityId="act_1" />);
    expect(screen.getByText('Related Findings')).toBeDefined();
  });

  it('shows initial count badge when provided', () => {
    render(<RelatedFindings activityId="act_1" initialCount={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('does not show count badge when initialCount is 0', () => {
    render(<RelatedFindings activityId="act_1" initialCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('expands and loads findings on click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockFindings }),
    } as unknown as Response);

    render(<RelatedFindings activityId="act_1" />);
    fireEvent.click(screen.getByText('Related Findings'));

    await waitFor(() => {
      expect(screen.getByText('Public bucket')).toBeDefined();
      expect(screen.getByText('Open port 22')).toBeDefined();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/activity/act_1/related-findings',
    );
  });

  it('shows empty state when no findings', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);

    render(<RelatedFindings activityId="act_1" />);
    fireEvent.click(screen.getByText('Related Findings'));

    await waitFor(() => {
      expect(screen.getByText('No related findings found')).toBeDefined();
    });
  });

  it('shows error message on fetch failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
    } as Response);

    render(<RelatedFindings activityId="act_1" />);
    fireEvent.click(screen.getByText('Related Findings'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load findings')).toBeDefined();
    });
  });

  it('shows loading state while fetching', async () => {
    let resolve: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((r) => { resolve = r as (v: unknown) => void; }),
    );

    render(<RelatedFindings activityId="act_1" />);
    fireEvent.click(screen.getByText('Related Findings'));

    expect(screen.getByText('Loading findings...')).toBeDefined();
    resolve!({ ok: true, json: () => Promise.resolve({ data: [] }) });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
