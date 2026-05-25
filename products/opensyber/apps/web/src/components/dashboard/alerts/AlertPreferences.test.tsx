/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertPreferences } from './AlertPreferences';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/settings/alerts',
}));

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
});

describe('AlertPreferences', () => {
  it('renders all toggle switches', () => {
    render(<AlertPreferences />);
    expect(screen.getByText('Email Alerts')).toBeDefined();
    expect(screen.getByText('SMS Alerts')).toBeDefined();
    expect(screen.getByText('Push Notifications')).toBeDefined();
  });

  it('shows phone input when SMS is enabled', () => {
    render(<AlertPreferences />);
    const smsToggle = screen.getByText('SMS Alerts').closest('label')!.querySelector('button')!;
    fireEvent.click(smsToggle);
    expect(screen.getByPlaceholderText('+1 555 000 0000')).toBeDefined();
  });

  it('shows validation error on invalid phone number', async () => {
    render(<AlertPreferences />);
    const smsToggle = screen.getByText('SMS Alerts').closest('label')!.querySelector('button')!;
    fireEvent.click(smsToggle);
    const phoneInput = screen.getByPlaceholderText('+1 555 000 0000');
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Enter a valid phone number (e.g. +1 555 000 0000)')).toBeDefined();
    });
  });

  it('renders severity dropdown with options', () => {
    render(<AlertPreferences />);
    expect(screen.getByText('Minimum Severity')).toBeDefined();
    expect(screen.getByDisplayValue('Critical + High')).toBeDefined();
  });

  it('calls save endpoint and shows toast', async () => {
    render(<AlertPreferences />);
    fireEvent.click(screen.getByText('Save Preferences'));
    await waitFor(() => {
      expect(screen.getByText('Preferences saved')).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith('/api/proxy/user/alert-preferences', expect.any(Object));
    });
  });
});
