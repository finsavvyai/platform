/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/dashboard/RenameInstanceButton', () => ({
  RenameInstanceButton: () => <button>Rename</button>,
}));

vi.mock('../../packages/shared/src/index.ts', () => ({
  REGION_LABELS: { 'eu-central': 'EU Central' } as Record<string, string>,
}));

vi.mock('@/lib/utils', () => ({
  formatDate: (d: string) => d,
}));

// Dynamic import to ensure mocks are registered before module load
const { InstanceStatusCard } = await import('./InstanceStatusCard');

const baseInstance = {
  id: 'inst-1',
  name: 'My Agent',
  status: 'running',
  region: 'eu-central',
  engineVersion: '1.2.0',
  agentVersion: null,
  lastHealthCheck: '2026-03-01T10:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('InstanceStatusCard', () => {
  it('renders instance name', () => {
    render(<InstanceStatusCard instance={baseInstance} />);
    expect(screen.getByText('My Agent')).toBeDefined();
  });

  it('renders running status', () => {
    render(<InstanceStatusCard instance={baseInstance} />);
    expect(screen.getByText('running')).toBeDefined();
  });

  it('renders region info in DOM', () => {
    const { container } = render(<InstanceStatusCard instance={baseInstance} />);
    // The region label comes from REGION_LABELS or falls back to raw value
    expect(container.textContent).toMatch(/eu-central|Europe|EU Central|Frankfurt/);
  });

  it('renders engine version when present', () => {
    render(<InstanceStatusCard instance={baseInstance} />);
    expect(screen.getByText('SyberEngine 1.2.0')).toBeDefined();
  });

  it('hides engine version when null', () => {
    render(
      <InstanceStatusCard
        instance={{ ...baseInstance, engineVersion: null }}
      />,
    );
    expect(screen.queryByText(/SyberEngine/)).toBeNull();
  });

  it('shows health check date', () => {
    render(<InstanceStatusCard instance={baseInstance} />);
    expect(screen.getByText(/Last health check/)).toBeDefined();
  });

  it('shows no health data when lastHealthCheck is null', () => {
    render(
      <InstanceStatusCard
        instance={{ ...baseInstance, lastHealthCheck: null }}
      />,
    );
    expect(screen.getByText('No health data yet')).toBeDefined();
  });
});
