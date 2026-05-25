/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocsOverview from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('DocsOverview', () => {
  it('renders the page heading', () => {
    render(<DocsOverview />);
    expect(screen.getByText('DOCUMENTATION')).toBeDefined();
  });

  it('renders What is OpenSyber section', () => {
    render(<DocsOverview />);
    expect(screen.getByText('What is OpenSyber?')).toBeDefined();
  });

  it('renders quickstart steps', () => {
    render(<DocsOverview />);
    expect(screen.getByText('Quickstart')).toBeDefined();
    expect(screen.getByText('Sign up')).toBeDefined();
    expect(screen.getByText('Deploy an agent')).toBeDefined();
  });

  it('renders doc navigation cards', () => {
    render(<DocsOverview />);
    expect(screen.getByText('Getting Started')).toBeDefined();
    expect(screen.getByText('Security Features')).toBeDefined();
    expect(screen.getByText('Skills Development')).toBeDefined();
    expect(screen.getByText('API Reference')).toBeDefined();
  });

  it('has correct navigation links', () => {
    render(<DocsOverview />);
    const gettingStarted = screen.getByText('Getting Started').closest('a');
    expect(gettingStarted?.getAttribute('href')).toBe('/docs/getting-started');
  });
});
