/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreatMapViz } from './ThreatMapViz';

describe('ThreatMapViz', () => {
  it('renders nothing when countries is empty', () => {
    const { container } = render(<ThreatMapViz countries={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders header when countries are provided', () => {
    const countries = [
      { country: 'United States', eventCount: 10, severity: 'critical' as const },
    ];
    render(<ThreatMapViz countries={countries} />);
    expect(screen.getByText('Threat Origins')).toBeDefined();
  });

  it('renders country bubbles', () => {
    const countries = [
      { country: 'United States', eventCount: 10, severity: 'critical' as const },
      { country: 'Germany', eventCount: 5, severity: 'medium' as const },
    ];
    render(<ThreatMapViz countries={countries} />);
    expect(screen.getByText('UNI')).toBeDefined();
    expect(screen.getByText('GER')).toBeDefined();
  });

  it('displays event counts', () => {
    const countries = [
      { country: 'China', eventCount: 42, severity: 'high' as const },
    ];
    render(<ThreatMapViz countries={countries} />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('applies severity-based styling', () => {
    const countries = [
      { country: 'Russia', eventCount: 8, severity: 'critical' as const },
    ];
    const { container } = render(<ThreatMapViz countries={countries} />);
    const bubble = container.querySelector('[title]') as HTMLElement;
    expect(bubble.className).toContain('border-red-500');
  });

  it('shows correct title with country, count and severity', () => {
    const countries = [
      { country: 'Brazil', eventCount: 3, severity: 'low' as const },
    ];
    const { container } = render(<ThreatMapViz countries={countries} />);
    const bubble = container.querySelector('[title]') as HTMLElement;
    expect(bubble.getAttribute('title')).toBe('Brazil: 3 events (low)');
  });

  it('sizes bubbles based on event count relative to max', () => {
    const countries = [
      { country: 'US', eventCount: 100, severity: 'critical' as const },
      { country: 'DE', eventCount: 1, severity: 'low' as const },
    ];
    const { container } = render(<ThreatMapViz countries={countries} />);
    const bubbles = container.querySelectorAll('[title]');
    const usBubble = bubbles[0] as HTMLElement;
    const deBubble = bubbles[1] as HTMLElement;
    const usSize = parseInt(usBubble.style.width);
    const deSize = parseInt(deBubble.style.width);
    expect(usSize).toBeGreaterThan(deSize);
  });
});
