/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillModerationCard } from './SkillModerationCard';

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const skill = {
  id: 's1',
  name: 'Network Scanner',
  description: 'Scans network ports',
  createdAt: '2026-03-01',
};

describe('SkillModerationCard', () => {
  it('renders skill name and description', () => {
    render(<SkillModerationCard skill={skill} />);
    expect(screen.getByText('Network Scanner')).toBeDefined();
    expect(screen.getByText('Scans network ports')).toBeDefined();
  });

  it('shows No description when description is null', () => {
    render(<SkillModerationCard skill={{ ...skill, description: null }} />);
    expect(screen.getByText('No description')).toBeDefined();
  });

  it('renders approve and reject buttons', () => {
    render(<SkillModerationCard skill={skill} />);
    expect(screen.getByText('Approve')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
  });

  it('calls PATCH with approve action', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SkillModerationCard skill={skill} />);
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/admin/skills/s1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve' }),
        }),
      );
    });
  });

  it('calls PATCH with reject action', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SkillModerationCard skill={skill} />);
    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/admin/skills/s1',
        expect.objectContaining({
          body: JSON.stringify({ action: 'reject' }),
        }),
      );
    });
  });

  it('shows completion message after action', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SkillModerationCard skill={skill} />);
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(screen.getByText(/Action completed/)).toBeDefined();
    });
  });

  it('shows submitted date', () => {
    render(<SkillModerationCard skill={skill} />);
    expect(screen.getByText(/Submitted/)).toBeDefined();
  });
});
