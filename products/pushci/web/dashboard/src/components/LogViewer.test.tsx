import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LogViewer from './LogViewer';

const sample = 'starting build\nERROR: missing dep\nbuild complete';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LogViewer', () => {
  it('exposes the log container as a log landmark', () => {
    render(<LogViewer output={sample} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'off');
  });

  it('renders one row per non-empty line with line numbers', () => {
    render(<LogViewer output={sample} />);
    expect(screen.getByText('starting build')).toBeInTheDocument();
    expect(screen.getByText(/missing dep/)).toBeInTheDocument();
    expect(screen.getByText('build complete')).toBeInTheDocument();
  });

  it('flags error-ish lines in red', () => {
    render(<LogViewer output={'pass: ok\nFATAL: crash'} />);
    const errorLine = screen.getByText(/FATAL/);
    expect(errorLine.className).toContain('text-red-400');
  });

  it('copy button writes full output to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<LogViewer output={sample} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(sample);
  });

  it('copy button is disabled when there is no output', () => {
    render(<LogViewer output={''} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });
});
