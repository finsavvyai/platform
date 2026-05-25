import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreRing } from '../components/ScoreRing';

describe('ScoreRing', () => {
  it('renders the score value', () => {
    render(<ScoreRing score={87} />);
    expect(screen.getByText('87')).toBeInTheDocument();
  });

  it('renders the label when provided', () => {
    render(<ScoreRing score={50} label="ChatGPT" />);
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = render(<ScoreRing score={50} />);
    const labels = container.querySelectorAll('.text-xs');
    expect(labels).toHaveLength(0);
  });

  it('renders SVG with correct structure', () => {
    const { container } = render(<ScoreRing score={80} size={120} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '120');
  });

  it('renders two circle elements', () => {
    const { container } = render(<ScoreRing score={60} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('uses green color for high scores', () => {
    const { container } = render(<ScoreRing score={85} />);
    const bg = container.querySelector('circle');
    expect(bg).toHaveAttribute('fill', 'rgba(16, 185, 129, 0.08)');
  });

  it('uses yellow color for medium scores', () => {
    const { container } = render(<ScoreRing score={65} />);
    const bg = container.querySelector('circle');
    expect(bg).toHaveAttribute('fill', 'rgba(245, 158, 11, 0.08)');
  });

  it('uses red color for low scores', () => {
    const { container } = render(<ScoreRing score={30} />);
    const bg = container.querySelector('circle');
    expect(bg).toHaveAttribute('fill', 'rgba(239, 68, 68, 0.08)');
  });
});
