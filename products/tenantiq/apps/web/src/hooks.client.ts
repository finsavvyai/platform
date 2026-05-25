import * as Sentry from '@sentry/sveltekit';
import { env as publicEnv } from '$env/dynamic/public';

const PUBLIC_SENTRY_DSN = publicEnv.PUBLIC_SENTRY_DSN;
const PUBLIC_APP_VERSION = publicEnv.PUBLIC_APP_VERSION ?? 'dev';

if (PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: PUBLIC_SENTRY_DSN,
		release: PUBLIC_APP_VERSION,
		environment: import.meta.env.MODE,
		tracesSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 1.0,
		integrations: [Sentry.replayIntegration()],
		beforeSend(event) {
			// Strip any Authorization or token query params that slipped into URLs.
			if (event.request?.url) {
				event.request.url = event.request.url.replace(
					/([?&#])(token|access_token|id_token)=[^&#]*/g,
					'$1$2=REDACTED',
				);
			}
			if (event.request?.headers) {
				delete (event.request.headers as Record<string, unknown>)['authorization'];
				delete (event.request.headers as Record<string, unknown>)['Authorization'];
				delete (event.request.headers as Record<string, unknown>)['cookie'];
			}
			return event;
		},
	});
}

export const handleError = Sentry.handleErrorWithSentry();
