/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UsageChart } from './UsageChart';

const mockData = [
  { day: 'Mon', count: 1000 },
  { day: 'Tue', count: 2000 },
  { day: 'Wed', count: 1500 },
  { day: 'Thu', count: 2500 },
  { day: 'Fri', count: 800 },
  { day: 'Sat', count: 600 },
  { day: 'Sun', count: 1200 },
];

vi.mock('@/lib/use-api', () => ({
  useApi: () => ({ data: mockData, loading: false, error: null, refetch: vi.fn() }),
}));

describe('UsageChart', () => {
  it('renders all day labels', () => {
    render(<UsageChart />);
    expect(screen.getByText('Mon')).toBeDefined();
    expect(screen.getByText('Tue')).toBeDefined();
    expect(screen.getByText('Wed')).toBeDefined();
    expect(screen.getByText('Thu')).toBeDefined();
    expect(screen.getByText('Fri')).toBeDefined();
    expect(screen.getByText('Sat')).toBeDefined();
    expect(screen.getByText('Sun')).toBeDefined();
  });

  it('renders 7 bars', () => {
    const { container } = render(<UsageChart />);
    const labels = container.querySelectorAll('.text-xs.text-neutral-500');
    expect(labels.length).toBe(7);
  });

  it('shows tooltip on hover', () => {
    const { container } = render(<UsageChart />);
    const columns = container.querySelectorAll('.relative.flex.flex-1');
    fireEvent.mouseEnter(columns[0]);
    expect(screen.getByText('1,000')).toBeDefined();
  });

  it('hides tooltip on mouse leave', () => {
    const { container } = render(<UsageChart />);
    const columns = container.querySelectorAll('.relative.flex.flex-1');
    fireEvent.mouseEnter(columns[0]);
    expect(screen.getByText('1,000')).toBeDefined();
    fireEvent.mouseLeave(columns[0]);
    expect(screen.queryByText('1,000')).toBeNull();
  });

  it('renders bars with correct max height for tallest bar', () => {
    const { container } = render(<UsageChart />);
    const bars = container.querySelectorAll('.rounded-t');
    const thuBar = bars[3];
    expect(thuBar.getAttribute('style')).toContain('100%');
  });

  it('highlights bar on hover', () => {
    const { container } = render(<UsageChart />);
    const columns = container.querySelectorAll('.relative.flex.flex-1');
    fireEvent.mouseEnter(columns[1]);
    const hoveredBar = columns[1].querySelector('.rounded-t');
    expect(hoveredBar?.className).toContain('bg-info');
    expect(hoveredBar?.className).not.toContain('bg-info/70');
  });
});
