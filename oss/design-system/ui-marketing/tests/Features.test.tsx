import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Features, Feature } from '../src/sections/Features';

const mockFeatures: Feature[] = [
  {
    icon: '⚡',
    title: 'Fast',
    description: 'Lightning quick performance',
  },
  {
    icon: '🔒',
    title: 'Secure',
    description: 'Bank-level security',
  },
  {
    icon: '📊',
    title: 'Analytics',
    description: 'Powerful insights',
  },
];

describe('Features', () => {
  it('should render features section', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByTestId('features')).toBeInTheDocument();
  });

  it('should render features grid', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByTestId('features-grid')).toBeInTheDocument();
  });

  it('should display all features', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByText('Fast')).toBeInTheDocument();
    expect(screen.getByText('Secure')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('should display feature descriptions', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByText('Lightning quick performance')).toBeInTheDocument();
    expect(screen.getByText('Bank-level security')).toBeInTheDocument();
    expect(screen.getByText('Powerful insights')).toBeInTheDocument();
  });

  it('should display feature icons', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByText('⚡')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('should handle empty features array', () => {
    const { container } = render(<Features features={[]} />);
    const grid = container.querySelector('[data-testid="features-grid"]');
    expect(grid?.children).toHaveLength(0);
  });

  it('should render each feature with data-testid', () => {
    render(<Features features={mockFeatures} />);
    expect(screen.getByTestId('feature-0')).toBeInTheDocument();
    expect(screen.getByTestId('feature-1')).toBeInTheDocument();
    expect(screen.getByTestId('feature-2')).toBeInTheDocument();
  });
});
