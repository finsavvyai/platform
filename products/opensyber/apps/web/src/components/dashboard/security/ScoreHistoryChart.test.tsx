/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreHistoryChart } from './ScoreHistoryChart';

describe('ScoreHistoryChart', () => {
  it('shows empty state when data has fewer than 2 points', () => {
    render(<ScoreHistoryChart data={[]} />);
    expect(screen.getByText('Score History')).toBeDefined();
    expect(
      screen.getByText('Score history will appear here after a few days of monitoring.'),
    ).toBeDefined();
  });

  it('shows empty state with single data point', () => {
    render(<ScoreHistoryChart data={[{ date: '2024-01-01', score: 85 }]} />);
    expect(
      screen.getByText('Score history will appear here after a few days of monitoring.'),
    ).toBeDefined();
  });

  it('renders chart when data has 2+ points', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(container.querySelector('polyline')).toBeDefined();
  });

  it('renders range toggle buttons', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
    ];
    render(<ScoreHistoryChart data={data} />);
    expect(screen.getByText('7d')).toBeDefined();
    expect(screen.getByText('30d')).toBeDefined();
    expect(screen.getByText('90d')).toBeDefined();
  });

  it('highlights active range button', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
    ];
    render(<ScoreHistoryChart data={data} />);
    const btn7d = screen.getByText('7d');
    expect(btn7d.className).toContain('bg-neutral-700');
  });

  it('switches active range on click', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
    ];
    render(<ScoreHistoryChart data={data} />);
    fireEvent.click(screen.getByText('30d'));
    expect(screen.getByText('30d').className).toContain('bg-neutral-700');
    expect(screen.getByText('7d').className).not.toContain('bg-neutral-700');
  });

  it('renders data points as circles', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
      { date: '2024-01-03', score: 90 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('renders grid lines', () => {
    const data = [
      { date: '2024-01-01', score: 70 },
      { date: '2024-01-02', score: 85 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    const gridLines = container.querySelectorAll('line');
    expect(gridLines.length).toBe(5);
  });

  it('uses green color for high scores', () => {
    const data = [
      { date: '2024-01-01', score: 85 },
      { date: '2024-01-02', score: 90 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#22c55e');
  });

  it('uses yellow color for medium scores', () => {
    const data = [
      { date: '2024-01-01', score: 55 },
      { date: '2024-01-02', score: 60 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#eab308');
  });

  it('uses red color for low scores', () => {
    const data = [
      { date: '2024-01-01', score: 30 },
      { date: '2024-01-02', score: 25 },
    ];
    const { container } = render(<ScoreHistoryChart data={data} />);
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#ef4444');
  });
});
