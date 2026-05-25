/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SsoConfigForm } from './SsoConfigForm';

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

describe('SsoConfigForm', () => {
  it('renders provider toggle buttons', () => {
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    expect(screen.getByText('SAML 2.0')).toBeDefined();
    expect(screen.getByText('OpenID Connect')).toBeDefined();
  });

  it('shows SAML fields by default', () => {
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    expect(screen.getByText('Entity ID (IdP)')).toBeDefined();
    expect(screen.getByText('SSO URL')).toBeDefined();
    expect(screen.getByText('X.509 Certificate')).toBeDefined();
  });

  it('shows OIDC fields when OIDC is selected', () => {
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    fireEvent.click(screen.getByText('OpenID Connect'));
    expect(screen.getByText('Client ID')).toBeDefined();
    expect(screen.getByText('Client Secret')).toBeDefined();
    expect(screen.getByText('Issuer URL')).toBeDefined();
  });

  it('renders common settings', () => {
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    expect(screen.getByText('Auto-provision new users')).toBeDefined();
    expect(screen.getByText('Default Role')).toBeDefined();
    expect(screen.getByText('Enable SSO')).toBeDefined();
  });

  it('renders save and test buttons', () => {
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    expect(screen.getByText('Save Configuration')).toBeDefined();
    expect(screen.getByText('Test Connection')).toBeDefined();
  });

  it('calls PUT on save', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/sso',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('calls test endpoint on test click', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    fireEvent.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/proxy/organizations/org1/sso/test',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows error on save failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network down'));
    render(<SsoConfigForm orgId="org1" existingConfig={null} />);
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeDefined();
    });
  });

  it('pre-fills existing config values', () => {
    render(
      <SsoConfigForm
        orgId="org1"
        existingConfig={{
          id: 'sso-1',
          orgId: 'org1',
          provider: 'oidc',
          entityId: '',
          ssoUrl: '',
          certificate: '',
          oidcClientId: 'client-123',
          oidcClientSecretEncrypted: null,
          oidcIssuer: 'https://auth.example.com',
          autoProvision: true,
          defaultRole: 'developer',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }}
      />,
    );
    expect(screen.getByText('Client ID')).toBeDefined();
  });
});
