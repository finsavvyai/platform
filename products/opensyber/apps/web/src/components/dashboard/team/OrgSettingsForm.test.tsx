/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrgSettingsForm } from './OrgSettingsForm';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('OrgSettingsForm', () => {
  it('renders name and slug fields', () => {
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={true} />,
    );
    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByLabelText('Slug')).toBeDefined();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Acme');
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('acme');
  });

  it('shows save button when canEdit is true', () => {
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={true} />,
    );
    expect(screen.getByText('Save Changes')).toBeDefined();
  });

  it('hides save button when canEdit is false', () => {
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={false} />,
    );
    expect(screen.queryByText('Save Changes')).toBeNull();
  });

  it('disables inputs when canEdit is false', () => {
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={false} />,
    );
    expect(screen.getByLabelText('Name')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Slug')).toHaveProperty('disabled', true);
  });

  it('calls PATCH on save', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={true} />,
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Name' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows success message after save', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={true} />,
    );
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Settings saved.')).toBeDefined();
    });
  });

  it('shows error message on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Slug taken' }),
    } as unknown as Response);
    render(
      <OrgSettingsForm orgId="org1" name="Acme" slug="acme" canEdit={true} />,
    );
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Slug taken')).toBeDefined();
    });
  });
});
