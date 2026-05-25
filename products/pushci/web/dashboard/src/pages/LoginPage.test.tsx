import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from './LoginPage';
import type { ProviderAvailability } from '../lib/auth/types';

function availability(overrides: Partial<ProviderAvailability> = {}): ProviderAvailability {
  return {
    github: false, gitlab: false, google: false, linkedin: false,
    facebook: false, bitbucket: false, microsoft: false,
    ...overrides,
  };
}

const noop = vi.fn();

function renderPage(props: Partial<React.ComponentProps<typeof LoginPage>> = {}) {
  return render(
    <LoginPage
      onGitHubLogin={noop}
      onGitLabLogin={noop}
      onGoogleLogin={noop}
      onLinkedInLogin={noop}
      onFacebookLogin={noop}
      onBitbucketLogin={noop}
      onMicrosoftLogin={noop}
      providers={availability({ github: true })}
      error={null}
      {...props}
    />,
  );
}

describe('LoginPage', () => {
  it('renders enabled provider with a Continue label', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /continue with github/i }),
    ).toBeEnabled();
  });

  it('renders disabled provider with not-configured label', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /gitlab sign-in is not configured/i });
    expect(btn).toBeDisabled();
  });

  it('renders error inside an aria-live alert region', () => {
    renderPage({ error: 'oauth state mismatch' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('oauth state mismatch');
  });

  it('invokes the right handler on click', () => {
    const onGitHubLogin = vi.fn();
    renderPage({ onGitHubLogin });
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));
    expect(onGitHubLogin).toHaveBeenCalled();
  });

  it('does not invoke disabled provider handlers', () => {
    const onGitLabLogin = vi.fn();
    renderPage({ onGitLabLogin });
    const btn = screen.getByRole('button', { name: /gitlab sign-in is not configured/i });
    fireEvent.click(btn);
    expect(onGitLabLogin).not.toHaveBeenCalled();
  });
});
