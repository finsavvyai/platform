import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CustomerImport from './CustomerImport';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { upload: vi.fn() },
}));

vi.mock('../../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));

beforeEach(() => { vi.clearAllMocks() });

function renderPage() {
  return render(<MemoryRouter><CustomerImport /></MemoryRouter>);
}

function makeFile(content: string, name = 'test.csv', type = 'text/csv') {
  const file = new File([content], name, { type });
  // jsdom doesn't implement File.text() — polyfill
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

const VALID_CSV = 'external_id,entity_type,name\ncust_001,individual,Jane Doe\ncust_002,company,Acme LLC\n';
const BAD_CSV = 'id,type,fullname\n001,person,Alice\n';

describe('CustomerImport', () => {
  it('renders page title and steps', () => {
    renderPage();
    expect(screen.getByText('Import customer base')).toBeInTheDocument();
    expect(screen.getByText(/download the template/i)).toBeInTheDocument();
    expect(screen.getByText(/upload your csv/i)).toBeInTheDocument();
  });

  it('shows error for non-csv file', async () => {
    renderPage();
    const file = new File(['data'], 'data.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // fireEvent bypasses userEvent accept filtering for hidden inputs
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/.csv/i));
  });

  it('shows error for missing required columns', async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makeFile(BAD_CSV));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/missing required columns/i));
  });

  it('shows preview table for valid CSV', async () => {
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makeFile(VALID_CSV));
    await waitFor(() => expect(screen.getByText(/preview/i)).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import and start monitoring/i })).toBeInTheDocument();
  });

  it('shows success card after upload', async () => {
    vi.mocked(api.upload).mockResolvedValue({ imported: 2, skipped: 0 });
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makeFile(VALID_CSV));
    await waitFor(() => screen.getByRole('button', { name: /import and start monitoring/i }));
    await userEvent.click(screen.getByRole('button', { name: /import and start monitoring/i }));
    await waitFor(() => expect(screen.getByText(/import complete/i)).toBeInTheDocument());
    expect(screen.getByText(/2 customers now under monitoring/i)).toBeInTheDocument();
  });

  it('shows skipped rows message when skipped > 0', async () => {
    vi.mocked(api.upload).mockResolvedValue({ imported: 1, skipped: 1 });
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makeFile(VALID_CSV));
    await waitFor(() => screen.getByRole('button', { name: /import and start monitoring/i }));
    await userEvent.click(screen.getByRole('button', { name: /import and start monitoring/i }));
    await waitFor(() => expect(screen.getByText(/1 rows were skipped/i)).toBeInTheDocument());
  });

  it('shows error on upload failure', async () => {
    vi.mocked(api.upload).mockRejectedValue(new Error('net fail'));
    renderPage();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makeFile(VALID_CSV));
    await waitFor(() => screen.getByRole('button', { name: /import and start monitoring/i }));
    await userEvent.click(screen.getByRole('button', { name: /import and start monitoring/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/upload failed/i));
  });

  it('download template button triggers file download', async () => {
    const mockClick = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: mockClick });
      }
      return el;
    });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /download template/i }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    vi.restoreAllMocks();
  });
});
