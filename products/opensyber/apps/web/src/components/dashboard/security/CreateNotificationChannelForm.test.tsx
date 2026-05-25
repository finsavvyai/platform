/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateNotificationChannelForm } from './CreateNotificationChannelForm';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
});

describe('CreateNotificationChannelForm', () => {
  it('renders form with email type selected by default', () => {
    render(<CreateNotificationChannelForm />);
    expect(screen.getByText('Add Notification Channel')).toBeDefined();
    expect(screen.getByText('Email Address')).toBeDefined();
  });

  it('shows email field when email type is selected', () => {
    render(<CreateNotificationChannelForm />);
    expect(screen.getByPlaceholderText('alerts@company.com')).toBeDefined();
  });

  it('shows webhook fields when webhook type is selected', () => {
    render(<CreateNotificationChannelForm />);
    const typeSelect = screen.getByDisplayValue('Email');
    fireEvent.change(typeSelect, { target: { value: 'webhook' } });
    expect(screen.getByPlaceholderText('https://example.com/webhook')).toBeDefined();
    expect(screen.getByPlaceholderText('Signing secret')).toBeDefined();
  });

  it('shows slack field when slack type is selected', () => {
    render(<CreateNotificationChannelForm />);
    const typeSelect = screen.getByDisplayValue('Email');
    fireEvent.change(typeSelect, { target: { value: 'slack' } });
    expect(screen.getByPlaceholderText('https://hooks.slack.com/services/...')).toBeDefined();
  });

  it('shows validation error when name is empty', () => {
    render(<CreateNotificationChannelForm />);
    fireEvent.click(screen.getByText('Add Channel'));
    expect(screen.getByText('Name is required')).toBeDefined();
  });

  it('shows validation error when email is empty', () => {
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'My Channel' },
    });
    fireEvent.click(screen.getByText('Add Channel'));
    expect(screen.getByText('Email is required.')).toBeDefined();
  });

  it('shows validation error for invalid email format', () => {
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'My Channel' },
    });
    fireEvent.change(screen.getByPlaceholderText('alerts@company.com'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByText('Add Channel'));
    expect(screen.getByText('Please enter a valid email address.')).toBeDefined();
  });

  it('shows validation error when webhook URL is empty', () => {
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByDisplayValue('Email'), { target: { value: 'webhook' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'WH Channel' },
    });
    fireEvent.click(screen.getByText('Add Channel'));
    expect(screen.getByText('Webhook URL is required')).toBeDefined();
  });

  it('shows validation error when slack URL is empty', () => {
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByDisplayValue('Email'), { target: { value: 'slack' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'Slack' },
    });
    fireEvent.click(screen.getByText('Add Channel'));
    expect(screen.getByText('Slack webhook URL is required')).toBeDefined();
  });

  it('submits email channel correctly', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'Email Channel' },
    });
    fireEvent.change(screen.getByPlaceholderText('alerts@company.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.click(screen.getByText('Add Channel'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/user/notification-channels',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            channelType: 'email',
            name: 'Email Channel',
            config: JSON.stringify({ email: 'test@test.com' }),
          }),
        }),
      );
    });
  });

  it('reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'Ch' },
    });
    fireEvent.change(screen.getByPlaceholderText('alerts@company.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByText('Add Channel'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows API error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Duplicate channel' }),
    } as unknown as Response);
    render(<CreateNotificationChannelForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Team alerts'), {
      target: { value: 'Ch' },
    });
    fireEvent.change(screen.getByPlaceholderText('alerts@company.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByText('Add Channel'));

    await waitFor(() => {
      expect(screen.getByText('Duplicate channel')).toBeDefined();
    });
  });
});
