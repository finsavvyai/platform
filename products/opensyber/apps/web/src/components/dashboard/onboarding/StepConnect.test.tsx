import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StepConnect } from './StepConnect';

// ConnectAgentCard has its own test coverage and pulls in clipboard APIs
// we don't want to exercise here — stub it to a minimal render surface
// so StepConnect's own behavior (polling, state transitions) is what we
// actually assert on.
vi.mock('../ConnectAgentCard', () => ({
  ConnectAgentCard: ({ instanceId, gatewayToken, hasEvents }: {
    instanceId: string;
    gatewayToken: string | null;
    hasEvents: boolean;
  }) => (
    <div data-testid="connect-card">
      <span data-testid="instance-id">{instanceId}</span>
      <span data-testid="gateway-token">{gatewayToken ?? 'null'}</span>
      <span data-testid="has-events">{String(hasEvents)}</span>
    </div>
  ),
}));

describe('StepConnect', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function respond(body: unknown, ok = true) {
    return { ok, json: async () => body } as Response;
  }

  it('shows a loader while the instance ID is being resolved', async () => {
    // Never resolve — the component should render its loading state
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<StepConnect onNext={vi.fn()} />);
    expect(screen.getByText(/Loading your agent/i)).toBeTruthy();
  });

  it('renders ConnectAgentCard with instance + gateway token once both fetches resolve', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/proxy/instances') {
        return Promise.resolve(respond({ instances: [{ id: 'inst-123' }] }));
      }
      if (url === '/api/proxy/instances/inst-123/gateway-token') {
        return Promise.resolve(respond({ data: { gatewayToken: 'gt-secret' } }));
      }
      if (url === '/api/proxy/security/instances/inst-123/dashboard') {
        return Promise.resolve(respond({ dashboard: { recentEvents: [] } }));
      }
      return Promise.resolve(respond({}, false));
    });

    render(<StepConnect onNext={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('instance-id').textContent).toBe('inst-123');
    });
    await waitFor(() => {
      expect(screen.getByTestId('gateway-token').textContent).toBe('gt-secret');
    });
    expect(screen.getByTestId('has-events').textContent).toBe('false');
    // "Finish setup" button is shown when there are no events
    expect(screen.getByText(/Finish setup/i)).toBeTruthy();
  });

  it('shows the error fallback when no instance is returned after polling', async () => {
    fetchMock.mockResolvedValue(respond({ instances: [] }));
    render(<StepConnect onNext={vi.fn()} />);
    await waitFor(
      () => {
        expect(screen.getByText(/No agent instance found/i)).toBeTruthy();
      },
      { timeout: 15000 },
    );
  }, 20000);
});
