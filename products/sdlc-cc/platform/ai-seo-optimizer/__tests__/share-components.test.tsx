import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}));

import MessageGenerator from '../components/share/MessageGenerator';
import ShareButtons from '../components/share/ShareButtons';
import ScoreCard from '../components/share/ScoreCard';
import ViralNudge from '../components/share/ViralNudge';

describe('MessageGenerator', () => {
  it('renders the AI-generated label', () => {
    render(<MessageGenerator score={72} onMessageChange={() => {}} />);
    expect(screen.getByText('AI-generated share message')).toBeInTheDocument();
  });

  it('renders the regenerate button', () => {
    render(<MessageGenerator score={72} onMessageChange={() => {}} />);
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('calls onMessageChange on mount', () => {
    const handler = vi.fn();
    render(<MessageGenerator score={72} onMessageChange={handler} />);
    expect(handler).toHaveBeenCalled();
  });

  it('generates new message on regenerate click', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    render(<MessageGenerator score={72} onMessageChange={handler} />);
    const initialCalls = handler.mock.calls.length;
    fireEvent.click(screen.getByText('Regenerate'));
    vi.advanceTimersByTime(500);
    expect(handler.mock.calls.length).toBeGreaterThan(initialCalls);
    vi.useRealTimers();
  });
});

describe('ShareButtons', () => {
  it('renders all share buttons', () => {
    render(<ShareButtons message="test" url="https://x.com" score={80} />);
    expect(screen.getByText('Post on X')).toBeInTheDocument();
    expect(screen.getByText('Share on LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Copy text')).toBeInTheDocument();
    expect(screen.getByText('More options')).toBeInTheDocument();
  });

  it('shows Copied! after clicking copy', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<ShareButtons message="hello" url="https://x.com" score={50} />);
    fireEvent.click(screen.getByText('Copy text'));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});

describe('ScoreCard', () => {
  it('renders the score verdict', () => {
    render(<ScoreCard score={85} url="https://example.com" />);
    expect(screen.getByText("You're on their radar")).toBeInTheDocument();
  });

  it('renders the URL', () => {
    render(<ScoreCard score={50} url="https://test.com/blog" />);
    expect(screen.getByText('https://test.com/blog')).toBeInTheDocument();
  });

  it('renders agent score stats', () => {
    render(<ScoreCard score={70} url="https://example.com" />);
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Perplexity')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
  });
});

describe('ViralNudge', () => {
  it('shows flex message for high score', () => {
    render(<ViralNudge score={80} />);
    expect(screen.getByText(/top 12%/)).toBeInTheDocument();
  });

  it('shows competition message for medium score', () => {
    render(<ViralNudge score={55} />);
    expect(screen.getByText(/competitor/)).toBeInTheDocument();
  });

  it('shows roast encouragement for low score', () => {
    render(<ViralNudge score={25} />);
    expect(screen.getByText(/Bad scores go MORE viral/)).toBeInTheDocument();
  });
});
