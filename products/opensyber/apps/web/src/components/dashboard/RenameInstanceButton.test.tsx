/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RenameInstanceButton } from './RenameInstanceButton';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
  global.alert = vi.fn();
});

describe('RenameInstanceButton', () => {
  it('renders pencil button initially', () => {
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    const button = screen.getByTitle('Rename instance');
    expect(button).toBeDefined();
  });

  it('shows edit form when pencil is clicked', () => {
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const input = screen.getByDisplayValue('Agent 1') as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it('cancels edit on cancel button click', () => {
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const buttons = screen.getAllByRole('button');
    const cancelBtn = buttons[buttons.length - 1];
    fireEvent.click(cancelBtn);
    expect(screen.getByTitle('Rename instance')).toBeDefined();
  });

  it('cancels edit on Escape key', () => {
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const input = screen.getByDisplayValue('Agent 1');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTitle('Rename instance')).toBeDefined();
  });

  it('does not call fetch when name is unchanged', () => {
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const buttons = screen.getAllByRole('button');
    const saveBtn = buttons[0];
    fireEvent.click(saveBtn);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls PATCH with new name', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const input = screen.getByDisplayValue('Agent 1');
    fireEvent.change(input, { target: { value: 'Agent 2' } });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/i1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Agent 2' }),
        }),
      );
    });
  });

  it('saves on Enter key', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    const input = screen.getByDisplayValue('Agent 1');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/instances/i1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Name' }),
        }),
      );
    });
  });

  it('reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    fireEvent.change(screen.getByDisplayValue('Agent 1'), { target: { value: 'X' } });
    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows alert on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Rename failed' }),
    } as unknown as Response);
    render(<RenameInstanceButton instanceId="i1" currentName="Agent 1" />);
    fireEvent.click(screen.getByTitle('Rename instance'));
    fireEvent.change(screen.getByDisplayValue('Agent 1'), { target: { value: 'X' } });
    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Rename failed');
    });
  });
});
