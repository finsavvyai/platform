import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CaseDetail } from './CaseDetail';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));
vi.mock('../components/compliance/CaseTimeline', () => ({
  CaseTimeline: ({ caseId }: any) => <div>Timeline: {caseId}</div>,
}));
vi.mock('../components/compliance/CaseActions', () => ({
  CaseActions: ({ status }: any) => <div>Actions: {status}</div>,
}));
vi.mock('../components/cases/SimilarCasesCard', () => ({
  SimilarCasesCard: () => <div>SimilarCases</div>,
}));

const mockCase = {
  id: 'case-1',
  entity_name: 'Jane Doe',
  matched_name: 'Doe, Jane',
  status: 'open',
  priority: 'high',
  assigned_to: 'analyst@co.com',
  confidence: 0.87,
  resolution: '',
};

beforeEach(() => { vi.clearAllMocks() });

function renderPage(id = 'case-1') {
  return render(
    <MemoryRouter initialEntries={[`/cases/${id}`]}>
      <Routes>
        <Route path="/cases/:id" element={<CaseDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CaseDetail', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders case data after fetch', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ case: mockCase, comments: [] })
      .mockResolvedValueOnce({ valid_transitions: ['investigating'] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('87.0%')).toBeInTheDocument();
    expect(screen.getByText('analyst@co.com')).toBeInTheDocument();
    expect(screen.getByText('Actions: open')).toBeInTheDocument();
    expect(screen.getByText('Timeline: case-1')).toBeInTheDocument();
  });

  it('shows null when case not found', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce({ valid_transitions: [] });
    renderPage();
    await waitFor(() => expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders similar cases card', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ case: mockCase, comments: [] })
      .mockResolvedValueOnce({ valid_transitions: [] });
    renderPage();
    await waitFor(() => screen.getByText('Jane Doe'));
    expect(screen.getByText('SimilarCases')).toBeInTheDocument();
  });
});
