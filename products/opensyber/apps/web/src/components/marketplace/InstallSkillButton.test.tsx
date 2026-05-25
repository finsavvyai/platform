/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InstallSkillButton } from './InstallSkillButton';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/marketplace',
}));

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  global.alert = vi.fn();
});

describe('InstallSkillButton', () => {
  const defaultProps = {
    instanceId: 'inst_1',
    skillId: 'skill_abc',
    skillVersion: '1.0.0',
  };

  it('renders install button', () => {
    render(<InstallSkillButton {...defaultProps} />);
    expect(screen.getByText('Install')).toBeDefined();
  });

  it('calls POST /api/proxy/instances/:id/skills on click', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/inst_1/skills',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ skillId: 'skill_abc', version: '1.0.0' }),
        }),
      );
    });
  });

  it('shows "Installing..." while loading', async () => {
    let resolvePromise: (value: unknown) => void;
    (global.fetch as any).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    expect(screen.getByText('Installing...')).toBeDefined();

    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(screen.getByText('Installed')).toBeDefined();
    });
  });

  it('shows "Installed" with check icon on success', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(screen.getByText('Installed')).toBeDefined();
    });
  });

  it('shows retry button on API error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Skill not found' }),
    });

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  it('shows retry button on network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network failed'));

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  it('shows retry button when error response has no message', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error('parse error')),
    });

    render(<InstallSkillButton {...defaultProps} />);
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeDefined();
    });
  });

  it('button is disabled while loading', async () => {
    let resolvePromise: (value: unknown) => void;
    (global.fetch as any).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(<InstallSkillButton {...defaultProps} />);
    const button = screen.getByText('Install').closest('button')!;
    fireEvent.click(button);

    expect(button.disabled).toBe(true);

    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(screen.getByText('Installed')).toBeDefined();
    });
  });
});
