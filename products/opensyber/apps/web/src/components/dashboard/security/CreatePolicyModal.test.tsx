/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatePolicyModal } from './CreatePolicyModal';

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

describe('CreatePolicyModal', () => {
  it('renders new policy button', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    expect(screen.getByText('New Policy')).toBeDefined();
  });

  it('opens modal on button click', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    expect(screen.getByText('Create Security Policy')).toBeDefined();
  });

  it('shows validation error when name is empty', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.click(screen.getByText('Create Policy'));
    expect(screen.getByText('Name is required')).toBeDefined();
  });

  it('shows validation error when rules are empty', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Block malicious domains'), {
      target: { value: 'Test Policy' },
    });
    fireEvent.click(screen.getByText('Create Policy'));
    expect(screen.getByText('Rules are required')).toBeDefined();
  });

  it('shows validation error for invalid JSON', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Block malicious domains'), {
      target: { value: 'Test Policy' },
    });
    fireEvent.change(screen.getByPlaceholderText('["*.example.com", "api.openai.com"]'), {
      target: { value: 'not valid json' },
    });
    fireEvent.click(screen.getByText('Create Policy'));
    expect(screen.getByText('Rules must be valid JSON')).toBeDefined();
  });

  it('submits form with correct data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Block malicious domains'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('["*.example.com", "api.openai.com"]'), {
      target: { value: '["*.evil.com"]' },
    });
    fireEvent.click(screen.getByText('Create Policy'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/security/instances/i1/policies',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            policyType: 'network_allowlist',
            name: 'Test',
            rules: '["*.evil.com"]',
            isActive: true,
          }),
        }),
      );
    });
  });

  it('reloads on successful creation', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Block malicious domains'), {
      target: { value: 'Policy' },
    });
    fireEvent.change(screen.getByPlaceholderText('["*.example.com", "api.openai.com"]'), {
      target: { value: '[]' },
    });
    fireEvent.click(screen.getByText('Create Policy'));

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows API error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as unknown as Response);
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Block malicious domains'), {
      target: { value: 'P' },
    });
    fireEvent.change(screen.getByPlaceholderText('["*.example.com", "api.openai.com"]'), {
      target: { value: '[]' },
    });
    fireEvent.click(screen.getByText('Create Policy'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined();
    });
  });

  it('closes modal on cancel', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create Security Policy')).toBeNull();
  });

  it('renders all policy type options', () => {
    render(<CreatePolicyModal instanceId="i1" />);
    fireEvent.click(screen.getByText('New Policy'));
    expect(screen.getByText('Network Allowlist')).toBeDefined();
    expect(screen.getByText('Network Blocklist')).toBeDefined();
    expect(screen.getByText('File Path Rules')).toBeDefined();
    expect(screen.getByText('Shell Command Rules')).toBeDefined();
    expect(screen.getByText('IP Allowlist')).toBeDefined();
    expect(screen.getByText('Rate Limit')).toBeDefined();
  });
});
