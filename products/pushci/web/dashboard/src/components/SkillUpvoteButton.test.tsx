import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkillUpvoteButton from './SkillUpvoteButton';

describe('SkillUpvoteButton', () => {
  it('shows count and fires onToggle', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(<SkillUpvoteButton count={9} active={false} onToggle={onToggle} />);
    expect(screen.getByTestId('upvote-count')).toHaveTextContent('9');
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sets aria-pressed when active', () => {
    render(<SkillUpvoteButton count={1} active onToggle={() => Promise.resolve()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not fire onToggle when disabled', async () => {
    const onToggle = vi.fn();
    render(<SkillUpvoteButton count={0} disabled onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('exposes an accessible label with the count', () => {
    render(<SkillUpvoteButton count={42} onToggle={() => Promise.resolve()} />);
    expect(screen.getByRole('button', { name: /42 upvotes/i })).toBeInTheDocument();
  });
});
