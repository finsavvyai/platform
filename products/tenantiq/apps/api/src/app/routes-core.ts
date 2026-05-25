import type { Hono } from 'hono';
import { healthRoutes } from '../routes/health';
import { healthDetailedRoutes } from '../routes/health-detailed';
import { metricsRoutes } from '../routes/metrics';
import { authRoutes } from '../routes/auth';
import { jwksRoutes } from '../routes/auth-jwks';
import { webauthnRegisterRoutes } from '../routes/auth-webauthn-register';
import { webauthnAuthRoutes } from '../routes/auth-webauthn-auth';
import platform from '../routes/platform';
import { selfTestRoutes } from '../routes/self-test';
import { openapiRoutes } from '../routes/openapi';
import { prospectRoutes } from '../routes/prospect';
import type { AppEnv } from './types';

export function registerCoreRoutes(app: Hono<AppEnv>) {
	app.route('/health', healthRoutes);
	app.route('/health', healthDetailedRoutes);
	// Alias under /api/* to match the convention of every other route.
	app.route('/api/health', healthRoutes);
	app.route('/api/health', healthDetailedRoutes);
	app.route('/api/metrics', metricsRoutes);
	app.route('/api/auth', authRoutes);
	app.route('/api/auth/webauthn/register', webauthnRegisterRoutes);
	app.route('/api/auth/webauthn/auth', webauthnAuthRoutes);
	app.route('/api/.well-known/jwks.json', jwksRoutes);
	app.route('/platform', platform);
	// onboarding routes moved to routes-tenant.ts to inherit tokenforgeMiddleware.
	app.route('/api/self-test', selfTestRoutes);
	app.route('/api', openapiRoutes);
	// Public, no-auth wedge: domain → gap report. KV-rate-limited per IP.
	app.route('/api/prospect', prospectRoutes);
}
