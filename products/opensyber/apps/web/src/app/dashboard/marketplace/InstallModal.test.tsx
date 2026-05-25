/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { InstallModal } from './InstallModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

const skill = { id: 'skill_1', name: 'SAST Scanner' };
const agents = [
  { id: 'agent_1', name: 'Production Agent', status: 'running' },
  { id: 'agent_2', name: 'Staging Agent', status: 'running' },
];

describe('InstallModal', () => {
  it('renders skill name in header', () => {
    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    expect(screen.getByText('Install SAST Scanner')).toBeDefined();
  });

  it('shows agent list with selection checkboxes', () => {
    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    expect(screen.getByText('Production Agent')).toBeDefined();
    expect(screen.getByText('Staging Agent')).toBeDefined();
  });

  it('shows empty state when no agents', () => {
    render(<InstallModal skill={skill} agents={[]} onClose={vi.fn()} />);
    expect(screen.getByText('No agents deployed yet.')).toBeDefined();
  });

  it('disables install button when no agents selected', () => {
    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    const btn = screen.getByText('Install on 0 agents');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('toggles agent selection and updates button text', () => {
    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Production Agent'));
    expect(screen.getByText('Install on 1 agent')).toBeDefined();

    fireEvent.click(screen.getByText('Staging Agent'));
    expect(screen.getByText('Install on 2 agents')).toBeDefined();

    // Deselect
    fireEvent.click(screen.getByText('Production Agent'));
    expect(screen.getByText('Install on 1 agent')).toBeDefined();
  });

  it('calls fetch for each selected agent on install', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Production Agent'));
    fireEvent.click(screen.getByText('Staging Agent'));
    fireEvent.click(screen.getByText('Install on 2 agents'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/marketplace/install',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ skillId: 'skill_1', instanceId: 'agent_1' }),
        }),
      );
    });
  });

  it('shows success state after install', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    render(<InstallModal skill={skill} agents={agents} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Production Agent'));
    fireEvent.click(screen.getByText('Install on 1 agent'));

    await waitFor(() => {
      expect(screen.getByText('Installed on 1 agent')).toBeDefined();
    });
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<InstallModal skill={skill} agents={agents} onClose={onClose} />);
    // The X button is the first button in the header
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // X close button
    expect(onClose).toHaveBeenCalled();
  });
});
