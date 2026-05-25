import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Testimonials, Testimonial } from '../src/sections/Testimonials';

const mockTestimonials: Testimonial[] = [
  {
    quote: 'This product changed my life',
    author: 'Alice Johnson',
    company: 'TechCorp',
  },
  {
    quote: 'Best investment ever',
    author: 'Bob Smith',
    company: 'StartupXYZ',
  },
  {
    quote: 'Incredible value',
    author: 'Carol Williams',
    company: 'Enterprise Inc',
  },
];

describe('Testimonials', () => {
  it('should render testimonials section', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByTestId('testimonials')).toBeInTheDocument();
  });

  it('should render testimonials grid', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByTestId('testimonials-grid')).toBeInTheDocument();
  });

  it('should display all testimonial quotes', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByText(/This product changed my life/)).toBeInTheDocument();
    expect(screen.getByText(/Best investment ever/)).toBeInTheDocument();
    expect(screen.getByText(/Incredible value/)).toBeInTheDocument();
  });

  it('should display all author names', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Carol Williams')).toBeInTheDocument();
  });

  it('should display all company names', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('TechCorp')).toBeInTheDocument();
    expect(screen.getByText('StartupXYZ')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Inc')).toBeInTheDocument();
  });

  it('should render each testimonial with data-testid', () => {
    render(<Testimonials testimonials={mockTestimonials} />);
    expect(screen.getByTestId('testimonial-0')).toBeInTheDocument();
    expect(screen.getByTestId('testimonial-1')).toBeInTheDocument();
    expect(screen.getByTestId('testimonial-2')).toBeInTheDocument();
  });

  it('should handle empty testimonials array', () => {
    const { container } = render(<Testimonials testimonials={[]} />);
    const grid = container.querySelector('[data-testid="testimonials-grid"]');
    expect(grid?.children).toHaveLength(0);
  });
});
