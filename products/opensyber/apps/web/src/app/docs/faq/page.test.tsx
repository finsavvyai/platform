/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FaqPage from './page';

describe('FaqPage', () => {
  it('renders the page heading', () => {
    render(<FaqPage />);
    expect(screen.getByText('FAQ')).toBeDefined();
  });

  it('renders FAQ questions', () => {
    render(<FaqPage />);
    expect(screen.getByText('How do I secure my AI coding agent?')).toBeDefined();
    expect(screen.getByText('How does the free plan work?')).toBeDefined();
    expect(screen.getByText('What are device-bound session tokens?')).toBeDefined();
  });

  it('renders FAQ answers', () => {
    render(<FaqPage />);
    expect(screen.getByText(/OpenSyber secures AI coding agents/)).toBeDefined();
  });

  it('renders JSON-LD schema', () => {
    const { container } = render(<FaqPage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeDefined();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity.length).toBeGreaterThan(0);
  });

  it('renders support contact section', () => {
    render(<FaqPage />);
    expect(screen.getByText('Still have questions?')).toBeDefined();
    expect(screen.getByText('support@opensyber.cloud')).toBeDefined();
  });
});
