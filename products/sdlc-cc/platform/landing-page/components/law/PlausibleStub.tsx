import Script from 'next/script';

/**
 * Plausible analytics stub.
 *
 * Loads nothing in development. In production it only loads if
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. No live tracking until a human
 * fills in the env var. The `data-domain` placeholder below is the
 * default and can be overridden via env.
 *
 * TODO(brand-kit): once Plausible site is registered, set
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=sdlc.cc in production env.
 */
const PlausibleStub = () => {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) {
    // Render nothing — no pixels fire in dev or until env is set.
    return null;
  }

  return (
    <Script
      strategy="afterInteractive"
      data-domain={domain}
      src="https://plausible.io/js/script.tagged-events.js"
    />
  );
};

export default PlausibleStub;
