import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LiveLogViewer from './LiveLogViewer';
import type { LogLine } from '../hooks/useLogs';

const baseTime = new Date('2026-05-23T09:00:00Z').toISOString();

function line(id: string, text: string, level: LogLine['level'] = 'info'): LogLine {
  return { id, text, time: baseTime, level };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LiveLogViewer', () => {
  it('renders an empty state when there are no logs', () => {
    render(<LiveLogViewer logs={[]} connected={false} />);
    expect(screen.getByText(/waiting for output/i)).toBeInTheDocument();
  });

  it('shows a polite live status that reflects the connected flag', () => {
    const { rerender } = render(<LiveLogViewer logs={[]} connected={true} />);
    expect(screen.getByRole('status')).toHaveTextContent('Live');
    rerender(<LiveLogViewer logs={[]} connected={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Disconnected');
  });

  it('marks the log container with role=log and live=off (chrome announces follow state, not lines)', () => {
    render(<LiveLogViewer logs={[line('1:hello', 'hello')]} connected={true} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'off');
  });

  it('Copy button is disabled when there are no logs and enabled otherwise', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { rerender } = render(<LiveLogViewer logs={[]} connected={true} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
    rerender(<LiveLogViewer logs={[line('a', 'one'), line('b', 'two')]} connected={true} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('one\ntwo');
  });

  it('uses stable ids as keys (no React warnings on update with same content)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = [line('1:foo', 'foo'), line('2:bar', 'bar')];
    const b = [line('1:foo', 'foo'), line('2:bar', 'bar'), line('3:baz', 'baz')];
    const { rerender } = render(<LiveLogViewer logs={a} connected={true} />);
    rerender(<LiveLogViewer logs={b} connected={true} />);
    const keyWarnings = spy.mock.calls.filter((c) => /unique "key"/.test(String(c[0])));
    expect(keyWarnings).toHaveLength(0);
    spy.mockRestore();
  });
});
