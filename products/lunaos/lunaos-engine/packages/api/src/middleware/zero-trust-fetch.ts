/** Zero-Trust Fetch Interceptor — blocks fetches to non-allowlisted domains */

const ALLOWLISTED_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.github.com',
  'github.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'login.microsoftonline.com',
  'graph.microsoft.com',
  'emkc.org',
  'api.lemonsqueezy.com',
  'api.resend.com',
  'api.posthog.com',
  'www.googletagmanager.com',
  'www.linkedin.com',
  'api.linkedin.com',
  'exec.lunaos.ai',
  'claw-gateway.broad-dew-49ad.workers.dev',
];

export function installZeroTrustFetch(): void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
    let urlStr = '';
    if (typeof input === 'string') urlStr = input;
    else if (input instanceof URL) urlStr = input.toString();
    else if (input && (input as Request).url) urlStr = (input as Request).url;

    try {
      const parsedUrl = new URL(urlStr);
      const domain = parsedUrl.hostname;

      if (!domain || domain === 'localhost' || domain.includes('.internal') || urlStr.startsWith('/')) {
        return originalFetch.call(globalThis, input, init);
      }

      if (!ALLOWLISTED_DOMAINS.includes(domain)) {
        console.warn(`[ZERO-TRUST] BLOCKED fetch to non-allowlisted domain: ${domain} (${urlStr})`);
        return new Response(JSON.stringify({
          error: `Zero-Trust Violation: Domain ${domain} is not in the network allowlist.`,
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return originalFetch.call(globalThis, input, init);
    } catch {
      return originalFetch.call(globalThis, input, init);
    }
  };
}
