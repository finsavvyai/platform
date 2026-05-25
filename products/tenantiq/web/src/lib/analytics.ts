// Analytics tracking — stub for Plausible / PostHog
// Set PUBLIC_ANALYTICS_URL in env to enable

declare global {
	interface Window {
		plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
		posthog?: { capture: (event: string, props?: Record<string, string>) => void };
	}
}

export function trackEvent(name: string, props?: Record<string, string>) {
	if (typeof window === 'undefined') return;

	// Plausible
	if (window.plausible) {
		window.plausible(name, { props });
	}

	// PostHog
	if (window.posthog) {
		window.posthog.capture(name, props);
	}
}

export function trackPageView(path?: string) {
	trackEvent('pageview', path ? { path } : undefined);
}
