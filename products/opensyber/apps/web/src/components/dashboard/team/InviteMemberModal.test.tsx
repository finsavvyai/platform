/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteMemberModal } from './InviteMemberModal';

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

describe('InviteMemberModal', () => {
  const defaultProps = {
    orgId: 'org1',
    isOpen: true,
    onClose: vi.fn(),
    currentUserRole: 'admin' as const,
  };

  it('renders nothing when not open', () => {
    const { container } = render(
      <InviteMemberModal {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with email and role fields', () => {
    render(<InviteMemberModal {...defaultProps} />);
    expect(screen.getByText('Invite Team Member')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Role')).toBeDefined();
  });

  it('renders email input with type email for validation', () => {
    render(<InviteMemberModal {...defaultProps} />);
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.required).toBe(true);
  });

  it('submits invite with correct data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<InviteMemberModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByText('Send Invite'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/invitations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com', role: 'developer' }),
        }),
      );
    });
  });

  it('calls onClose and reloads on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    const onClose = vi.fn();
    render(<InviteMemberModal {...defaultProps} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByText('Send Invite'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('shows error on API failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Already invited' }),
    } as unknown as Response);

    render(<InviteMemberModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByText('Send Invite'));

    await waitFor(() => {
      expect(screen.getByText('Already invited')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<InviteMemberModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('filters roles based on current user role hierarchy', () => {
    render(
      <InviteMemberModal {...defaultProps} currentUserRole="developer" />,
    );
    const select = screen.getByLabelText('Role') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('developer');
    expect(options).toContain('viewer');
    expect(options).not.toContain('admin');
  });
});
