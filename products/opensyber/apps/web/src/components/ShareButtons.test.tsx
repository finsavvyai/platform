/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButtons } from './ShareButtons';

describe('ShareButtons', () => {
  const defaultProps = {
    url: '/trust/123',
    text: 'Check out our security score',
  };

  it('renders copy link button', () => {
    render(<ShareButtons {...defaultProps} />);
    expect(screen.getByText('Copy Link')).toBeDefined();
  });

  it('renders X / Twitter share link', () => {
    render(<ShareButtons {...defaultProps} />);
    const twitterLink = screen.getByText('X / Twitter').closest('a');
    expect(twitterLink?.getAttribute('href')).toContain('twitter.com/intent/tweet');
    expect(twitterLink?.getAttribute('target')).toBe('_blank');
  });

  it('renders LinkedIn share link', () => {
    render(<ShareButtons {...defaultProps} />);
    const linkedInLink = screen.getByText('LinkedIn').closest('a');
    expect(linkedInLink?.getAttribute('href')).toContain('linkedin.com/sharing');
    expect(linkedInLink?.getAttribute('target')).toBe('_blank');
  });

  it('calls onAction callback for Twitter click', () => {
    const onAction = vi.fn();
    render(<ShareButtons {...defaultProps} onAction={onAction} />);
    fireEvent.click(screen.getByText('X / Twitter'));
    expect(onAction).toHaveBeenCalledWith('x');
  });

  it('calls onAction callback for LinkedIn click', () => {
    const onAction = vi.fn();
    render(<ShareButtons {...defaultProps} onAction={onAction} />);
    fireEvent.click(screen.getByText('LinkedIn'));
    expect(onAction).toHaveBeenCalledWith('linkedin');
  });
});
