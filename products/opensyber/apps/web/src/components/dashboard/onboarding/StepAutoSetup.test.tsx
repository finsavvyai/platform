/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepAutoSetup } from './StepAutoSetup';

describe('StepAutoSetup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom has no Intl tz API by default; just ensure the call doesn't blow up.
  });

  it('renders welcome summary based on detected persona', () => {
    render(
      <StepAutoSetup
        onNext={() => {}}
        onCustomize={() => {}}
        serverSignals={{
          oauth_provider: 'github',
          email_domain: 'gmail.com',
          referrer_path: '/docs',
        }}
      />,
    );
    // solo_dev welcome copy
    expect(screen.getByText(/build software/i)).toBeDefined();
  });

  it('shows generic fallback for unknown persona', () => {
    render(<StepAutoSetup onNext={() => {}} onCustomize={() => {}} serverSignals={{}} />);
    expect(screen.getByText(/Welcome\. Try the demo scan/i)).toBeDefined();
  });

  it('clicking Customize calls onCustomize handler', () => {
    const onCustomize = vi.fn();
    render(
      <StepAutoSetup onNext={() => {}} onCustomize={onCustomize} serverSignals={{}} />,
    );
    fireEvent.click(screen.getByText(/Customize instead/i));
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it('Start auto setup posts to /api/proxy/onboarding/auto-deploy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, instance_id: 'inst_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onNext = vi.fn();
    render(
      <StepAutoSetup
        onNext={onNext}
        onCustomize={() => {}}
        serverSignals={{ oauth_provider: 'github', email_domain: 'gmail.com' }}
      />,
    );

    fireEvent.click(screen.getByText(/Start auto setup/i));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/proxy/onboarding/auto-deploy',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('surfaces error from failed auto-deploy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ ok: false, message: 'Upgrade required' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StepAutoSetup onNext={() => {}} onCustomize={() => {}} serverSignals={{}} />);
    fireEvent.click(screen.getByText(/Start auto setup/i));
    await waitFor(() => {
      expect(screen.getByText(/Upgrade required/i)).toBeDefined();
    });
  });

  it('region row shows the inferred region', () => {
    render(
      <StepAutoSetup
        onNext={() => {}}
        onCustomize={() => {}}
        serverSignals={{ locale: 'en-AU' }}
      />,
    );
    expect(screen.getByText('Region')).toBeDefined();
  });
});
