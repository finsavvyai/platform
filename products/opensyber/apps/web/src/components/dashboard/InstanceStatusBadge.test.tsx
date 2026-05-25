/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstanceStatusBadge } from './InstanceStatusBadge';

describe('InstanceStatusBadge', () => {
  it('renders running status with green color', () => {
    const { container } = render(<InstanceStatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-green-400');
  });

  it('renders ready status with green color', () => {
    render(<InstanceStatusBadge status="ready" />);
    expect(screen.getByText('Ready')).toBeDefined();
  });

  it('renders provisioning status with yellow color and pulse', () => {
    const { container } = render(<InstanceStatusBadge status="provisioning" />);
    expect(screen.getByText('Provisioning')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-yellow-400');
    const dot = badge.querySelector('span > span') as HTMLElement;
    expect(dot.className).toContain('animate-pulse');
  });

  it('renders installing status with yellow color and pulse', () => {
    const { container } = render(<InstanceStatusBadge status="installing" />);
    expect(screen.getByText('Installing')).toBeDefined();
    const dot = container.querySelector('span span') as HTMLElement;
    expect(dot.className).toContain('animate-pulse');
  });

  it('renders stopped status with neutral color', () => {
    const { container } = render(<InstanceStatusBadge status="stopped" />);
    expect(screen.getByText('Stopped')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-text-secondary');
  });

  it('renders error status with red color', () => {
    const { container } = render(<InstanceStatusBadge status="error" />);
    expect(screen.getByText('Error')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-red-400');
  });

  it('renders suspended status with amber color', () => {
    const { container } = render(<InstanceStatusBadge status="suspended" />);
    expect(screen.getByText('Suspended')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-amber-400');
  });

  it('renders destroying status with red color and pulse', () => {
    const { container } = render(<InstanceStatusBadge status="destroying" />);
    expect(screen.getByText('Destroying')).toBeDefined();
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-red-400');
    const dot = container.querySelector('span span') as HTMLElement;
    expect(dot.className).toContain('animate-pulse');
  });

  it('does not pulse for running status', () => {
    const { container } = render(<InstanceStatusBadge status="running" />);
    const dot = container.querySelector('span span') as HTMLElement;
    expect(dot.className).not.toContain('animate-pulse');
  });

  it('does not pulse for stopped status', () => {
    const { container } = render(<InstanceStatusBadge status="stopped" />);
    const dot = container.querySelector('span span') as HTMLElement;
    expect(dot.className).not.toContain('animate-pulse');
  });
});
