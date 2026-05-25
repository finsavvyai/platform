/**
 * @vitest-environment jsdom
 *
 * ProfilePage is an async server component. We test that it redirects
 * when no session is available, which is the expected behavior.
 */
import { describe, it, expect, vi } from 'vitest';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('REDIRECT');
  },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth-token', () => ({
  getApiToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('../../packages/shared/src/index.ts', () => ({
  PLAN_CONFIGS: {
    free: { name: 'Free' },
  } as Record<string, any>,
}));

vi.mock('./SignOutButton', () => ({
  SignOutButton: () => <button>Sign Out</button>,
}));

vi.mock('./ConnectedAccounts', () => ({
  ConnectedAccounts: () => <div>Connected Accounts</div>,
}));

describe('ProfilePage', () => {
  it('redirects to sign-in when no session', async () => {
    const { default: ProfilePage } = await import('./page');
    await expect(ProfilePage()).rejects.toThrow('REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/sign-in');
  });

  it('exports correct metadata', async () => {
    const mod = await import('./page');
    expect(mod.metadata).toEqual({ title: 'Profile' });
  });
});
