import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AccessSummaryCards } from './AccessSummaryCards';
import { PendingRequestsTable } from './PendingRequestsTable';
import { RequestAccessForm } from './RequestAccessForm';
import { RequestHistory } from './RequestHistory';
import { LevelBadge, StatusBadge } from './AccessBadges';
import type { AccessSummary, PendingRequest, HistoricalRequest } from './types';

const testSummary: AccessSummary = {
  activeSessions: 3,
  pendingRequests: 2,
  requestsToday: 7,
};

const testPendingRequests: PendingRequest[] = [
  { id: 'pr-01', requester: 'Michael Brown', resource: 'Production Database', level: 'admin', duration: '1 hour', justification: 'Emergency database migration', ticketRef: 'INC-4521', requestedAt: '2026-03-18T14:45:00Z' },
  { id: 'pr-02', requester: 'Lisa Davis', resource: 'Cloud Console (GCP)', level: 'read-write', duration: '4 hours', justification: 'Configure Cloud Run service', requestedAt: '2026-03-18T14:50:00Z' },
];

const testHistory: HistoricalRequest[] = [
  { id: 'hr-01', requester: 'Sarah Johnson', resource: 'Production Database', level: 'read-write', duration: '4 hours', status: 'approved', processedBy: 'Alice Chen', date: '2026-03-18T10:00:00Z' },
  { id: 'hr-02', requester: 'Dave Patel', resource: 'Admin Panel', level: 'admin', duration: '30 min', status: 'denied', processedBy: 'Bob Martinez', date: '2026-03-18T09:30:00Z' },
];

describe('AccessSummaryCards', () => {
  it('renders all three stat cards', () => {
    render(<AccessSummaryCards summary={testSummary} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders card labels', () => {
    render(<AccessSummaryCards summary={testSummary} />);
    expect(screen.getByText('Active Elevated Sessions')).toBeInTheDocument();
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Requests Today')).toBeInTheDocument();
  });
});

describe('RequestAccessForm', () => {
  it('shows Request Access button initially', () => {
    render(<RequestAccessForm />);
    expect(screen.getByText('Request Access')).toBeInTheDocument();
  });

  it('expands form when button is clicked', () => {
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByText('Request Access'));
    expect(screen.getByText('Request Elevated Access')).toBeInTheDocument();
    expect(screen.getByText('Submit Request')).toBeInTheDocument();
  });

  it('shows all required form fields when expanded', () => {
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByText('Request Access'));
    expect(screen.getByText('Target Resource')).toBeInTheDocument();
    expect(screen.getByText('Access Level')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Justification (required)')).toBeInTheDocument();
  });

  it('disables submit when justification is empty', () => {
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByText('Request Access'));
    const submit = screen.getByText('Submit Request');
    expect(submit.closest('button')).toBeDisabled();
  });
});

describe('PendingRequestsTable', () => {
  it('renders pending requests', () => {
    render(<PendingRequestsTable requests={testPendingRequests} />);
    expect(screen.getByText('Michael Brown')).toBeInTheDocument();
    expect(screen.getByText('Lisa Davis')).toBeInTheDocument();
  });

  it('shows empty state when no pending requests', () => {
    render(<PendingRequestsTable requests={[]} />);
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
  });

  it('renders approve and deny buttons', () => {
    render(<PendingRequestsTable requests={testPendingRequests} />);
    const approveButtons = screen.getAllByLabelText('Approve');
    const denyButtons = screen.getAllByLabelText('Deny');
    expect(approveButtons.length).toBe(2);
    expect(denyButtons.length).toBe(2);
  });
});

describe('RequestHistory', () => {
  it('renders historical requests', () => {
    render(<RequestHistory requests={testHistory} />);
    expect(screen.getByText('Request History')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
  });

  it('shows empty state when no history', () => {
    render(<RequestHistory requests={[]} />);
    expect(screen.getByText('No request history')).toBeInTheDocument();
  });
});

describe('LevelBadge', () => {
  it('renders the correct level text', () => {
    const { rerender } = render(<LevelBadge level="read-only" />);
    expect(screen.getByText('read-only')).toBeInTheDocument();

    rerender(<LevelBadge level="admin" />);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders the correct status text', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('approved')).toBeInTheDocument();
  });
});
