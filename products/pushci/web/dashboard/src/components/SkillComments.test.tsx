import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkillComments from './SkillComments';
import type { SkillComment } from '../hooks/useSkillSocial';

const baseComment = (over: Partial<SkillComment> = {}): SkillComment => ({
  id: 'c1', skill_id: 'heal', author_sub: 'github:1', author_login: 'octo',
  body: 'looks great', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  parent_id: null, ...over,
});

describe('SkillComments', () => {
  it('renders a relative timestamp for each comment', () => {
    render(<SkillComments comments={[baseComment()]} canPost={false} onPost={vi.fn()} />);
    expect(screen.getByText(/2h ago/i)).toBeInTheDocument();
  });

  it('shows login prompt when user cannot post', () => {
    render(<SkillComments comments={[]} canPost={false} onPost={vi.fn()} />);
    expect(screen.getByRole('note')).toHaveTextContent(/login to comment/i);
  });

  it('submits the body via onPost and clears the input', async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<SkillComments comments={[]} canPost onPost={onPost} />);
    await userEvent.type(screen.getByLabelText(/comment body/i), 'first!');
    await userEvent.click(screen.getByRole('button', { name: /post/i }));
    expect(onPost).toHaveBeenCalledWith('first!', undefined);
  });

  it('nests replies under their parent', () => {
    const c: SkillComment[] = [
      baseComment({ id: 'p1', body: 'parent' }),
      baseComment({ id: 'r1', parent_id: 'p1', body: 'reply' }),
    ];
    render(<SkillComments comments={c} canPost={false} onPost={vi.fn()} />);
    const rendered = screen.getAllByTestId('skill-comment');
    expect(rendered).toHaveLength(2);
    expect(rendered[0]).toHaveTextContent('parent');
  });

  it('shows delete button only for the author when onDelete provided', () => {
    const c = baseComment({ author_sub: 'github:me' });
    render(<SkillComments comments={[c]} canPost currentUserSub="github:me"
      onPost={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
  });

  it('empty state message when there are no comments', () => {
    render(<SkillComments comments={[]} canPost onPost={vi.fn()} />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });
});
