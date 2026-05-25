import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Monitoring } from './Monitoring';
import { monitoringApi } from '../api/monitoring';

vi.mock('../api/monitoring', () => ({
  monitoringApi: { listProfiles: vi.fn(), getDashboard: vi.fn() },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('./MonitorProfileCard', () => ({
  default: ({ profile }: any) => <div>Profile: {profile.name}</div>,
}));
vi.mock('./AddMonitorModal', () => ({
  default: ({ onClose }: any) => <div><span>AddMonitorModal</span><button onClick={onClose}>Close</button></div>,
}));
vi.mock('../components/monitoring/MonitoringIngestCard', () => ({
  MonitoringIngestCard: ({ onAddManual, onImport }: any) => (
    <div>
      <button onClick={onAddManual}>Add Manual</button>
      <button onClick={onImport}>Import</button>
    </div>
  ),
}));

const mockDashboard = { active_profiles: 5, pending_alerts: 2, total_alerts: 10, total_profiles: 8 };
const mockProfile = { id: 'p1', name: 'John Doe', entity_type: 'individual', status: 'active' };

beforeEach(() => { vi.clearAllMocks() });

function renderPage() {
  return render(<MemoryRouter><Monitoring /></MemoryRouter>);
}

describe('Monitoring', () => {
  it('renders dashboard stats after load', async () => {
    vi.mocked(monitoringApi.listProfiles).mockResolvedValue({ profiles: [] } as any);
    vi.mocked(monitoringApi.getDashboard).mockResolvedValue(mockDashboard as any);
    renderPage();
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('Active Profiles')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows empty state when no profiles', async () => {
    vi.mocked(monitoringApi.listProfiles).mockResolvedValue({ profiles: [] } as any);
    vi.mocked(monitoringApi.getDashboard).mockResolvedValue(mockDashboard as any);
    renderPage();
    await waitFor(() => expect(screen.getByText(/no monitored entities yet/i)).toBeInTheDocument());
  });

  it('renders profiles', async () => {
    vi.mocked(monitoringApi.listProfiles).mockResolvedValue({ profiles: [mockProfile] } as any);
    vi.mocked(monitoringApi.getDashboard).mockResolvedValue(mockDashboard as any);
    renderPage();
    await waitFor(() => expect(screen.getByText('Profile: John Doe')).toBeInTheDocument());
  });

  it('opens add monitor modal', async () => {
    vi.mocked(monitoringApi.listProfiles).mockResolvedValue({ profiles: [] } as any);
    vi.mocked(monitoringApi.getDashboard).mockResolvedValue(mockDashboard as any);
    renderPage();
    await waitFor(() => screen.getByText(/no monitored entities yet/i));
    await userEvent.click(screen.getByRole('button', { name: /add manual/i }));
    expect(screen.getByText('AddMonitorModal')).toBeInTheDocument();
  });

  it('closes modal on close', async () => {
    vi.mocked(monitoringApi.listProfiles).mockResolvedValue({ profiles: [] } as any);
    vi.mocked(monitoringApi.getDashboard).mockResolvedValue(mockDashboard as any);
    renderPage();
    await waitFor(() => screen.getByText(/no monitored entities yet/i));
    await userEvent.click(screen.getByRole('button', { name: /add manual/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('AddMonitorModal')).not.toBeInTheDocument();
  });
});
