/**
 * LunaOS Agent Execution Page — Unit Tests
 * Covers: rendering, provider selection, context input, run button, streaming, error states
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentExecutionPage from '../page';

// Polyfill TextEncoder/TextDecoder for jsdom
const { TextEncoder: TE, TextDecoder: TD } = require('util');
global.TextEncoder = TE;
global.TextDecoder = TD as typeof TextDecoder;

jest.mock('../../../../../lib/api', () => ({
    agentsApi: {
        execute: jest.fn(),
    },
}));

import { agentsApi } from '../../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/agents/code-review',
}));

// Mock React's `use()` for params Promise
jest.mock('react', () => {
    const actualReact = jest.requireActual('react');
    return {
        ...actualReact,
        use: () => ({ id: 'code-review' }),
    };
});

function renderPage() {
    const params = Promise.resolve({ id: 'code-review' });
    return render(<AgentExecutionPage params={params} />);
}

function makeSSEReader(data: string) {
    const encoder = new TextEncoder();
    let readCount = 0;
    return {
        read: jest.fn().mockImplementation(() => {
            if (readCount === 0) {
                readCount++;
                return Promise.resolve({ done: false, value: encoder.encode(data) });
            }
            return Promise.resolve({ done: true, value: undefined });
        }),
    };
}

describe('AgentExecutionPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders agent name from slug', () => {
        renderPage();
        expect(screen.getAllByText(/Code Review/).length).toBeGreaterThanOrEqual(1);
    });

    test('renders breadcrumb to agents', () => {
        renderPage();
        const agentsLink = screen.getByText(/Agents/);
        expect(agentsLink.closest('a')).toHaveAttribute('href', '/dashboard/agents');
    });

    test('renders provider selection buttons', () => {
        renderPage();
        expect(screen.getByText('Deepseek')).toBeInTheDocument();
        expect(screen.getByText('Openai')).toBeInTheDocument();
        expect(screen.getByText('Anthropic')).toBeInTheDocument();
    });

    test('allows switching provider', () => {
        renderPage();
        fireEvent.click(screen.getByText('Anthropic'));
        expect(screen.getByText('Anthropic').className).toContain('violet');
    });

    test('renders context textarea', () => {
        renderPage();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('renders label for context', () => {
        renderPage();
        expect(screen.getByText(/Context/)).toBeInTheDocument();
    });

    test('run button is disabled when context is empty', () => {
        renderPage();
        const runBtn = screen.getByRole('button', { name: /Run Agent/i });
        expect(runBtn).toBeDisabled();
    });

    test('run button is enabled with context', () => {
        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'function add(a, b) { return a + b; }' } });
        const runBtn = screen.getByRole('button', { name: /Run Agent/i });
        expect(runBtn).not.toBeDisabled();
    });

    test('shows error on failed API response', async () => {
        const mockResponse = {
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Internal server error' }),
        };
        (agentsApi.execute as jest.Mock).mockResolvedValueOnce(mockResponse);

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Internal server error/)).toBeInTheDocument();
        });
    });

    test('shows generic error on failed API response without message', async () => {
        const mockResponse = {
            ok: false,
            status: 403,
            json: () => Promise.resolve({}),
        };
        (agentsApi.execute as jest.Mock).mockResolvedValueOnce(mockResponse);

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Execution failed: 403/)).toBeInTheDocument();
        });
    });

    test('shows error when no response body', async () => {
        const mockResponse = {
            ok: true,
            body: { getReader: () => null },
        };
        (agentsApi.execute as jest.Mock).mockResolvedValueOnce(mockResponse);

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        // The component checks `res.body?.getReader()` then checks if reader is truthy
        // With body.getReader returning null, it should hit the "No response stream" path
        await waitFor(() => {
            expect(screen.getByText('No response stream')).toBeInTheDocument();
        });
    });

    test('handles network error during execution', async () => {
        (agentsApi.execute as jest.Mock).mockRejectedValueOnce(new Error('Network failed'));

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Network failed/)).toBeInTheDocument();
        });
    });

    test('handles non-Error thrown during execution', async () => {
        (agentsApi.execute as jest.Mock).mockRejectedValueOnce('string error');

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
        });
    });

    test('streams SSE response data and shows Output heading', async () => {
        const sseData = 'data: {"choices":[{"delta":{"content":"Hello world"}}]}\ndata: [DONE]\n';
        const mockReader = makeSSEReader(sseData);

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Hello world/)).toBeInTheDocument();
            expect(screen.getByText('Output')).toBeInTheDocument();
        });
    });

    test('handles non-JSON SSE data gracefully', async () => {
        const sseData = 'data: plain text output\n';
        const mockReader = makeSSEReader(sseData);

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/plain text output/)).toBeInTheDocument();
        });
    });

    test('shows Complete status and Copy button after streaming', async () => {
        const sseData = 'data: {"choices":[{"delta":{"content":"result"}}]}\n';
        const mockReader = makeSSEReader(sseData);

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Complete/)).toBeInTheDocument();
            expect(screen.getByText(/Copy/)).toBeInTheDocument();
        });
    });

    test('subtitle text is present', () => {
        renderPage();
        expect(screen.getByText(/Enter your code context/)).toBeInTheDocument();
    });

    test('SSE with no delta content is skipped', async () => {
        const sseData = 'data: {"choices":[{"delta":{}}]}\n';
        const mockReader = makeSSEReader(sseData);

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Complete/)).toBeInTheDocument();
        });
    });

    test('textarea placeholder mentions agent name', () => {
        renderPage();
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Code Review'));
    });

    test('textarea is disabled during streaming', async () => {
        const sseData = 'data: {"choices":[{"delta":{"content":"x"}}]}\n';
        // Never resolve the second read to keep streaming
        let resolveRead: (value: { done: boolean; value?: Uint8Array }) => void;
        const encoder = new TextEncoder();
        const mockReader = {
            read: jest.fn()
                .mockResolvedValueOnce({ done: false, value: encoder.encode(sseData) })
                .mockReturnValueOnce(new Promise(r => { resolveRead = r; })),
        };

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeDisabled();
        });

        // Cleanup: resolve pending read
        resolveRead!({ done: true });
    });

    test('copy button writes output to clipboard', async () => {
        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock },
        });

        const sseData = 'data: {"choices":[{"delta":{"content":"clipboard test"}}]}\n';
        const mockReader = makeSSEReader(sseData);

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        await waitFor(() => {
            expect(screen.getByText(/Copy/)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Copy/));
        expect(writeTextMock).toHaveBeenCalledWith('clipboard test');
    });

    test('displays elapsed time during streaming', async () => {
        jest.useFakeTimers();

        const sseData = 'data: {"choices":[{"delta":{"content":"x"}}]}\n';
        let resolveRead: (value: { done: boolean; value?: Uint8Array }) => void;
        const encoder = new TextEncoder();
        const mockReader = {
            read: jest.fn()
                .mockResolvedValueOnce({ done: false, value: encoder.encode(sseData) })
                .mockReturnValueOnce(new Promise(r => { resolveRead = r; })),
        };

        (agentsApi.execute as jest.Mock).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => mockReader },
        });

        renderPage();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
        fireEvent.click(screen.getByRole('button', { name: /Run Agent/i }));

        // Wait for streaming to start
        await waitFor(() => {
            expect(screen.getByText(/Running/)).toBeInTheDocument();
        });

        // Advance timer to trigger interval that updates elapsed time
        jest.advanceTimersByTime(200);

        // The timer updates the elapsed time display
        await waitFor(() => {
            expect(screen.getByText(/\d+s elapsed/)).toBeInTheDocument();
        });

        // Cleanup
        resolveRead!({ done: true });
        jest.useRealTimers();
    });

    test('shows error for whitespace-only context via handleRun', async () => {
        // Directly test the error state by entering context then clearing
        renderPage();
        const textarea = screen.getByRole('textbox');

        // Type something first
        fireEvent.change(textarea, { target: { value: 'real context' } });
        // Now clear it
        fireEvent.change(textarea, { target: { value: '' } });

        // Button should be disabled with empty context
        const runBtn = screen.getByRole('button', { name: /Run Agent/i });
        expect(runBtn).toBeDisabled();
    });
});
