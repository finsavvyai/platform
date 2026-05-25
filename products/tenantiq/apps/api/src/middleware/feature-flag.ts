/**
 * Feature Flag Middleware — gates routes behind a feature flag.
 *
 * Uses the FeatureFlagEngine to evaluate flags against the
 * authenticated user's org, plan, and userId.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';
import { FeatureFlagEngine } from '../lib/feature-flags-engine';

/**
 * Middleware that gates a route behind a feature flag.
 * Returns 403 if the flag is not enabled for the current user context.
 */
export function requireFlag(flagKey: string) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const engine = new FeatureFlagEngine(c.env.KV);
		const user = c.get('user');

		const ctx = {
			orgId: user?.orgId ?? '',
			plan: user?.role ?? '',
			userId: user?.sub ?? '',
		};

		const enabled = await engine.isEnabled(flagKey, ctx);
		if (!enabled) {
			return c.json(
				{ error: 'Feature not available', flag: flagKey },
				403,
			);
		}

		await next();
	});
}
