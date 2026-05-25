import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AlertDetailPage } from './AlertDetailPage';
import { alertsApi } from '../api/alerts';
import type { Alert } from '../types';

vi.mock('../api/alerts', () => ({
  alertsApi: { get: vi.fn(), resolve: vi.fn() },
}));

vi.mock('../components/alerts/EntityDetailsCard', () => ({
  EntityDetailsCard: ({ alert }: any) => <div>Entity: {alert.id}</div>,
}));
vi.mock('../components/alerts/AISummaryCard', () => ({
  AISummaryCard: () => <div>AI Summary</div>,
}));
vi.mock('../components/alerts/NotesCard', () => ({
  NotesCard: ({ notes }: any) => <div>Notes: {notes}</div>,
}));
vi.mock('../components/alerts/AlertActions', () => ({
  AlertActions: ({ onConfirm, onFalsePositive, onEscalate, onDraftAI }: any) => (
    <div>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onFalsePositive}>FalsePositive</button>
      <button onClick={onEscalate}>Escalate</button>
      <button onClick={onDraftAI}>DraftAI</button>
    </div>
  ),
}));
vi.mock('../components/alerts/AlertDetailSidebar', () => ({
  AlertDetailSidebar: ({ alert }: any) => <div>Sidebar: {alert.status}</div>,
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));

const mockAlert: Alert = {
  id: 'alert-1',
  entity: {
    name: { fullName: 'John Doe', firstName: 'John', lastName: 'Doe' },
    type: 'individual',
    nationality: 'US',
  },
  status: 'open',
  priority: 'high',
  riskLevel: 'high',
  matchedCount: 3,
  evidenceCount: 2,
  notes: 'Suspicious activity',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
} as Alert;

function renderPage(id = 'alert-1') {
  return render(
    <MemoryRouter initialEntries={[`/alerts/${id}`]}>
      <Routes>
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/alerts" element={<div>Alert Queue</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks() });

describe('AlertDetailPage', () => {
  it('shows loading spinner initially', () => {
    vi.mocked(alertsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders alert data after fetch', async () => {
    vi.mocked(alertsApi.get).mockResolvedValue(mockAlert);
    renderPage();
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
    expect(screen.getByText('Entity: alert-1')).toBeInTheDocument();
    expect(screen.getByText('Sidebar: open')).toBeInTheDocument();
    expect(screen.getByText('Notes: Suspicious activity')).toBeInTheDocument();
  });

  it('uses alert ID for name fallback when fullName absent', async () => {
    const noName = {
      ...mockAlert,
      entity: { ...mockAlert.entity, name: { fullName: '', firstName: '', lastName: '' } },
    };
    vi.mocked(alertsApi.get).mockResolvedValue(noName as Alert);
    renderPage();
    await waitFor(() => expect(screen.getByText('alert-1')).toBeInTheDocument());
  });

  it('shows error state and retry button on fetch failure', async () => {
    vi.mocked(alertsApi.get).mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows not found card when id is missing', async () => {
    vi.mocked(alertsApi.get).mockResolvedValue(null as any);
    renderPage();
    await waitFor(() => expect(screen.getByText(/back/i)).toBeInTheDocument());
  });

  it('navigates back to alerts queue on back button', async () => {
    vi.mocked(alertsApi.get).mockResolvedValue(mockAlert);
    renderPage();
    await waitFor(() => screen.getByText('John Doe'));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => expect(screen.getByText('Alert Queue')).toBeInTheDocument());
  });

  it('alert action callbacks are invocable', async () => {
    vi.mocked(alertsApi.get).mockResolvedValue(mockAlert);
    renderPage();
    await waitFor(() => screen.getByText('John Doe'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await userEvent.click(screen.getByRole('button', { name: 'FalsePositive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Escalate' }));
    await userEvent.click(screen.getByRole('button', { name: 'DraftAI' }));
  });

  it('retry button triggers reload on click', async () => {
    vi.mocked(alertsApi.get).mockRejectedValue(new Error('Network error'));
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(reloadMock).toHaveBeenCalled();
  });
});
