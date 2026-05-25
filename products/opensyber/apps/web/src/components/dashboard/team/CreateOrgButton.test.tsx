/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u-test' } }, status: 'authenticated' }),
}));

import { CreateOrgButton } from './CreateOrgButton';

const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload, href: '' },
  writable: true,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockReload.mockClear();
  global.fetch = vi.fn();
  localStorage.clear();
});

describe('CreateOrgButton', () => {
  it('renders empty state with create button', () => {
    render(<CreateOrgButton />);
    expect(screen.getByText('No team yet')).toBeDefined();
    expect(screen.getByText('Create Your Team')).toBeDefined();
  });

  it('shows form when create button is clicked', () => {
    render(<CreateOrgButton />);
    fireEvent.click(screen.getByText('Create Your Team'));
    expect(screen.getByText('Create Organization')).toBeDefined();
    expect(screen.getByLabelText('Organization Name')).toBeDefined();
  });

  it('hides form when cancel is clicked', () => {
    render(<CreateOrgButton />);
    fireEvent.click(screen.getByText('Create Your Team'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('No team yet')).toBeDefined();
  });

  it('submits form and stores org ID', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'new-org-id' } }),
    } as unknown as Response);

    render(<CreateOrgButton />);
    fireEvent.click(screen.getByText('Create Your Team'));
    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: 'Test Org' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test Org' }),
        }),
      );
    });
  });

  it('shows error message on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Name taken' }),
    } as unknown as Response);

    render(<CreateOrgButton />);
    fireEvent.click(screen.getByText('Create Your Team'));
    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: 'Dup Org' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Name taken')).toBeDefined();
    });
  });

  it('shows Creating... while loading', async () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));
    render(<CreateOrgButton />);
    fireEvent.click(screen.getByText('Create Your Team'));
    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: 'Org' },
    });
    fireEvent.click(screen.getByText('Create'));
    expect(screen.getByText('Creating...')).toBeDefined();
  });
});
