import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useOnline } from './useOnline';

function Probe() {
  const online = useOnline();
  return <span data-testid="status">{online ? 'on' : 'off'}</span>;
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useOnline', () => {
  beforeEach(() => {
    setOnline(true);
  });

  it('returns navigator.onLine initially', () => {
    render(<Probe />);
    expect(screen.getByTestId('status').textContent).toBe('on');
  });

  it('reflects offline event', () => {
    render(<Probe />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('status').textContent).toBe('off');
  });

  it('reflects online event after going offline', () => {
    render(<Probe />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('status').textContent).toBe('on');
  });
});
