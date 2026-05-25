import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../src/components/Avatar';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderAvatar = (props?: React.ComponentProps<typeof Avatar>) => {
  return render(
    <ThemeProvider>
      <Avatar {...props} />
    </ThemeProvider>
  );
};

describe('Avatar', () => {
  it('should render with initials', () => {
    renderAvatar({ initials: 'JD' });
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should render with default initials', () => {
    renderAvatar();
    expect(screen.getByText('AV')).toBeInTheDocument();
  });

  it('should render image when src provided', () => {
    renderAvatar({ src: 'https://example.com/avatar.jpg', alt: 'John Doe' });
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('example.com');
  });

  it('should render with small size', () => {
    const { container } = renderAvatar({ size: 'sm' });
    const div = container.querySelector('div');
    expect(div).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('should render with medium size', () => {
    const { container } = renderAvatar({ size: 'md' });
    const div = container.querySelector('div');
    expect(div).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('should render with large size', () => {
    const { container } = renderAvatar({ size: 'lg' });
    const div = container.querySelector('div');
    expect(div).toHaveStyle({ width: '56px', height: '56px' });
  });

  it('should have circular border radius', () => {
    const { container } = renderAvatar();
    const div = container.querySelector('div');
    expect(div).toHaveStyle({ borderRadius: '50%' });
  });

  it('should center content', () => {
    const { container } = renderAvatar();
    const div = container.querySelector('div');
    expect(div).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('should support custom alt text', () => {
    renderAvatar({
      src: 'https://example.com/avatar.jpg',
      alt: 'Custom Alt',
    });
    expect(screen.getByAltText('Custom Alt')).toBeInTheDocument();
  });
});
