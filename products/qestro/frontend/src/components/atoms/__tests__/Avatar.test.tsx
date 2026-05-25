import { describe, it, expect } from 'vitest';
import '../../../test/extend-expect';
import { render, screen } from '@testing-library/react';
import Avatar from '../Avatar';

describe('Avatar', () => {
  it('renders image when src is provided', () => {
    render(<Avatar src="https://example.com/photo.jpg" name="John Doe" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(img.getAttribute('alt')).toBe('John Doe');
  });

  it('renders initials when no src', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders single initial for single name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('renders "U" when no name and no src', () => {
    render(<Avatar />);
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('applies small size class', () => {
    render(<Avatar name="Test" size="sm" />);
    const el = screen.getByRole('img', { hidden: true });
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('w-8');
  });

  it('applies large size class', () => {
    render(<Avatar name="Test" size="lg" />);
    const el = screen.getByRole('img', { hidden: true });
    expect(el.className).toContain('h-14');
    expect(el.className).toContain('w-14');
  });

  it('has accessible label on fallback', () => {
    render(<Avatar name="Jane Smith" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Jane Smith');
  });
});
