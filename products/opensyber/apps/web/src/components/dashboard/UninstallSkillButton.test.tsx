/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UninstallSkillButton } from './UninstallSkillButton';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  mockRefresh.mockClear();
  global.fetch = vi.fn();
  global.alert = vi.fn();
  global.confirm = vi.fn();
});

describe('UninstallSkillButton', () => {
  const defaultProps = {
    instanceId: 'inst_1',
    skillId: 'skill_abc',
    skillName: 'GitHub Integration',
  };

  it('renders uninstall button', () => {
    render(<UninstallSkillButton {...defaultProps} />);
    expect(screen.getByText('Uninstall')).toBeDefined();
  });

  it('shows confirmation dialog on click', () => {
    (global.confirm as any).mockReturnValueOnce(false);

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    expect(global.confirm).toHaveBeenCalledWith(
      'Uninstall "GitHub Integration" from your instance?',
    );
  });

  it('does nothing when confirm is cancelled', () => {
    (global.confirm as any).mockReturnValueOnce(false);

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls DELETE API when confirmed', async () => {
    (global.confirm as any).mockReturnValueOnce(true);
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/inst_1/skills/skill_abc',
        { method: 'DELETE' },
      );
    });
  });

  it('reloads page on successful uninstall', async () => {
    (global.confirm as any).mockReturnValueOnce(true);
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows "Removing..." while loading', async () => {
    (global.confirm as any).mockReturnValueOnce(true);
    let resolvePromise: (value: unknown) => void;
    (global.fetch as any).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    expect(screen.getByText('Removing...')).toBeDefined();

    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows alert on API error', async () => {
    (global.confirm as any).mockReturnValueOnce(true);
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Permission denied' }),
    });

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Permission denied');
    });
  });

  it('shows alert on network error', async () => {
    (global.confirm as any).mockReturnValueOnce(true);
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<UninstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Uninstall'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error');
    });
  });
});
