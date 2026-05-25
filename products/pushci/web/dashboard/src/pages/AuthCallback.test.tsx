import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './AuthCallback';

function setUrl(search: string) {
  const original = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, search, replace: vi.fn() },
  });
  return () => Object.defineProperty(window, 'location', { configurable: true, value: original });
}

let restoreLocation: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  if (restoreLocation) {
    restoreLocation();
    restoreLocation = null;
  }
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<div>landed home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthCallback', () => {
  it('renders an aria-live status while authenticating', () => {
    restoreLocation = setUrl('?code=abc&state=github:nonce');
    renderAt('/auth/callback?code=abc&state=github:nonce');
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/authenticating/i);
  });

  it('navigates home when no code is present', () => {
    restoreLocation = setUrl('');
    renderAt('/auth/callback');
    expect(screen.getByText('landed home')).toBeInTheDocument();
  });

  it('bounces mobile callbacks to deep link without entering the spinner state', () => {
    const search = '?code=abc&state=mobile:deadbeef';
    const replace = vi.fn();
    restoreLocation = (() => {
      const original = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...original, search, replace },
      });
      return () => Object.defineProperty(window, 'location', { configurable: true, value: original });
    })();
    renderAt('/auth/callback' + search);
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^pushci:\/\/auth\/callback\?code=abc&state=mobile%3Adeadbeef$/));
  });

  it('shows a recovery alert after the safety timeout elapses', () => {
    restoreLocation = setUrl('?code=abc&state=github:nonce');
    renderAt('/auth/callback?code=abc&state=github:nonce');
    act(() => { vi.advanceTimersByTime(30_001); });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/still authenticating/i);
    fireEvent.click(screen.getByRole('button', { name: /back to sign-in/i }));
    expect(screen.getByText('landed home')).toBeInTheDocument();
  });
});
