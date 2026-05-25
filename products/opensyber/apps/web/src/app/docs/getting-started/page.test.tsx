/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GettingStartedPage from './page';

describe('GettingStartedPage', () => {
  it('renders the page heading', () => {
    render(<GettingStartedPage />);
    expect(screen.getByText('Getting Started')).toBeDefined();
  });

  it('renders all setup steps', () => {
    render(<GettingStartedPage />);
    expect(screen.getByText('1. Create Your Account')).toBeDefined();
    expect(screen.getByText('2. Deploy Your Agent')).toBeDefined();
    expect(screen.getByText('3. Install Skills')).toBeDefined();
    expect(screen.getByText('4. Configure Security')).toBeDefined();
    expect(screen.getByText('5. Monitor & Iterate')).toBeDefined();
  });

  it('renders the help box with FAQ link', () => {
    render(<GettingStartedPage />);
    expect(screen.getByText('Need help?')).toBeDefined();
    const faqLink = screen.getByText('FAQ');
    expect(faqLink.getAttribute('href')).toBe('/docs/faq');
  });

  it('shows support email', () => {
    render(<GettingStartedPage />);
    expect(screen.getByText('support@opensyber.cloud')).toBeDefined();
  });
});
