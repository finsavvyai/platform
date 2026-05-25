export type CompareAnalyticsEvent = 'compare_page_view' | 'compare_cta_click';

type CompareAnalyticsPayload = {
  compare_page: string;
  cta_label?: string;
  destination?: string;
};

type PlausibleFn = (eventName: string, options?: { props?: Record<string, unknown> }) => void;
type GtagFn = (command: 'event', eventName: string, params: Record<string, unknown>) => void;
type DataLayer = { push: (entry: Record<string, unknown>) => void };

function readWindowAnalyticsTargets() {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    plausible: (window as Window & { plausible?: PlausibleFn }).plausible,
    gtag: (window as Window & { gtag?: GtagFn }).gtag,
    dataLayer: (window as Window & { dataLayer?: DataLayer }).dataLayer,
  };
}

export function trackCompareEvent(eventName: CompareAnalyticsEvent, payload: CompareAnalyticsPayload): void {
  const { plausible, gtag, dataLayer } = readWindowAnalyticsTargets();
  if (!plausible && !gtag && !dataLayer) {
    return;
  }

  try {
    plausible?.(eventName, { props: payload });
    gtag?.('event', eventName, payload);
    dataLayer?.push({ event: eventName, ...payload });
  } catch {
    // Analytics must never impact page UX.
  }
}
