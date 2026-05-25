import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../src/components/Skeleton';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const renderSkeleton = (props?: React.ComponentProps<typeof Skeleton>) => {
  return render(
    <ThemeProvider>
      <Skeleton {...props} />
    </ThemeProvider>
  );
};

describe('Skeleton', () => {
  it('should render skeleton element', () => {
    const { container } = renderSkeleton();
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);
  });

  it('should use default width and height', () => {
    const { container } = renderSkeleton();
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.width).toBe('100%');
    expect(skeleton.style.height).toBe('16px');
  });

  it('should accept custom width', () => {
    const { container } = renderSkeleton({ width: '200px' });
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.width).toBe('200px');
  });

  it('should accept numeric width', () => {
    const { container } = renderSkeleton({ width: 150 });
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.width).toBe('150px');
  });

  it('should accept custom height', () => {
    const { container } = renderSkeleton({ height: '24px' });
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.height).toBe('24px');
  });

  it('should accept numeric height', () => {
    const { container } = renderSkeleton({ height: 100 });
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.height).toBe('100px');
  });

  it('should render circular skeleton', () => {
    const { container } = renderSkeleton({ circle: true });
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.borderRadius).toBe('50%');
  });

  it('should have rounded border radius by default', () => {
    const { container } = renderSkeleton();
    const divs = container.querySelectorAll('div');
    const skeleton = divs[divs.length - 1] as HTMLDivElement;
    expect(skeleton.style.borderRadius).toBe('8px');
  });

  it('should have pulse animation defined', () => {
    const { container } = renderSkeleton();
    expect(container.querySelector('style')).toBeInTheDocument();
  });
});
