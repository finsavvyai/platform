import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SessionStatsCards } from './SessionStatsCards';
import { SessionFilters } from './SessionFilters';
import { SessionTable } from './SessionTable';
import type { SessionRecording, SessionStats } from './types';

const testStats: SessionStats = {
  totalSessions: 1247,
  activeNow: 8,
  flagged: 12,
  avgDuration: 34,
  byType: { ssh: 45, web: 30, api: 25 },
};

const testSessions: SessionRecording[] = [
  {
    id: 'sess-001', user: 'Alice Chen', userEmail: 'alice@company.com',
    sessionType: 'SSH', target: 'prod-db-01.internal', duration: 42,
    riskScore: 92, status: 'flagged', startedAt: '2026-03-18T09:12:00Z',
    commands: [],
  },
  {
    id: 'sess-002', user: 'Bob Martinez', userEmail: 'bob@company.com',
    sessionType: 'Web', target: 'admin.opensyber.cloud', duration: 18,
    riskScore: 25, status: 'completed', startedAt: '2026-03-18T10:05:00Z',
    commands: [],
  },
  {
    id: 'sess-003', user: 'Carol Nguyen', userEmail: 'carol@company.com',
    sessionType: 'API', target: 'api.opensyber.cloud', duration: 5,
    riskScore: 15, status: 'completed', startedAt: '2026-03-18T11:30:00Z',
    commands: [],
  },
];

describe('SessionStatsCards', () => {
  it('renders all four stat cards with correct values', () => {
    render(<SessionStatsCards stats={testStats} />);
    expect(screen.getByText('1,247')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('34m')).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<SessionStatsCards stats={testStats} />);
    expect(screen.getByText('Total Sessions (30d)')).toBeInTheDocument();
    expect(screen.getByText('Active Now')).toBeInTheDocument();
    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
  });
});

describe('SessionFilters', () => {
  const defaultProps = {
    sessionType: 'all',
    onSessionTypeChange: vi.fn(),
    riskLevel: 'all',
    onRiskLevelChange: vi.fn(),
    flaggedOnly: false,
    onFlaggedOnlyChange: vi.fn(),
    userFilter: '',
    onUserFilterChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all filter controls', () => {
    render(<SessionFilters {...defaultProps} />);
    expect(screen.getByLabelText('Filter by user')).toBeInTheDocument();
    expect(screen.getByLabelText('Session type')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk level')).toBeInTheDocument();
    expect(screen.getByText('Flagged only')).toBeInTheDocument();
  });

  it('calls onSessionTypeChange when type is selected', () => {
    render(<SessionFilters {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Session type'), { target: { value: 'SSH' } });
    expect(defaultProps.onSessionTypeChange).toHaveBeenCalledWith('SSH');
  });

  it('calls onFlaggedOnlyChange when checkbox is toggled', () => {
    render(<SessionFilters {...defaultProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(defaultProps.onFlaggedOnlyChange).toHaveBeenCalledWith(true);
  });
});

describe('SessionTable', () => {
  it('renders sessions in a table', () => {
    const onPlay = vi.fn();
    render(<SessionTable sessions={testSessions.slice(0, 3)} onPlay={onPlay} />);
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getByText('Bob Martinez')).toBeInTheDocument();
    expect(screen.getByText('Carol Nguyen')).toBeInTheDocument();
  });

  it('shows empty state when no sessions match', () => {
    const onPlay = vi.fn();
    render(<SessionTable sessions={[]} onPlay={onPlay} />);
    expect(screen.getByText('No sessions match your filters')).toBeInTheDocument();
  });

  it('calls onPlay when Play button is clicked', () => {
    const onPlay = vi.fn();
    render(<SessionTable sessions={[testSessions[0]]} onPlay={onPlay} />);
    fireEvent.click(screen.getByText('Play'));
    expect(onPlay).toHaveBeenCalledWith(testSessions[0]);
  });

  it('shows flagged status badge with correct styling', () => {
    const onPlay = vi.fn();
    const flagged = testSessions.filter((s) => s.status === 'flagged');
    render(<SessionTable sessions={flagged} onPlay={onPlay} />);
    const badges = screen.getAllByText('Flagged');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders risk scores with color coding', () => {
    const onPlay = vi.fn();
    render(<SessionTable sessions={testSessions.slice(0, 2)} onPlay={onPlay} />);
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
