/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ConnectAgentCard } from './ConnectAgentCard';

const TOKEN = 'tk_live_abcdef123456789';
const INSTANCE_ID = 'inst_123';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.restoreAllMocks();
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  global.fetch = vi.fn();
});

afterEach(cleanup);

function renderCard(overrides: { gatewayToken?: string | null; hasEvents?: boolean } = {}) {
  const token = 'gatewayToken' in overrides ? (overrides.gatewayToken ?? null) : TOKEN;
  return render(
    <ConnectAgentCard
      instanceId={INSTANCE_ID}
      gatewayToken={token}
      hasEvents={overrides.hasEvents ?? false}
    />,
  );
}

describe('ConnectAgentCard', () => {
  it('renders the CLI tab by default with install + login commands', () => {
    renderCard();
    expect(screen.getByText('Connect your device')).toBeDefined();
    expect(screen.getByText('1. Install the CLI')).toBeDefined();
    expect(screen.getByText('npm install -g @opensyber/cli')).toBeDefined();
    expect(screen.getByText(`opensyber login ${TOKEN}`)).toBeDefined();
  });

  it('switches to MCP tab and shows Claude Desktop config JSON', () => {
    renderCard();
    fireEvent.click(screen.getByRole('tab', { name: /MCP Server/i }));
    expect(screen.getByText(/Claude Desktop/)).toBeDefined();
    expect(screen.getByText(/"opensyber"/)).toBeDefined();
    expect(screen.getByText(new RegExp(TOKEN))).toBeDefined();
  });

  it('switches to VS Code tab and shows install command', () => {
    renderCard();
    fireEvent.click(screen.getByRole('tab', { name: /VS Code/i }));
    expect(screen.getByText(/Install the extension/i)).toBeDefined();
    expect(screen.getByText('code --install-extension opensyber.opensyber')).toBeDefined();
  });

  it('masks the token by default and reveals it when Reveal is clicked', () => {
    renderCard();
    // Masked: the bare token text is NOT a direct child node (the mask contains bullets)
    expect(screen.queryByText(TOKEN)).toBeNull();
    // But a masked representation is present
    expect(screen.getByText(/tk_l•+/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Reveal token/i }));
    // After reveal, raw token is shown in the display block
    expect(screen.getByText(TOKEN)).toBeDefined();
    // Toggle back to hidden
    fireEvent.click(screen.getByRole('button', { name: /Hide token/i }));
    expect(screen.queryByText(TOKEN)).toBeNull();
    expect(screen.getByText(/tk_l•+/)).toBeDefined();
  });

  it('copies the token to the clipboard via the Copy token button', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /Copy token/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(TOKEN);
    });
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
  });

  it('copies a CLI command via the CodeBlock copy button', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /Copy 1\. Install the CLI/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('npm install -g @opensyber/cli');
    });
  });

  it('shows the amber waiting state when hasEvents is false', () => {
    renderCard({ hasEvents: false });
    expect(screen.getByText(/Waiting for your first event/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Send test event/i })).toBeDefined();
  });

  it('shows the green connected state when hasEvents is true', () => {
    renderCard({ hasEvents: true });
    expect(screen.getByText('Connected — events are flowing')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Send test event/i })).toBeNull();
  });

  it('posts to the test events endpoint and shows confirmation', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    renderCard({ hasEvents: false });
    fireEvent.click(screen.getByRole('button', { name: /Send test event/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/proxy/instances/${INSTANCE_ID}/events/test`,
        { method: 'POST' },
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/Event sent — check your feed/i)).toBeDefined();
    });
  });

  it('shows an error when the test event request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    renderCard({ hasEvents: false });
    fireEvent.click(screen.getByRole('button', { name: /Send test event/i }));
    await waitFor(() => {
      expect(screen.getByText('Failed to send test event. Try again.')).toBeDefined();
    });
  });

  it('shows network error when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'));
    renderCard({ hasEvents: false });
    fireEvent.click(screen.getByRole('button', { name: /Send test event/i }));
    await waitFor(() => {
      expect(screen.getByText('Network error. Check your connection.')).toBeDefined();
    });
  });

  it('disables Reveal and Copy token when gatewayToken is null', () => {
    renderCard({ gatewayToken: null });
    const buttons = screen.getAllByRole('button');
    const reveal = buttons.find((b) => b.getAttribute('aria-label') === 'Reveal token') as HTMLButtonElement;
    const copy = buttons.find((b) => b.getAttribute('aria-label') === 'Copy token') as HTMLButtonElement;
    expect(reveal).toBeDefined();
    expect(copy).toBeDefined();
    expect(reveal.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    // Commands fall back to the placeholder
    expect(screen.getByText('opensyber login <your-token>')).toBeDefined();
  });
});
