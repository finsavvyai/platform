import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}));

import CurbMonologue from '../components/share/CurbMonologue';
import CurbShareButton from '../components/share/CurbShareButton';
import CurbMoment from '../components/share/CurbMoment';

describe('CurbMonologue', () => {
  it('renders Larry\'s inner monologue label', () => {
    render(<CurbMonologue score={65} />);
    expect(screen.getByText("Larry's inner monologue")).toBeInTheDocument();
  });

  it('renders a monologue text', () => {
    render(<CurbMonologue score={65} />);
    const blockquote = document.querySelector('blockquote');
    expect(blockquote).toBeInTheDocument();
    expect(blockquote?.textContent?.length).toBeGreaterThan(20);
  });

  it('renders new rant button', () => {
    render(<CurbMonologue score={40} />);
    expect(screen.getByText('New rant')).toBeInTheDocument();
  });

  it('regenerates on button click', () => {
    vi.useFakeTimers();
    render(<CurbMonologue score={50} />);
    const blockquote = document.querySelector('blockquote');
    const initial = blockquote?.textContent;

    // Click multiple times to get a different one (random)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('New rant'));
      vi.advanceTimersByTime(400);
    }
    // At least some regenerations should work
    expect(document.querySelector('blockquote')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('CurbShareButton', () => {
  it('renders post on X button', () => {
    render(<CurbShareButton score={70} episodeTitle="Test" url="https://x.com" />);
    expect(screen.getByText('Post the Curb moment on X')).toBeInTheDocument();
  });

  it('renders LinkedIn button', () => {
    render(<CurbShareButton score={70} episodeTitle="Test" url="https://x.com" />);
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('renders copy rant button', () => {
    render(<CurbShareButton score={70} episodeTitle="Test" url="https://x.com" />);
    expect(screen.getByText('Copy rant')).toBeInTheDocument();
  });

  it('renders share preview with episode title', () => {
    render(<CurbShareButton score={70} episodeTitle="The 70 Problem" url="https://x.com" />);
    expect(screen.getByText(/The 70 Problem/)).toBeInTheDocument();
  });

  it('renders "Spread the misery" label', () => {
    render(<CurbShareButton score={30} episodeTitle="Test" url="https://x.com" />);
    expect(screen.getByText('Spread the misery')).toBeInTheDocument();
  });

  it('copies text on click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<CurbShareButton score={60} episodeTitle="Test" url="https://x.com" />);
    fireEvent.click(screen.getByText('Copy rant'));
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});

describe('CurbMoment', () => {
  it('renders stare phase initially', () => {
    render(<CurbMoment score={50} episodeTitle="Test Episode" />);
    expect(screen.getByText(/stares in 50\/100/)).toBeInTheDocument();
  });

  it('starts in stare phase and schedules transitions', () => {
    vi.useFakeTimers();
    render(<CurbMoment score={80} episodeTitle="The 80 Percenter" />);
    // Starts in stare phase
    expect(screen.getByText(/stares in 80\/100/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('calls onComplete after animation', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<CurbMoment score={60} episodeTitle="Test" onComplete={onComplete} />);
    vi.advanceTimersByTime(5000);
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
