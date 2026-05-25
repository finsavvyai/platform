import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EnterpriseDashboardPage from './EnterpriseDashboardPage';
import type { AuditEvent, DoraMetrics, IdentityStatus } from '../hooks/useEnterprise';

function makeLoaders(overrides: {
  getDora?: () => Promise<DoraMetrics>;
  getIdentityStatus?: () => Promise<IdentityStatus>;
  getRecentAudit?: () => Promise<AuditEvent[]>;
}) {
  return {
    getDora: overrides.getDora ?? (async () => emptyDora()),
    getIdentityStatus: overrides.getIdentityStatus ?? (async () => emptyIdentity()),
    getRecentAudit: overrides.getRecentAudit ?? (async () => []),
  };
}

function emptyDora(): DoraMetrics {
  return {
    window_days: 30,
    deploy_count: 0,
    deploy_frequency_per_day: 0,
    lead_time_ms_p50: null,
    mttr_ms_p50: null,
    change_failure_rate: null,
    computed_at: '2026-04-17T00:00:00.000Z',
  };
}

function emptyIdentity(): IdentityStatus {
  return {
    sso: { configured: false, provider: null, tenant: null, updated_at: null },
    scim: { configured: false, tenant: null },
    checked_at: '2026-04-17T00:00:00.000Z',
  };
}

describe('EnterpriseDashboardPage', () => {
  it('renders skeletons while loading', () => {
    const loaders = makeLoaders({
      getDora: () => new Promise<DoraMetrics>(() => {}),
      getIdentityStatus: () => new Promise<IdentityStatus>(() => {}),
      getRecentAudit: () => new Promise<AuditEvent[]>(() => {}),
    });
    render(<EnterpriseDashboardPage loaders={loaders} />);
    expect(screen.getByTestId('dora-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('identity-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('audit-skeleton')).toBeInTheDocument();
  });

  it('shows coming-soon badge for compliance tasks', async () => {
    render(<EnterpriseDashboardPage loaders={makeLoaders({})} />);
    expect(await screen.findByTestId('compliance-coming-soon')).toHaveTextContent(/coming soon/i);
  });

  it('renders real DORA values when API succeeds', async () => {
    const dora: DoraMetrics = {
      window_days: 30,
      deploy_count: 12,
      deploy_frequency_per_day: 2.4,
      lead_time_ms_p50: 125_000,
      mttr_ms_p50: 600_000,
      change_failure_rate: 0.042,
      computed_at: '2026-04-17T00:00:00.000Z',
    };
    render(<EnterpriseDashboardPage loaders={makeLoaders({ getDora: async () => dora })} />);
    expect(await screen.findByText('2.4 / day')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
  });

  it('shows empty audit message when no events', async () => {
    render(<EnterpriseDashboardPage loaders={makeLoaders({})} />);
    expect(await screen.findByText(/no audit events yet/i)).toBeInTheDocument();
  });

  it('shows error message when DORA endpoint fails', async () => {
    const loaders = makeLoaders({
      getDora: async () => {
        throw new Error('boom');
      },
    });
    render(<EnterpriseDashboardPage loaders={loaders} />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load DORA metrics: boom/)).toBeInTheDocument();
    });
  });

  it('renders not-configured rows when SSO/SCIM missing', async () => {
    render(<EnterpriseDashboardPage loaders={makeLoaders({})} />);
    const notConfigured = await screen.findAllByText(/not configured/i);
    expect(notConfigured.length).toBeGreaterThanOrEqual(2);
  });
});
