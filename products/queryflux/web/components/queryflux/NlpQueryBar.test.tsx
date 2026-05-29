import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NlpQueryBar } from './NlpQueryBar';

const mockMutate = vi.fn();

vi.mock('../../hooks/useNlpQuery', () => ({
    useNlpQuery: vi.fn(() => ({
        mutate: mockMutate,
        data: null,
        isPending: false,
        error: null,
    })),
}));

import { useNlpQuery } from '../../hooks/useNlpQuery';
const mockUseNlpQuery = vi.mocked(useNlpQuery);

describe('NlpQueryBar', () => {
    const onSqlGenerated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseNlpQuery.mockReturnValue({
            mutate: mockMutate,
            data: null,
            isPending: false,
            error: null,
        } as unknown as ReturnType<typeof useNlpQuery>);
    });

    it('renders the input and button', () => {
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByLabelText('Natural language query')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generate SQL' })).toBeInTheDocument();
    });

    it('disables button when input is empty', () => {
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByRole('button', { name: 'Generate SQL' })).toBeDisabled();
    });

    it('enables button when text is entered', async () => {
        const user = userEvent.setup();
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        await user.type(screen.getByLabelText('Natural language query'), 'show users');
        expect(screen.getByRole('button', { name: 'Generate SQL' })).toBeEnabled();
    });

    it('calls mutate with question and schema on submit', async () => {
        const user = userEvent.setup();
        render(<NlpQueryBar schema="public_schema" onSqlGenerated={onSqlGenerated} />);

        await user.type(screen.getByLabelText('Natural language query'), 'top 10 customers');
        await user.click(screen.getByRole('button', { name: 'Generate SQL' }));

        expect(mockMutate).toHaveBeenCalledWith(
            { question: 'top 10 customers', schema: 'public_schema', dialect: 'postgresql' },
            expect.objectContaining({ onSuccess: expect.any(Function) })
        );
    });

    it('does not submit when question is whitespace only', async () => {
        const user = userEvent.setup();
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);

        await user.type(screen.getByLabelText('Natural language query'), '   ');
        fireEvent.submit(screen.getByLabelText('Natural language query').closest('form')!);

        expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows loading text when pending', () => {
        mockUseNlpQuery.mockReturnValue({
            mutate: mockMutate,
            data: null,
            isPending: true,
            error: null,
        } as unknown as ReturnType<typeof useNlpQuery>);

        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();
    });

    it('shows confidence when data is available', () => {
        mockUseNlpQuery.mockReturnValue({
            mutate: mockMutate,
            data: { sql: 'SELECT 1', confidence: 0.85, explanation: 'Simple count' },
            isPending: false,
            error: null,
        } as unknown as ReturnType<typeof useNlpQuery>);

        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
        expect(screen.getByText('Simple count')).toBeInTheDocument();
    });

    it('shows error message when mutation fails', () => {
        mockUseNlpQuery.mockReturnValue({
            mutate: mockMutate,
            data: null,
            isPending: false,
            error: new Error('Network error'),
        } as unknown as ReturnType<typeof useNlpQuery>);

        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('calls onSqlGenerated via onSuccess callback', async () => {
        const user = userEvent.setup();
        mockMutate.mockImplementation((_req: unknown, opts: { onSuccess: (data: { sql: string }) => void }) => {
            opts.onSuccess({ sql: 'SELECT COUNT(*) FROM users' });
        });

        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        await user.type(screen.getByLabelText('Natural language query'), 'count users');
        await user.click(screen.getByRole('button', { name: 'Generate SQL' }));

        expect(onSqlGenerated).toHaveBeenCalledWith('SELECT COUNT(*) FROM users');
    });

    it('renders AI label', () => {
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('renders dialect selector with default postgresql', () => {
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        const select = screen.getByRole('combobox', { name: 'SQL dialect' });
        expect(select).toBeInTheDocument();
        expect((select as HTMLSelectElement).value).toBe('postgresql');
    });

    it('renders all five dialect options', () => {
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);
        const options = screen.getAllByRole('option');
        const values = options.map((o) => (o as HTMLOptionElement).value);
        expect(values).toEqual(['postgresql', 'mysql', 'mongodb', 'duckdb', 'sqlite']);
    });

    it('respects defaultDialect prop', () => {
        render(<NlpQueryBar defaultDialect="mysql" onSqlGenerated={onSqlGenerated} />);
        const select = screen.getByRole('combobox', { name: 'SQL dialect' });
        expect((select as HTMLSelectElement).value).toBe('mysql');
    });

    it('passes selected dialect in mutate call', async () => {
        const user = userEvent.setup();
        render(<NlpQueryBar schema="public" onSqlGenerated={onSqlGenerated} />);

        await user.selectOptions(screen.getByRole('combobox', { name: 'SQL dialect' }), 'mysql');
        await user.type(screen.getByLabelText('Natural language query'), 'count orders');
        await user.click(screen.getByRole('button', { name: 'Generate SQL' }));

        expect(mockMutate).toHaveBeenCalledWith(
            { question: 'count orders', schema: 'public', dialect: 'mysql' },
            expect.objectContaining({ onSuccess: expect.any(Function) })
        );
    });

    it('updates dialect when selector changes', async () => {
        const user = userEvent.setup();
        render(<NlpQueryBar onSqlGenerated={onSqlGenerated} />);

        const select = screen.getByRole('combobox', { name: 'SQL dialect' });
        await user.selectOptions(select, 'duckdb');
        expect((select as HTMLSelectElement).value).toBe('duckdb');
    });
});
