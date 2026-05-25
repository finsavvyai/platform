import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer, FooterLink } from '../src/sections/Footer';

const mockLinks: FooterLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: '/contact' },
];

describe('Footer', () => {
  it('should render footer section', () => {
    render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should display footer links', () => {
    render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    expect(screen.getByTestId('footer-links')).toBeInTheDocument();
  });

  it('should display all links with correct text', () => {
    render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('should link to correct hrefs', () => {
    render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    expect(screen.getByTestId('link-0')).toHaveAttribute('href', '/privacy');
    expect(screen.getByTestId('link-1')).toHaveAttribute('href', '/terms');
    expect(screen.getByTestId('link-2')).toHaveAttribute('href', '/contact');
  });

  it('should display copyright text', () => {
    render(
      <Footer links={mockLinks} copyright="2024 FinSavvy Inc." />
    );
    expect(screen.getByTestId('copyright')).toHaveTextContent('2024 FinSavvy Inc.');
  });

  it('should have dark background', () => {
    const { container } = render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    const footer = container.querySelector('[data-testid="footer"]');
    expect(footer).toHaveStyle({ backgroundColor: '#1C1C1E' });
  });

  it('should have white text', () => {
    const { container } = render(
      <Footer links={mockLinks} copyright="2024 FinSavvy" />
    );
    const footer = container.querySelector('[data-testid="footer"]');
    expect(footer).toHaveStyle({ color: '#FFFFFF' });
  });
});
