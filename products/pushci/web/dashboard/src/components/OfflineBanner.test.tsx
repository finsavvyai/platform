import { describe, expect, it, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnline(true);
  });

  it('renders nothing when online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an aria-live region with offline message when offline', () => {
    render(<OfflineBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/offline/i);
    expect(status).toHaveTextContent(/won't sync/i);
  });
});
