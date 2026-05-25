import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EntitlementStatsCards } from './EntitlementStatsCards';
import { PermissionGapTable } from './PermissionGapTable';
import { NonHumanInventory } from './NonHumanInventory';
import { PermissionDistribution } from './PermissionDistribution';
import { IdentityTypeBadge, RiskBadge } from './EntitlementBadges';
import { calcGap } from './types';
import type { EntitlementStats, Identity } from './types';

const testStats: EntitlementStats = {
  totalIdentities: 20,
  overPrivileged: 7,
  unusedPermissions: 342,
  nonHumanIdentities: 8,
};

const testIdentities: Identity[] = [
  { id: 'id-01', name: 'Sarah Johnson', email: 'sarah@company.com', type: 'human', granted: 48, used: 12, grantedBreakdown: { admin: 15, write: 18, read: 10, execute: 5 }, usedBreakdown: { admin: 2, write: 4, read: 5, execute: 1 }, riskScore: 92, lastActive: '2026-03-18T10:00:00Z', createdAt: '2025-06-01T00:00:00Z' },
  { id: 'id-02', name: 'James Wilson', email: 'james@company.com', type: 'human', granted: 35, used: 28, grantedBreakdown: { admin: 5, write: 15, read: 10, execute: 5 }, usedBreakdown: { admin: 3, write: 12, read: 8, execute: 5 }, riskScore: 30, lastActive: '2026-03-18T09:30:00Z', createdAt: '2025-08-15T00:00:00Z' },
  { id: 'id-03', name: 'Emily Chen', email: 'emily@company.com', type: 'human', granted: 42, used: 8, grantedBreakdown: { admin: 12, write: 15, read: 10, execute: 5 }, usedBreakdown: { admin: 1, write: 2, read: 4, execute: 1 }, riskScore: 88, lastActive: '2026-03-15T14:00:00Z', createdAt: '2025-04-20T00:00:00Z' },
  { id: 'id-13', name: 'ci-deploy-bot', type: 'service', owner: 'James Wilson', granted: 30, used: 25, grantedBreakdown: { admin: 5, write: 15, read: 8, execute: 2 }, usedBreakdown: { admin: 4, write: 12, read: 7, execute: 2 }, riskScore: 25, lastActive: '2026-03-18T14:30:00Z', createdAt: '2025-06-15T00:00:00Z' },
  { id: 'id-15', name: 'backup-service', type: 'service', owner: 'Ops Team', granted: 28, used: 5, grantedBreakdown: { admin: 8, write: 12, read: 6, execute: 2 }, usedBreakdown: { admin: 0, write: 2, read: 3, execute: 0 }, riskScore: 78, lastActive: '2025-11-01T00:00:00Z', createdAt: '2025-03-01T00:00:00Z' },
];

describe('EntitlementStatsCards', () => {
  it('renders all four stat cards', () => {
    render(<EntitlementStatsCards stats={testStats} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders card labels', () => {
    render(<EntitlementStatsCards stats={testStats} />);
    expect(screen.getByText('Total Identities')).toBeInTheDocument();
    expect(screen.getByText('Over-Privileged')).toBeInTheDocument();
    expect(screen.getByText('Unused Permissions')).toBeInTheDocument();
    expect(screen.getByText('Non-Human Identities')).toBeInTheDocument();
  });
});

describe('calcGap', () => {
  it('calculates gap percentage correctly', () => {
    expect(calcGap(50, 10)).toBe(80);
    expect(calcGap(100, 100)).toBe(0);
    expect(calcGap(0, 0)).toBe(0);
    expect(calcGap(20, 5)).toBe(75);
  });
});

describe('PermissionGapTable', () => {
  it('renders identities sorted by gap percentage', () => {
    render(<PermissionGapTable identities={testIdentities.slice(0, 5)} />);
    expect(screen.getByText('Permission Gap Analysis')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
  });

  it('shows right-size button for each identity', () => {
    render(<PermissionGapTable identities={testIdentities.slice(0, 3)} />);
    const buttons = screen.getAllByText('Right-size');
    expect(buttons.length).toBe(3);
  });
});

describe('IdentityTypeBadge', () => {
  it('renders correct label for each type', () => {
    const { rerender } = render(<IdentityTypeBadge type="human" />);
    expect(screen.getByText('Human')).toBeInTheDocument();

    rerender(<IdentityTypeBadge type="service" />);
    expect(screen.getByText('Service Account')).toBeInTheDocument();

    rerender(<IdentityTypeBadge type="bot" />);
    expect(screen.getByText('Bot')).toBeInTheDocument();

    rerender(<IdentityTypeBadge type="automation" />);
    expect(screen.getByText('Automation')).toBeInTheDocument();
  });
});

describe('RiskBadge', () => {
  it('renders the score', () => {
    render(<RiskBadge score={85} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});

describe('NonHumanInventory', () => {
  it('renders non-human identities', () => {
    const nonHuman = testIdentities.filter((i) => i.type !== 'human');
    render(<NonHumanInventory identities={nonHuman} />);
    expect(screen.getByText('Non-Human Identity Inventory')).toBeInTheDocument();
    expect(screen.getByText('ci-deploy-bot')).toBeInTheDocument();
  });

  it('shows empty state when no non-human identities', () => {
    const humans = testIdentities.filter((i) => i.type === 'human');
    render(<NonHumanInventory identities={humans} />);
    expect(screen.getByText('No non-human identities found')).toBeInTheDocument();
  });

  it('highlights stale identities', () => {
    const nonHuman = testIdentities.filter((i) => i.type !== 'human');
    render(<NonHumanInventory identities={nonHuman} />);
    const staleLabels = screen.getAllByText(/Stale/);
    expect(staleLabels.length).toBeGreaterThan(0);
  });
});

describe('PermissionDistribution', () => {
  it('renders permission distribution chart', () => {
    render(<PermissionDistribution identities={testIdentities} />);
    expect(screen.getByText('Permission Distribution')).toBeInTheDocument();
    expect(screen.getByText('Human')).toBeInTheDocument();
  });
});
