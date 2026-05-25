import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SARForm } from './SARForm';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { post: vi.fn() },
}));

vi.mock('../../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <SARForm />
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks() });

describe('SARForm', () => {
  it('renders form fields and initial draft status', () => {
    renderForm();
    expect(screen.getByText('Suspicious Activity Report')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('case-001')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
  });

  it('generates SAR and updates status', async () => {
    vi.mocked(api.post).mockResolvedValue({
      sar: { id: 'sar-1', filing_status: 'review', narrative: 'AI narrative' },
    });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => expect(screen.getByText('REVIEW')).toBeInTheDocument());
    expect(screen.getByDisplayValue('AI narrative')).toBeInTheDocument();
  });

  it('shows file button after review status', async () => {
    vi.mocked(api.post).mockResolvedValue({
      sar: { id: 'sar-1', filing_status: 'review' },
    });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /file with/i })).toBeInTheDocument());
  });

  it('shows success card after filing', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ sar: { id: 'sar-1', filing_status: 'review' } })
      .mockResolvedValueOnce({ sar: { id: 'sar-filed-99', filing_status: 'filed' } });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => screen.getByRole('button', { name: /file with/i }));
    await userEvent.type(screen.getByPlaceholderText(/narrative/i), 'some narrative text');
    await userEvent.click(screen.getByRole('button', { name: /file with/i }));
    await waitFor(() => expect(screen.getByText(/sar filed successfully/i)).toBeInTheDocument());
    expect(screen.getByText(/sar-filed-99/)).toBeInTheDocument();
  });

  it('shows error on generation failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Server error'));
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'));
  });

  it('shows error when filing without narrative', async () => {
    vi.mocked(api.post).mockResolvedValue({ sar: { id: 'sar-1', filing_status: 'review' } });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => screen.getByRole('button', { name: /file with/i }));
    await userEvent.click(screen.getByRole('button', { name: /file with/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/narrative/i));
  });

  it('submit for review button changes status to review', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));
    expect(screen.getByText('REVIEW')).toBeInTheDocument();
  });

  it('changes subject type select', async () => {
    renderForm();
    const select = screen.getByDisplayValue('Individual');
    await userEvent.selectOptions(select, 'entity');
    expect(select).toHaveValue('entity');
  });

  it('changes activity type select', async () => {
    renderForm();
    const select = screen.getByDisplayValue('Structuring');
    await userEvent.selectOptions(select, 'fraud');
    expect(select).toHaveValue('fraud');
  });

  it('changes regulator select', async () => {
    renderForm();
    const select = screen.getByDisplayValue('FinCEN');
    await userEvent.selectOptions(select, 'FCA');
    expect(select).toHaveValue('FCA');
  });

  it('shows filing error for non-Error rejection', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ sar: { id: 'sar-1', filing_status: 'review' } })
      .mockRejectedValueOnce('string error');
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => screen.getByRole('button', { name: /file with/i }));
    await userEvent.type(screen.getByPlaceholderText(/narrative/i), 'narrative text');
    await userEvent.click(screen.getByRole('button', { name: /file with/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/filing failed/i));
  });

  it('view audit trail button visible after filing', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ sar: { id: 'sar-1', filing_status: 'review' } })
      .mockResolvedValueOnce({ sar: { id: 'sar-99', filing_status: 'filed' } });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText('case-001'), 'case-abc');
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'Jane Doe');
    await userEvent.click(screen.getByRole('button', { name: /generate sar/i }));
    await waitFor(() => screen.getByRole('button', { name: /file with/i }));
    await userEvent.type(screen.getByPlaceholderText(/narrative/i), 'narrative text');
    await userEvent.click(screen.getByRole('button', { name: /file with/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /view audit trail/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /view audit trail/i }));
  });
});
