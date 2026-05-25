import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from './providers';

const base = {
  redirectUri: 'https://app.example/auth/callback',
  state: 'github:abc',
};

describe('buildAuthorizeUrl', () => {
  it('builds GitHub authorize URL with the right scope', () => {
    const url = buildAuthorizeUrl({
      ...base, provider: 'github', config: { clientId: 'gh-id' },
    });
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('gh-id');
    expect(url.searchParams.get('redirect_uri')).toBe(base.redirectUri);
    expect(url.searchParams.get('scope')).toBe('repo,read:user');
    expect(url.searchParams.get('state')).toBe(base.state);
  });

  it('builds GitLab URL using custom baseUrl and trims trailing slashes', () => {
    const url = buildAuthorizeUrl({
      ...base,
      provider: 'gitlab',
      config: { clientId: 'gl', baseUrl: 'https://gitlab.example.com///' },
    });
    expect(url.origin + url.pathname).toBe('https://gitlab.example.com/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('read_user');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('defaults Microsoft tenant to common', () => {
    const url = buildAuthorizeUrl({
      ...base, provider: 'microsoft', config: { clientId: 'ms' },
    });
    expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');
  });

  it('honors Microsoft tenant override via baseUrl', () => {
    const url = buildAuthorizeUrl({
      ...base, provider: 'microsoft', config: { clientId: 'ms', baseUrl: 'tenant-id' },
    });
    expect(url.pathname).toBe('/tenant-id/oauth2/v2.0/authorize');
  });

  it.each([
    ['google', 'https://accounts.google.com/o/oauth2/v2/auth'],
    ['linkedin', 'https://www.linkedin.com/oauth/v2/authorization'],
    ['facebook', 'https://www.facebook.com/v19.0/dialog/oauth'],
    ['bitbucket', 'https://bitbucket.org/site/oauth2/authorize'],
  ] as const)('targets the right authorize endpoint for %s', (provider, expectedHref) => {
    const url = buildAuthorizeUrl({
      ...base, provider, config: { clientId: 'id' },
    });
    expect(url.origin + url.pathname).toBe(expectedHref);
    expect(url.searchParams.get('state')).toBe(base.state);
    expect(url.searchParams.get('client_id')).toBe('id');
  });
});
