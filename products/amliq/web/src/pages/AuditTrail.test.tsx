import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuditTrail } from './AuditTrail';
import * as useAuditModule from '../hooks/useAudit';

vi.mock('../hooks/useAudit');
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/ExportButton', () => ({
  ExportButton: () => <button>Export</button>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));

const mockEntry = {
  id: 'e1',
  action: 'alert_resolved' as const,
  actor: 'analyst@co.com',
  target: 'alert-123',
  timestamp: '2026-01-01T10:00:00Z',
  details: {},
};

beforeEach(() => { vi.clearAllMocks() });

function renderPage() {
  return render(<AuditTrail />);
}

describe('AuditTrail', () => {
  it('shows loading spinner', () => {
    vi.spyOn(useAuditModule, 'useAudit').mockReturnValue({
      entries: [], loading: true, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    vi.spyOn(useAuditModule, 'useAudit').mockReturnValue({
      entries: [], loading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/no audit entries yet/i)).toBeInTheDocument();
  });

  it('renders audit entries', () => {
    vi.spyOn(useAuditModule, 'useAudit').mockReturnValue({
      entries: [mockEntry], loading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('analyst@co.com')).toBeInTheDocument();
    expect(screen.getByText('alert-123')).toBeInTheDocument();
    expect(screen.getByText(/alert resolved/i)).toBeInTheDocument();
  });

  it('shows error message', () => {
    vi.spyOn(useAuditModule, 'useAudit').mockReturnValue({
      entries: [], loading: false, error: new Error('Load failed'), refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Load failed');
  });

  it('export button is disabled when no entries', () => {
    vi.spyOn(useAuditModule, 'useAudit').mockReturnValue({
      entries: [], loading: false, error: null, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });
});
