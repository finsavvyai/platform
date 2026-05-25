import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useLogs } from './useLogs';
import { api } from './useApi';

function Probe({ runId }: { runId: string | null }) {
  const { logs, connected } = useLogs(runId);
  return (
    <div>
      <span data-testid="connected">{String(connected)}</span>
      <span data-testid="count">{logs.length}</span>
      <ul>
        {logs.map((l) => (
          <li key={l.id} data-level={l.level}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLogs', () => {
  it('returns empty + disconnected when runId is null', async () => {
    render(<Probe runId={null} />);
    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('classifies log lines into info / error / success', async () => {
    const spy = vi.spyOn(api, 'getRunLogs').mockResolvedValue(
      'starting build\nERROR: dep missing\n✓ tests passed',
    );
    render(<Probe runId="r1" />);
    await act(async () => { await Promise.resolve(); });
    expect(spy).toHaveBeenCalled();
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(screen.getByText(/dep missing/)).toHaveAttribute('data-level', 'error');
    expect(screen.getByText(/tests passed/)).toHaveAttribute('data-level', 'success');
  });

  it('uses exponential backoff on consecutive errors', async () => {
    const spy = vi.spyOn(api, 'getRunLogs').mockRejectedValue(new Error('boom'));
    render(<Probe runId="r1" />);
    // initial call
    await act(async () => { await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('connected').textContent).toBe('false');

    // 2s, 4s, 8s — three retries scheduled with exponential backoff
    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(4_000); await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(3);
    await act(async () => { vi.advanceTimersByTime(8_000); await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('resets the connected flag and clears backoff on a successful poll', async () => {
    const spy = vi.spyOn(api, 'getRunLogs')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok line');
    render(<Probe runId="r1" />);
    await act(async () => { await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('connected').textContent).toBe('false');

    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('connected').textContent).toBe('true');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
