import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for TenantIQ mobile.
 *
 * Build pipeline:
 *   1. `npm run build:mobile` produces apps/web/build/ via @sveltejs/adapter-static
 *   2. `npx cap sync` copies build/ into ios/App/App/public and android/app/src/main/assets/public
 *   3. `npx cap open ios` (or android) launches Xcode/Android Studio for native build
 *
 * iOS bundle ID + Android package: app.tenantiq.app — must match Apple App Store
 * Connect record + Google Play Console package name once accounts are provisioned.
 */
const config: CapacitorConfig = {
	appId: 'app.tenantiq.app',
	appName: 'TenantIQ',
	webDir: 'build',
	bundledWebRuntime: false,
	server: {
		// In dev, Capacitor can load from a remote URL (live reload). Leave
		// commented out for production builds — the bundled web assets ship offline.
		// url: 'http://192.168.1.10:5173',
		// cleartext: true,
		androidScheme: 'https',
		iosScheme: 'capacitor',
	},
	ios: {
		contentInset: 'always',
		// Required for cookie auth to api.tenantiq.app from native shell.
		limitsNavigationsToAppBoundDomains: false,
	},
	android: {
		// allowMixedContent only for dev. Off in production.
		allowMixedContent: false,
		captureInput: true,
	},
	plugins: {
		PushNotifications: {
			presentationOptions: ['badge', 'sound', 'alert'],
		},
		SplashScreen: {
			launchShowDuration: 1500,
			backgroundColor: '#0a0a0a',
			showSpinner: false,
		},
	},
};

export default config;
