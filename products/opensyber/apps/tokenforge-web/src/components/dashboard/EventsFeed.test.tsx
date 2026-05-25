/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EventsFeed } from './EventsFeed';
import type { SecurityEvent } from './types';

vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <span data-testid="chevron-down" className={className} />
  ),
  ChevronUp: ({ className }: { className?: string }) => (
    <span data-testid="chevron-up" className={className} />
  ),
}));

const mockEvents: SecurityEvent[] = [
  {
    id: 'evt_01',
    type: 'session.verified',
    severity: 'info',
    message: 'Session verified successfully',
    timestamp: '2026-02-27T14:55:00Z',
    ip: '198.51.100.42',
    country: 'US',
    deviceId: 'dk_8f3a2b1c9e4d',
    details: { method: 'ECDSA-P256' },
  },
  {
    id: 'evt_02',
    type: 'trust_score.degraded',
    severity: 'warning',
    message: 'Trust score dropped below threshold',
    timestamp: '2026-02-27T13:20:00Z',
    ip: '203.0.113.17',
    country: 'DE',
    deviceId: 'dk_7e2f1a0b8c3d',
    details: { reason: 'IP change' },
  },
  {
    id: 'evt_03',
    type: 'session.hijack_attempt',
    severity: 'critical',
    message: 'Possible session hijacking detected',
    timestamp: '2026-02-27T11:45:00Z',
    ip: '192.0.2.88',
    country: 'RU',
    deviceId: 'dk_6d1e0f9a7b2c',
    details: { reason: 'Signature mismatch' },
  },
];

describe('EventsFeed', () => {
  it('renders all event cards', () => {
    render(<EventsFeed events={mockEvents} />);
    expect(screen.getByText('Session verified successfully')).toBeDefined();
    expect(screen.getByText('Trust score dropped below threshold')).toBeDefined();
    expect(screen.getByText('Possible session hijacking detected')).toBeDefined();
  });

  it('renders severity badges', () => {
    render(<EventsFeed events={mockEvents} />);
    // Severity names appear in both the filter dropdown and the event badges
    expect(screen.getAllByText('info').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('warning').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('critical').length).toBeGreaterThanOrEqual(1);
  });

  it('renders event type labels', () => {
    render(<EventsFeed events={mockEvents} />);
    // Event types appear both in filter dropdown and event cards.
    // Use getAllByText to confirm at least one is present in the feed.
    expect(screen.getAllByText('session.verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('trust_score.degraded').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('session.hijack_attempt').length).toBeGreaterThanOrEqual(1);
  });

  it('applies correct severity border colors', () => {
    const { container } = render(<EventsFeed events={mockEvents} />);
    const cards = container.querySelectorAll('.border-l-4');
    expect(cards.length).toBe(3);

    const classLists = Array.from(cards).map((c) => c.className);
    expect(classLists[0]).toContain('border-l-info');
    expect(classLists[1]).toContain('border-l-amber-500');
    expect(classLists[2]).toContain('border-l-red-500');
  });

  it('expands event details on click', () => {
    render(<EventsFeed events={mockEvents} />);
    // Click first expand button
    const buttons = screen.getAllByTestId('chevron-down');
    fireEvent.click(buttons[0].closest('button')!);
    // Details should show IP
    expect(screen.getByText('198.51.100.42')).toBeDefined();
    expect(screen.getByText('US')).toBeDefined();
  });

  it('filters by event type', () => {
    render(<EventsFeed events={mockEvents} />);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'session.verified' } });
    expect(screen.getByText('Session verified successfully')).toBeDefined();
    expect(screen.queryByText('Possible session hijacking detected')).toBeNull();
  });

  it('filters by severity', () => {
    render(<EventsFeed events={mockEvents} />);
    const sevSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(sevSelect, { target: { value: 'critical' } });
    expect(screen.getByText('Possible session hijacking detected')).toBeDefined();
    expect(screen.queryByText('Session verified successfully')).toBeNull();
  });

  it('shows event count', () => {
    render(<EventsFeed events={mockEvents} />);
    expect(screen.getByText('3 events')).toBeDefined();
  });

  it('renders empty state when no events match filter', () => {
    render(<EventsFeed events={[]} />);
    expect(screen.getByText('0 events')).toBeDefined();
  });
});
