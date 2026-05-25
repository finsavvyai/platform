import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VesselScreening } from './VesselScreening';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { post: vi.fn() },
  ApiError: class ApiError extends Error { status: number; constructor(msg: string, status: number) { super(msg); this.status = status; } },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/screening/ScreeningQuotaBanner', () => ({
  ScreeningQuotaBanner: () => <div>QuotaBanner</div>,
}));
vi.mock('../components/screening/VesselForm', () => ({
  VesselForm: ({ vesselName, setVesselName }: any) => (
    <input placeholder="Vessel name" value={vesselName} onChange={e => setVesselName(e.target.value)} />
  ),
}));
vi.mock('../components/screening/VesselResults', () => ({
  VesselResults: ({ results }: any) => <div>Results: {results.total}</div>,
}));
vi.mock('../components/screening/LimitReachedBanner', () => ({
  LimitReachedBanner: () => <div>LimitReached</div>,
}));

const mockResults = { matches: [], total: 3 };

beforeEach(() => { vi.clearAllMocks() });

describe('VesselScreening', () => {
  it('renders page title and quota banner', () => {
    render(<VesselScreening />);
    expect(screen.getByText('Vessel Screening')).toBeInTheDocument();
    expect(screen.getByText('QuotaBanner')).toBeInTheDocument();
  });

  it('screen button disabled when vessel name empty', () => {
    render(<VesselScreening />);
    expect(screen.getByRole('button', { name: /screen vessel/i })).toBeDisabled();
  });

  it('screen button enabled after typing vessel name', async () => {
    render(<VesselScreening />);
    await userEvent.type(screen.getByPlaceholderText(/vessel name/i), 'Ever Given');
    expect(screen.getByRole('button', { name: /screen vessel/i })).not.toBeDisabled();
  });

  it('shows results on success', async () => {
    vi.mocked(api.post).mockResolvedValue(mockResults);
    render(<VesselScreening />);
    await userEvent.type(screen.getByPlaceholderText(/vessel name/i), 'Ever Given');
    await userEvent.click(screen.getByRole('button', { name: /screen vessel/i }));
    await waitFor(() => expect(screen.getByText('Results: 3')).toBeInTheDocument());
  });

  it('shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Screening unavailable'));
    render(<VesselScreening />);
    await userEvent.type(screen.getByPlaceholderText(/vessel name/i), 'Ever Given');
    await userEvent.click(screen.getByRole('button', { name: /screen vessel/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Screening unavailable'));
  });
});
