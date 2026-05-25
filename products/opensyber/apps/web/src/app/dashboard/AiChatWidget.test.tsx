/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiChatWidget } from './AiChatWidget';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AiChatWidget', () => {
  it('renders the open button when closed', () => {
    render(<AiChatWidget />);
    expect(screen.getByLabelText('Open AI assistant')).toBeDefined();
  });

  it('opens the chat panel when the button is clicked', () => {
    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByText('OpenSyber AI')).toBeDefined();
    expect(screen.getByLabelText('Chat message')).toBeDefined();
  });

  it('closes the chat panel when close button is clicked', () => {
    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByText('OpenSyber AI')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('OpenSyber AI')).toBeNull();
    expect(screen.getByLabelText('Open AI assistant')).toBeDefined();
  });

  it('displays the default English greeting', () => {
    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(
      screen.getByText("Hi! I'm the OpenSyber assistant. How can I help?"),
    ).toBeDefined();
  });

  it('switches language and updates greeting', () => {
    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    fireEvent.click(screen.getByLabelText('Change language'));
    fireEvent.click(screen.getByText('Español'));
    expect(
      screen.getByText(
        '¡Hola! Soy el asistente de OpenSyber. ¿En qué puedo ayudarte?',
      ),
    ).toBeDefined();
  });

  it('sends a message and displays the user bubble', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { reply: 'Test reply' } }),
    } as unknown as Response);

    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByText('Hello')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Test reply')).toBeDefined();
    });
  });

  it('shows connection error on fetch failure', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fail'));

    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Connection error. Please try again.'),
      ).toBeDefined();
    });
  });

  it('disables send button when input is empty', () => {
    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    expect(screen.getByLabelText('Send')).toHaveProperty('disabled', true);
  });

  it('shows Thinking indicator while loading', async () => {
    let resolvePromise: (v: unknown) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((r) => { resolvePromise = r as (v: unknown) => void; }),
    );

    render(<AiChatWidget />);
    fireEvent.click(screen.getByLabelText('Open AI assistant'));
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByText('Thinking...')).toBeDefined();
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ data: { reply: 'Done' } }),
    });
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeDefined();
    });
  });
});
